import type { LLMTool } from '../../../shared/types';
import type { SkillContext, SkillDefinition, SkillResult } from '../types';

type MemoryOp = 'list' | 'add' | 'delete' | 'search' | 'pin' | 'unpin';

function manifest() {
  return {
    name: 'memory_ops',
    displayName: 'Memory Operations',
    description:
      'Agent can read, write, or list its own long-term memories. Useful for explicit "remember this" requests.',
    category: 'memory',
    version: '1.0.0',
    author: 'Office AI Agent',
    parameters: [
      {
        name: 'operation',
        type: 'string' as const,
        description: 'Memory operation',
        required: true,
        enum: ['list', 'add', 'delete', 'search', 'pin', 'unpin'],
      },
      {
        name: 'content',
        type: 'string' as const,
        description: 'Memory content (for add)',
        required: false,
      },
      {
        name: 'query',
        type: 'string' as const,
        description: 'Search query (for search)',
        required: false,
      },
      {
        name: 'memoryId',
        type: 'string' as const,
        description: 'Memory id (for delete/pin/unpin)',
        required: false,
      },
      {
        name: 'importance',
        type: 'number' as const,
        description: 'Importance 0..1',
        required: false,
        default: 0.7,
      },
      {
        name: 'category',
        type: 'string' as const,
        description: 'Memory category (e.g. fact, user_preference, instruction, context, task)',
        required: false,
      },
    ],
    requiresApproval: false,
    dangerous: false,
    examples: [
      { title: 'Remember a fact', input: { operation: 'add', content: 'User prefers dark mode.', importance: 0.6 } },
    ],
  };
}

interface MemoryOpsArgs {
  operation: MemoryOp;
  content?: string;
  query?: string;
  memoryId?: string;
  importance?: number;
  category?: string;
}

interface MinimalMemoryRepo {
  list(agentId: string, opts?: { limit?: number }): Promise<unknown[]>;
  create(input: {
    agentId: string;
    type: 'long_term';
    content: string;
    importance: number;
    category: string;
  }): Promise<unknown>;
  delete(id: string, agentId: string): Promise<boolean>;
  search(agentId: string, query: string, opts?: { limit?: number }): Promise<unknown[]>;
  update(id: string, agentId: string, patch: Record<string, unknown>): Promise<unknown>;
  get(id: string, agentId: string): Promise<unknown | null>;
}

function repoMissing(op: string): SkillResult {
  return {
    success: false,
    output: '',
    error: `Memory repository does not implement operation "${op}".`,
  };
}

export const memoryOpsSkill: SkillDefinition = {
  manifest: manifest(),
  toTool(): LLMTool {
    return {
      type: 'function',
      function: {
        name: 'memory_ops',
        description: this.manifest.description,
        parameters: {
          type: 'object',
          properties: {
            operation: { type: 'string', enum: ['list', 'add', 'delete', 'search', 'pin', 'unpin'] },
            content: { type: 'string' },
            query: { type: 'string' },
            memoryId: { type: 'string' },
            importance: { type: 'number' },
            category: { type: 'string' },
          },
          required: ['operation'],
        },
      },
    };
  },
  async execute(rawArgs, ctx): Promise<SkillResult> {
    const args = (rawArgs ?? {}) as unknown as MemoryOpsArgs;
    const valid: MemoryOp[] = ['list', 'add', 'delete', 'search', 'pin', 'unpin'];
    if (!valid.includes(args.operation)) {
      return { success: false, output: '', error: `Invalid operation "${args.operation}"` };
    }

    const repo = ctx.memoryRepo as MinimalMemoryRepo | undefined;
    if (!repo) {
      return {
        success: false,
        output: '',
        error: 'Memory repository not available. Pass ctx.memoryRepo when executing this skill.',
      };
    }
    const has = (k: string): boolean =>
      typeof (repo as unknown as Record<string, unknown>)[k] === 'function';

    try {
      switch (args.operation) {
        case 'list': {
          if (!has('list')) return repoMissing('list');
          const list = await repo.list(ctx.agent.id, { limit: 50 });
          const items = Array.isArray(list) ? list : [];
          const formatted = items
            .map((m) => {
              const r = m as Record<string, unknown>;
              return `[${String(r.id ?? '?')}] (imp=${String(r.importance ?? '?')}) ${String(r.content ?? '')}`;
            })
            .join('\n');
          return {
            success: true,
            output: formatted || '(no memories)',
            data: { count: items.length, items },
          };
        }
        case 'add': {
          if (!has('create')) return repoMissing('add');
          if (!args.content || typeof args.content !== 'string') {
            return { success: false, output: '', error: 'Parameter "content" is required for add.' };
          }
          const created = await repo.create({
            agentId: ctx.agent.id,
            type: 'long_term',
            content: args.content,
            importance: typeof args.importance === 'number' ? args.importance : 0.7,
            category: args.category ?? 'fact',
          });
          return {
            success: true,
            output: 'Memory saved.',
            data: { memory: created },
          };
        }
        case 'delete': {
          if (!has('delete')) return repoMissing('delete');
          if (!args.memoryId) {
            return { success: false, output: '', error: 'Parameter "memoryId" is required for delete.' };
          }
          const ok = await repo.delete(args.memoryId, ctx.agent.id);
          return {
            success: ok,
            output: ok ? 'Memory deleted.' : 'Memory not found or not deleted.',
            data: { deleted: ok, id: args.memoryId },
          };
        }
        case 'search': {
          if (!has('search')) return repoMissing('search');
          if (!args.query || typeof args.query !== 'string') {
            return { success: false, output: '', error: 'Parameter "query" is required for search.' };
          }
          const matches = await repo.search(ctx.agent.id, args.query, { limit: 20 });
          const items = Array.isArray(matches) ? matches : [];
          const formatted = items
            .map((m) => {
              const r = m as Record<string, unknown>;
              return `[${String(r.id ?? '?')}] ${String(r.content ?? '')}`;
            })
            .join('\n');
          return {
            success: true,
            output: formatted || '(no matches)',
            data: { count: items.length, items, query: args.query },
          };
        }
        case 'pin': {
          if (!has('update')) return repoMissing('pin');
          if (!args.memoryId) {
            return { success: false, output: '', error: 'Parameter "memoryId" is required for pin.' };
          }
          const updated = await repo.update(args.memoryId, ctx.agent.id, { isPinned: true });
          return {
            success: true,
            output: 'Memory pinned.',
            data: { memory: updated },
          };
        }
        case 'unpin': {
          if (!has('update')) return repoMissing('unpin');
          if (!args.memoryId) {
            return { success: false, output: '', error: 'Parameter "memoryId" is required for unpin.' };
          }
          const updated = await repo.update(args.memoryId, ctx.agent.id, { isPinned: false });
          return {
            success: true,
            output: 'Memory unpinned.',
            data: { memory: updated },
          };
        }
        default:
          return { success: false, output: '', error: `Unhandled operation: ${args.operation}` };
      }
    } catch (e) {
      return {
        success: false,
        output: '',
        error: `memory_ops failed: ${(e as Error).message}`,
      };
    }
  },
};

export default memoryOpsSkill;
