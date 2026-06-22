import type { LLMTool } from '../../../shared/types';
import type { SkillContext, SkillDefinition, SkillResult } from '../types';

function manifest() {
  return {
    name: 'agent_delegate',
    displayName: 'Delegate to Another Agent',
    description:
      'Delegate a sub-task to another agent in the same chatroom. The delegated agent will process the task and return its result.',
    category: 'system',
    version: '1.0.0',
    author: 'Office AI Agent',
    parameters: [
      {
        name: 'targetAgentId',
        type: 'string' as const,
        description: 'ID of the agent to delegate to',
        required: true,
      },
      {
        name: 'task',
        type: 'string' as const,
        description: 'Task description for the target agent',
        required: true,
      },
      {
        name: 'context',
        type: 'string' as const,
        description: 'Optional additional context',
        required: false,
      },
    ],
    requiresApproval: true,
    dangerous: false,
    examples: [
      {
        title: 'Delegate research',
        input: { targetAgentId: 'agent-researcher', task: 'Look up recent papers on RAG.' },
      },
    ],
  };
}

interface AgentDelegateArgs {
  targetAgentId: string;
  task: string;
  context?: string;
}

export const agentDelegateSkill: SkillDefinition = {
  manifest: manifest(),
  toTool(): LLMTool {
    return {
      type: 'function',
      function: {
        name: 'agent_delegate',
        description: this.manifest.description,
        parameters: {
          type: 'object',
          properties: {
            targetAgentId: { type: 'string' },
            task: { type: 'string' },
            context: { type: 'string' },
          },
          required: ['targetAgentId', 'task'],
        },
      },
    };
  },
  async execute(rawArgs, ctx: SkillContext): Promise<SkillResult> {
    const args = (rawArgs ?? {}) as unknown as AgentDelegateArgs;
    if (!args.targetAgentId || typeof args.targetAgentId !== 'string') {
      return { success: false, output: '', error: 'Parameter "targetAgentId" is required.' };
    }
    if (!args.task || typeof args.task !== 'string') {
      return { success: false, output: '', error: 'Parameter "task" is required.' };
    }
    if (!ctx.agentDelegate) {
      return {
        success: false,
        output: '',
        error:
          'Agent delegate function not available. Pass ctx.agentDelegate when executing this skill (orchestrator not wired).',
      };
    }
    try {
      const result = await ctx.agentDelegate(args.targetAgentId, args.task, args.context);
      return {
        success: true,
        output: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        data: { result, targetAgentId: args.targetAgentId },
      };
    } catch (e) {
      return {
        success: false,
        output: '',
        error: `agent_delegate failed: ${(e as Error).message}`,
      };
    }
  },
};

export default agentDelegateSkill;
