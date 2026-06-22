import { spawn } from 'node:child_process';
import type { LLMTool } from '../../../shared/types';
import type {
  SkillContext,
  SkillDefinition,
  SkillResult,
} from '../types';

function manifest() {
  return {
    name: 'terminal',
    displayName: 'Run Terminal Command',
    description:
      "Execute a shell command on the user's local machine in the agent's working directory. Returns stdout/stderr/exit code. Use with caution.",
    category: 'system',
    version: '1.0.0',
    author: 'Office AI Agent',
    parameters: [
      {
        name: 'command',
        type: 'string' as const,
        description: 'Shell command to execute',
        required: true,
      },
      {
        name: 'cwd',
        type: 'string' as const,
        description: 'Override working directory for the command',
        required: false,
      },
      {
        name: 'timeout',
        type: 'number' as const,
        description: 'Timeout in milliseconds',
        required: false,
        default: 30000,
      },
    ],
    requiresApproval: true,
    dangerous: true,
    examples: [
      {
        title: 'List files',
        description: 'List the files in the current working directory',
        input: { command: 'ls -la' },
      },
    ],
  };
}

interface TerminalArgs {
  command: string;
  cwd?: string;
  timeout?: number;
}

function isWindows(): boolean {
  return process.platform === 'win32';
}

function runProcess(
  command: string,
  cwd: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<{ stdout: string; stderr: string; exitCode: number | null; durationMs: number; aborted: boolean }> {
  return new Promise((resolve) => {
    const started = Date.now();
    const useCmd = isWindows();
    const shell = useCmd ? 'cmd.exe' : '/bin/sh';
    const shellArgs = useCmd ? ['/c', command] : ['-c', command];

    const child = spawn(shell, shellArgs, {
      cwd,
      env: process.env,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let aborted = false;

    const timeout = setTimeout(() => {
      aborted = true;
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
    }, timeoutMs);

    if (signal) {
      if (signal.aborted) {
        aborted = true;
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
      } else {
        signal.addEventListener('abort', () => {
          aborted = true;
          try { child.kill('SIGKILL'); } catch { /* ignore */ }
        }, { once: true });
      }
    }

    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString('utf8'); });
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });

    child.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr: stderr + (stderr ? '\n' : '') + err.message,
        exitCode: null,
        durationMs: Date.now() - started,
        aborted,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr,
        exitCode: code,
        durationMs: Date.now() - started,
        aborted,
      });
    });
  });
}

export const terminalSkill: SkillDefinition = {
  manifest: manifest(),
  toTool(): LLMTool {
    return {
      type: 'function',
      function: {
        name: 'terminal',
        description: this.manifest.description,
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Shell command to execute',
            },
            cwd: {
              type: 'string',
              description: 'Override working directory for the command',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds (default 30000)',
            },
          },
          required: ['command'],
        },
      },
    };
  },
  async execute(rawArgs, ctx): Promise<SkillResult> {
    const args = rawArgs as unknown as TerminalArgs;
    if (!args || typeof args.command !== 'string' || !args.command.trim()) {
      return {
        success: false,
        output: '',
        error: 'Parameter "command" is required and must be a non-empty string.',
      };
    }

    const cwd = args.cwd && args.cwd.trim() ? args.cwd : ctx.workingDirectory;
    const timeoutMs =
      typeof args.timeout === 'number' && args.timeout > 0
        ? Math.min(args.timeout, 10 * 60_000)
        : 30_000;

    try {
      const r = await runProcess(args.command, cwd, timeoutMs, ctx.signal);
      const combined = (r.stdout + (r.stderr ? (r.stdout ? '\n' : '') + r.stderr : '')).trim();
      if (r.aborted) {
        return {
          success: false,
          output: combined,
          data: { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr, durationMs: r.durationMs },
          error: 'Command was aborted or timed out',
          metadata: { durationMs: r.durationMs, cwd },
        };
      }
      const ok = r.exitCode === 0;
      return {
        success: ok,
        output: combined,
        data: { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr, durationMs: r.durationMs },
        error: ok ? undefined : `Command exited with code ${r.exitCode}`,
        metadata: { durationMs: r.durationMs, cwd },
      };
    } catch (e) {
      return {
        success: false,
        output: '',
        error: `Terminal skill failed: ${(e as Error).message}`,
      };
    }
  },
};

export default terminalSkill;
