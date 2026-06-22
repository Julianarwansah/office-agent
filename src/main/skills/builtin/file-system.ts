import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type { LLMTool } from '../../../shared/types';
import type { SkillContext, SkillDefinition, SkillResult } from '../types';

type FileOp = 'read' | 'write' | 'list' | 'delete' | 'exists' | 'stat' | 'mkdir';

function manifest() {
  return {
    name: 'file_system',
    displayName: 'File System Operations',
    description:
      'Read, write, list, delete, or stat files in the agent working directory. Supports sub-paths but not escape outside cwd.',
    category: 'file',
    version: '1.0.0',
    author: 'Office AI Agent',
    parameters: [
      {
        name: 'operation',
        type: 'string' as const,
        description:
          'File operation to perform: read, write, list, delete, exists, stat, mkdir',
        required: true,
        enum: ['read', 'write', 'list', 'delete', 'exists', 'stat', 'mkdir'],
      },
      {
        name: 'path',
        type: 'string' as const,
        description: 'Path relative to the working directory (defaults to ".")',
        required: false,
        default: '.',
      },
      {
        name: 'content',
        type: 'string' as const,
        description: 'Content to write (for operation="write")',
        required: false,
      },
      {
        name: 'encoding',
        type: 'string' as const,
        description: 'Encoding for write (utf8 or base64). Default: utf8',
        required: false,
        default: 'utf8',
        enum: ['utf8', 'base64'],
      },
      {
        name: 'recursive',
        type: 'boolean' as const,
        description: 'Recursive flag for mkdir/list',
        required: false,
        default: false,
      },
    ],
    requiresApproval: true,
    dangerous: true,
    examples: [
      { title: 'Read a file', input: { operation: 'read', path: 'README.md' } },
      { title: 'List files', input: { operation: 'list', path: '.' } },
    ],
  };
}

interface FileSystemArgs {
  operation: FileOp;
  path?: string;
  content?: string;
  encoding?: 'utf8' | 'base64';
  recursive?: boolean;
}

function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * Resolve a user-supplied path against the working directory and ensure it
 * does not escape. Returns the absolute resolved path or an error message.
 */
function resolveSafePath(
  workingDir: string,
  requested: string
): { ok: true; abs: string } | { ok: false; error: string } {
  if (typeof requested !== 'string' || requested.length === 0) {
    return { ok: false, error: 'Path is required' };
  }

  const root = path.resolve(workingDir);
  let abs: string;

  if (path.isAbsolute(requested)) {
    // Allow absolute paths only if they are inside the working directory.
    abs = path.resolve(requested);
  } else {
    abs = path.resolve(root, requested);
  }

  const rel = path.relative(root, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return {
      ok: false,
      error: `Path "${requested}" escapes the working directory`,
    };
  }
  // Also reject Windows drive-mismatched paths.
  if (isWindows()) {
    if (abs.slice(0, root.length).toLowerCase() !== root.toLowerCase()) {
      return {
        ok: false,
        error: `Path "${requested}" is outside the working directory`,
      };
    }
  }
  return { ok: true, abs };
}

function isBinaryBuffer(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true;
  }
  return false;
}

async function doRead(abs: string): Promise<SkillResult> {
  try {
    const stat = await fsp.stat(abs);
    if (stat.isDirectory()) {
      return {
        success: false,
        output: '',
        error: `Cannot read directory as file: ${abs}`,
      };
    }
    if (stat.size > 5 * 1024 * 1024) {
      return {
        success: false,
        output: '',
        error: `File too large to read (>5MB): ${stat.size} bytes`,
      };
    }
    const buf = await fsp.readFile(abs);
    if (isBinaryBuffer(buf)) {
      return {
        success: true,
        output: buf.toString('base64'),
        data: { encoding: 'base64', size: buf.length, binary: true },
        metadata: { path: abs },
      };
    }
    return {
      success: true,
      output: buf.toString('utf8'),
      data: { encoding: 'utf8', size: buf.length, binary: false },
      metadata: { path: abs },
    };
  } catch (e) {
    return {
      success: false,
      output: '',
      error: `Read failed: ${(e as Error).message}`,
    };
  }
}

async function doWrite(
  abs: string,
  content: string,
  encoding: 'utf8' | 'base64'
): Promise<SkillResult> {
  try {
    const buf = encoding === 'base64' ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf8');
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, buf);
    return {
      success: true,
      output: `Wrote ${buf.length} bytes to ${abs}`,
      data: { bytes: buf.length, encoding, path: abs },
    };
  } catch (e) {
    return {
      success: false,
      output: '',
      error: `Write failed: ${(e as Error).message}`,
    };
  }
}

async function doList(abs: string, recursive: boolean): Promise<SkillResult> {
  try {
    const stat = await fsp.stat(abs);
    if (!stat.isDirectory()) {
      return {
        success: false,
        output: '',
        error: `Path is not a directory: ${abs}`,
      };
    }
    const entries = await fsp.readdir(abs, { withFileTypes: true });
    const top: Array<Record<string, unknown>> = [];
    for (const entry of entries) {
      const entryAbs = path.join(abs, entry.name);
      const entryStat = await fsp.stat(entryAbs);
      const row: Record<string, unknown> = {
        name: entry.name,
        path: entryAbs,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: entryStat.size,
        modifiedAt: entryStat.mtimeMs,
      };
      top.push(row);
    }

    let formatted = top
      .map((e) => {
        const t = e.type === 'directory' ? 'd' : '-';
        return `${t} ${e.size ?? 0}\t${e.path}`;
      })
      .join('\n');

    if (recursive) {
      const all: typeof top = [];
      async function walk(dir: string): Promise<void> {
        const items = await fsp.readdir(dir, { withFileTypes: true });
        for (const it of items) {
          const p = path.join(dir, it.name);
          const st = await fsp.stat(p);
          all.push({
            name: it.name,
            path: p,
            type: it.isDirectory() ? 'directory' : 'file',
            size: st.size,
            modifiedAt: st.mtimeMs,
          });
          if (it.isDirectory()) await walk(p);
        }
      }
      await walk(abs);
      formatted = all
        .map((e) => {
          const t = e.type === 'directory' ? 'd' : '-';
          return `${t} ${e.size ?? 0}\t${e.path}`;
        })
        .join('\n');
    }

    return {
      success: true,
      output: formatted,
      data: { entries: top.length, path: abs, recursive },
    };
  } catch (e) {
    return {
      success: false,
      output: '',
      error: `List failed: ${(e as Error).message}`,
    };
  }
}

async function doDelete(abs: string): Promise<SkillResult> {
  try {
    const stat = await fsp.stat(abs);
    if (stat.isDirectory()) {
      await fsp.rmdir(abs);
    } else {
      await fsp.unlink(abs);
    }
    return {
      success: true,
      output: `Deleted ${abs}`,
      data: { path: abs },
    };
  } catch (e) {
    return {
      success: false,
      output: '',
      error: `Delete failed: ${(e as Error).message}`,
    };
  }
}

async function doExists(abs: string): Promise<SkillResult> {
  const exists = fs.existsSync(abs);
  return {
    success: true,
    output: exists ? 'true' : 'false',
    data: { exists, path: abs },
  };
}

async function doStat(abs: string): Promise<SkillResult> {
  try {
    const stat = await fsp.stat(abs);
    return {
      success: true,
      output: JSON.stringify({
        path: abs,
        type: stat.isDirectory() ? 'directory' : 'file',
        size: stat.size,
        createdAt: stat.birthtimeMs,
        modifiedAt: stat.mtimeMs,
        accessedAt: stat.atimeMs,
        mode: stat.mode,
      }, null, 2),
      data: {
        path: abs,
        type: stat.isDirectory() ? 'directory' : 'file',
        size: stat.size,
        createdAt: stat.birthtimeMs,
        modifiedAt: stat.mtimeMs,
        accessedAt: stat.atimeMs,
        mode: stat.mode,
      },
    };
  } catch (e) {
    return {
      success: false,
      output: '',
      error: `Stat failed: ${(e as Error).message}`,
    };
  }
}

async function doMkdir(abs: string, recursive: boolean): Promise<SkillResult> {
  try {
    await fsp.mkdir(abs, { recursive });
    return {
      success: true,
      output: `Created directory ${abs}`,
      data: { path: abs, recursive },
    };
  } catch (e) {
    return {
      success: false,
      output: '',
      error: `Mkdir failed: ${(e as Error).message}`,
    };
  }
}

export const fileSystemSkill: SkillDefinition = {
  manifest: manifest(),
  toTool(): LLMTool {
    return {
      type: 'function',
      function: {
        name: 'file_system',
        description: this.manifest.description,
        parameters: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['read', 'write', 'list', 'delete', 'exists', 'stat', 'mkdir'],
              description: 'File operation to perform',
            },
            path: { type: 'string', description: 'Path relative to working directory' },
            content: { type: 'string', description: 'Content for write operation' },
            encoding: { type: 'string', enum: ['utf8', 'base64'], description: 'Encoding for write' },
            recursive: { type: 'boolean', description: 'Recursive flag for mkdir/list' },
          },
          required: ['operation'],
        },
      },
    };
  },
  async execute(rawArgs, ctx): Promise<SkillResult> {
    const args = (rawArgs ?? {}) as unknown as FileSystemArgs;
    const op = args.operation;
    const validOps: FileOp[] = ['read', 'write', 'list', 'delete', 'exists', 'stat', 'mkdir'];
    if (!validOps.includes(op)) {
      return {
        success: false,
        output: '',
        error: `Invalid operation "${op}". Must be one of: ${validOps.join(', ')}`,
      };
    }
    const requested = args.path ?? '.';
    const safe = resolveSafePath(ctx.workingDirectory, requested);
    if (!safe.ok) {
      return { success: false, output: '', error: safe.error };
    }

    switch (op) {
      case 'read':
        return doRead(safe.abs);
      case 'write': {
        if (typeof args.content !== 'string') {
          return { success: false, output: '', error: 'Parameter "content" is required for write operation.' };
        }
        const enc: 'utf8' | 'base64' = args.encoding === 'base64' ? 'base64' : 'utf8';
        return doWrite(safe.abs, args.content, enc);
      }
      case 'list':
        return doList(safe.abs, Boolean(args.recursive));
      case 'delete':
        return doDelete(safe.abs);
      case 'exists':
        return doExists(safe.abs);
      case 'stat':
        return doStat(safe.abs);
      case 'mkdir':
        return doMkdir(safe.abs, Boolean(args.recursive));
      default:
        return { success: false, output: '', error: `Unhandled operation: ${op}` };
    }
  },
};

export default fileSystemSkill;
