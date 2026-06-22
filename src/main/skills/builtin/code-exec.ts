import { spawn } from 'node:child_process';
import type { LLMTool } from '../../../shared/types';
import type { SkillContext, SkillDefinition, SkillResult } from '../types';

type CodeLanguage = 'javascript' | 'python';

function manifest() {
  return {
    name: 'code_exec',
    displayName: 'Code Execution',
    description:
      'Execute a small JavaScript or Python snippet in a sandboxed subprocess. Returns stdout.',
    category: 'system',
    version: '1.0.0',
    author: 'Office AI Agent',
    parameters: [
      {
        name: 'language',
        type: 'string' as const,
        description: 'Programming language',
        required: true,
        enum: ['javascript', 'python'],
      },
      {
        name: 'code',
        type: 'string' as const,
        description: 'Source code to execute',
        required: true,
      },
      {
        name: 'timeout',
        type: 'number' as const,
        description: 'Timeout in ms',
        required: false,
        default: 10000,
      },
    ],
    requiresApproval: true,
    dangerous: true,
    examples: [
      {
        title: 'Run JavaScript',
        input: { language: 'javascript', code: "console.log('hi')" },
      },
    ],
  };
}

interface CodeExecArgs {
  language: CodeLanguage;
  code: string;
  timeout?: number;
}

function runChild(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<{ stdout: string; stderr: string; exitCode: number | null; aborted: boolean }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let aborted = false;

    const child = spawn(cmd, args, {
      cwd,
      env: process.env,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
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
      clearTimeout(timer);
      resolve({ stdout, stderr: stderr + (stderr ? '\n' : '') + err.message, exitCode: null, aborted });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code, aborted });
    });
  });
}

export const codeExecSkill: SkillDefinition = {
  manifest: manifest(),
  toTool(): LLMTool {
    return {
      type: 'function',
      function: {
        name: 'code_exec',
        description: this.manifest.description,
        parameters: {
          type: 'object',
          properties: {
            language: { type: 'string', enum: ['javascript', 'python'] },
            code: { type: 'string', description: 'Source code' },
            timeout: { type: 'number', description: 'Timeout in ms' },
          },
          required: ['language', 'code'],
        },
      },
    };
  },
  async execute(rawArgs, ctx): Promise<SkillResult> {
    const args = (rawArgs ?? {}) as unknown as CodeExecArgs;
    if (args.language !== 'javascript' && args.language !== 'python') {
      return { success: false, output: '', error: 'Parameter "language" must be "javascript" or "python".' };
    }
    if (typeof args.code !== 'string' || !args.code.trim()) {
      return { success: false, output: '', error: 'Parameter "code" is required.' };
    }
    const timeoutMs = typeof args.timeout === 'number' && args.timeout > 0
      ? Math.min(args.timeout, 60_000)
      : 10_000;

    const cwd = ctx.workingDirectory;

    let cmd: string;
    let spawnArgs: string[];
    if (args.language === 'javascript') {
      // Prefer system `node` on PATH; fall back to process.execPath when the
      // bundled binary happens to be Node-compatible (e.g. dev runs). In a
      // packaged Electron app `node` may be missing — the ENOENT branch below
      // surfaces a clear error.
      cmd = 'node';
      spawnArgs = ['-e', args.code];
    } else {
      cmd = process.platform === 'win32' ? 'python' : 'python3';
      spawnArgs = ['-c', args.code];
    }

    try {
      const r = await runChild(cmd, spawnArgs, cwd, timeoutMs, ctx.signal);
      const combined = (r.stdout + (r.stderr ? (r.stdout ? '\n' : '') + r.stderr : '')).trim();
      const ok = !r.aborted && r.exitCode === 0;
      // Distinguish "interpreter missing" (exitCode == null with no output) from
      // an interpreter that ran and produced no output.
      const interpreterMissing =
        r.exitCode === null && !r.stdout && !r.stderr && !r.aborted;
      if (interpreterMissing) {
        return {
          success: false,
          output: '',
          error:
            args.language === 'javascript'
              ? 'Could not find the `node` executable on PATH. Install Node.js to use this skill.'
              : process.platform === 'win32'
                ? 'Could not find the `python` executable on PATH. Install Python and ensure `python` is on PATH.'
                : 'Could not find the `python3` executable on PATH. Install Python 3 and ensure `python3` is on PATH.',
          metadata: { cwd, language: args.language },
        };
      }
      return {
        success: ok,
        output: combined,
        data: { exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr, language: args.language },
        error: r.aborted
          ? 'Code execution was aborted or timed out'
          : ok
            ? undefined
            : `Process exited with code ${r.exitCode}`,
        metadata: { cwd, language: args.language },
      };
    } catch (e) {
      return {
        success: false,
        output: '',
        error: `code_exec failed: ${(e as Error).message}`,
      };
    }
  },
};

export default codeExecSkill;
