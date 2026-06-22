/**
 * User-script skill runner.
 *
 * User-defined skills consist of a SkillManifest + a JavaScript
 * implementation body. The implementation is a small async function that
 * receives the validated `args` object and a narrowed `ctx`, and must
 * return (or throw) a SkillResult-shaped value:
 *
 *   return { success: true, output: '…' };
 *   return { success: false, output: '', error: '…' };
 *
 * The body is run inside a Node `vm` context with a deliberately
 * restricted sandbox. We allow the user to:
 *   - Read/write the `args` and `ctx` objects.
 *   - Use built-in helpers: JSON, Math, Date, Object, Array, String,
 *     Number, Boolean, RegExp, Error, Map, Set, Promise, console.
 *   - Make network requests via a `fetch` wrapper that respects
 *     `ctx.signal` and a short timeout.
 *   - Sleep via `sleep(ms)`.
 *   - Mark progress via `progress(msg)`.
 *
 * Anything else (require, process, fs, child_process, etc.) is *not*
 * available. This is a "best-effort" sandbox — it's not a hard security
 * boundary (the script is local user code), but it keeps accidental
 * damage to a minimum.
 */

import { createRequire } from 'node:module';
import vm from 'node:vm';
import type { LLMTool } from '../../shared/types';
import type { SkillContext, SkillDefinition, SkillResult } from './types';
import type { SkillManifest } from '../../shared/skills-schema';

const MAX_EXECUTION_MS = 30_000;
const MAX_OUTPUT_BYTES = 256 * 1024;

function clampOutput(s: string): string {
  if (typeof s !== 'string') return String(s ?? '');
  if (s.length <= MAX_OUTPUT_BYTES) return s;
  return s.slice(0, MAX_OUTPUT_BYTES) + `\n…(truncated, ${s.length - MAX_OUTPUT_BYTES} more bytes)`;
}

function normalizeResult(value: unknown): SkillResult {
  if (value === null || value === undefined) {
    return { success: false, output: '', error: 'Script returned no result' };
  }
  if (typeof value === 'string') {
    return { success: true, output: value };
  }
  if (typeof value !== 'object') {
    return { success: true, output: String(value) };
  }
  const obj = value as Record<string, unknown>;
  const success = obj.success === true;
  const outputRaw = obj.output;
  const output =
    typeof outputRaw === 'string'
      ? outputRaw
      : outputRaw === undefined || outputRaw === null
        ? ''
        : typeof outputRaw === 'object'
          ? JSON.stringify(outputRaw)
          : String(outputRaw);
  const errorVal = obj.error;
  const error = typeof errorVal === 'string' ? errorVal : undefined;
  const data = obj.data;
  const metadataRaw = obj.metadata;
  const metadata =
    metadataRaw && typeof metadataRaw === 'object' && !Array.isArray(metadataRaw)
      ? (metadataRaw as Record<string, unknown>)
      : undefined;
  return {
    success,
    output: clampOutput(output),
    error,
    data,
    metadata,
  };
}

interface SandboxGlobals {
  args: Record<string, unknown>;
  ctx: {
    agent: { id: string; name: string; role: string };
    chatRoomId: string;
    messageId: string;
    workingDirectory: string;
  };
  console: Pick<Console, 'log' | 'info' | 'warn' | 'error' | 'debug'>;
  fetch: typeof fetch;
  AbortSignal: typeof AbortSignal;
  JSON: typeof JSON;
  Math: typeof Math;
  Date: typeof Date;
  Object: typeof Object;
  Array: typeof Array;
  String: typeof String;
  Number: typeof Number;
  Boolean: typeof Boolean;
  RegExp: typeof RegExp;
  Error: typeof Error;
  TypeError: typeof TypeError;
  RangeError: typeof RangeError;
  Map: typeof Map;
  Set: typeof Set;
  Promise: typeof Promise;
  Symbol: typeof Symbol;
  parseInt: typeof parseInt;
  parseFloat: typeof parseFloat;
  isNaN: typeof isNaN;
  isFinite: typeof isFinite;
  encodeURIComponent: typeof encodeURIComponent;
  decodeURIComponent: typeof decodeURIComponent;
  sleep: (ms: number) => Promise<void>;
  progress: (msg: string) => void;
}

function buildSandbox(globals: SandboxGlobals): vm.Context {
  return vm.createContext(globals, {
    name: 'user-skill-sandbox',
    codeGeneration: { strings: false, wasm: false },
  });
}

function wrappedFetch(baseSignal?: AbortSignal): typeof fetch {
  return (async (input: unknown, init?: RequestInit) => {
    const mergedSignal = baseSignal
      ? init?.signal
        ? AbortSignal.any([baseSignal, init.signal])
        : baseSignal
      : init?.signal;
    const timeout = AbortSignal.timeout(30_000);
    const finalSignal = mergedSignal
      ? AbortSignal.any([mergedSignal, timeout])
      : timeout;
    return fetch(input as never, { ...(init ?? {}), signal: finalSignal });
  }) as unknown as typeof fetch;
}

function sleepImpl(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (typeof t.unref === 'function') t.unref();
  });
}

/**
 * Compile a user-supplied script body into an async function with the
 * sandboxed closure in scope. Throws a clear error if the body fails to
 * parse.
 */
function compileScript(body: string): (sandbox: SandboxGlobals) => Promise<unknown> {
  // We wrap the body in an async function so it can `await` and `return`.
  const wrapped = `"use strict"; return (async () => {\n${body}\n})();`;
  let script: vm.Script;
  try {
    script = new vm.Script(wrapped, { filename: 'user-skill.js' });
  } catch (e) {
    throw new Error(`Failed to parse user skill implementation: ${(e as Error).message}`);
  }
  return (sandbox) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`User skill exceeded ${MAX_EXECUTION_MS}ms wall-clock budget`));
      }, MAX_EXECUTION_MS);
      try {
        const result = script.runInContext(buildSandbox(sandbox), {
          timeout: MAX_EXECUTION_MS,
          displayErrors: true,
        });
        Promise.resolve(result).then(
          (v) => {
            clearTimeout(timer);
            resolve(v);
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          },
        );
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
}

/**
 * Convert a SkillParameter list to a JSON-Schema-flavoured function
 * descriptor that we hand to the LLM.
 */
function parametersToToolParams(
  manifest: SkillManifest,
): { type: 'object'; properties: Record<string, unknown>; required: string[] } {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of manifest.parameters ?? []) {
    const base: Record<string, unknown> = {
      type: p.type === 'array' ? 'array' : p.type,
      description: p.description,
    };
    if (p.enum && p.enum.length > 0) base.enum = p.enum;
    if (p.default !== undefined) base.default = p.default;
    properties[p.name] = base;
    if (p.required) required.push(p.name);
  }
  return { type: 'object', properties, required };
}

/**
 * Build a SkillDefinition from a stored user skill. The implementation
 * is compiled lazily; the returned definition is safe to register in
 * the SkillRegistry and to dispatch through the normal SkillExecutor
 * pipeline.
 */
export function buildUserScriptSkill(input: {
  manifest: SkillManifest;
  implementation: string;
  /** Optional human-readable author/owner for diagnostic messages. */
  owner?: string;
}): SkillDefinition {
  const { manifest, implementation, owner } = input;

  // Pre-compile eagerly so syntax errors surface at registration time,
  // not on first invocation.
  let compiled: ((sandbox: SandboxGlobals) => Promise<unknown>) | null = null;
  let compileError: string | null = null;
  try {
    if (!implementation || !implementation.trim()) {
      compileError = 'No implementation provided';
    } else {
      compiled = compileScript(implementation);
    }
  } catch (e) {
    compileError = (e as Error).message;
  }

  return {
    manifest,
    toTool(): LLMTool {
      return {
        type: 'function',
        function: {
          name: manifest.name,
          description: manifest.description,
          parameters: parametersToToolParams(manifest),
        },
      };
    },
    async execute(args, ctx): Promise<SkillResult> {
      if (compileError) {
        return { success: false, output: '', error: compileError };
      }
      if (!compiled) {
        return {
          success: false,
          output: '',
          error: 'User skill was not compiled correctly',
        };
      }
      if (ctx.signal?.aborted) {
        return { success: false, output: '', error: 'Aborted before execution' };
      }

      const sandbox: SandboxGlobals = {
        args: (args ?? {}) as Record<string, unknown>,
        ctx: {
          agent: { id: ctx.agent.id, name: ctx.agent.name, role: ctx.agent.role },
          chatRoomId: ctx.chatRoomId,
          messageId: ctx.messageId,
          workingDirectory: ctx.workingDirectory,
        },
        console: {
          log: (...a: unknown[]) => console.log(`[skill:${manifest.name}]`, ...a),
          info: (...a: unknown[]) => console.info(`[skill:${manifest.name}]`, ...a),
          warn: (...a: unknown[]) => console.warn(`[skill:${manifest.name}]`, ...a),
          error: (...a: unknown[]) => console.error(`[skill:${manifest.name}]`, ...a),
          debug: (...a: unknown[]) => console.debug(`[skill:${manifest.name}]`, ...a),
        },
        fetch: wrappedFetch(ctx.signal),
        AbortSignal,
        JSON,
        Math,
        Date,
        Object,
        Array,
        String,
        Number,
        Boolean,
        RegExp,
        Error,
        TypeError,
        RangeError,
        Map,
        Set,
        Promise,
        Symbol,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURIComponent,
        decodeURIComponent,
        sleep: sleepImpl,
        progress: (msg: string) => {
          if (typeof ctx.onProgress === 'function') ctx.onProgress(msg);
        },
      };

      try {
        const value = await compiled(sandbox);
        return normalizeResult(value);
      } catch (e) {
        const err = e as Error;
        return {
          success: false,
          output: '',
          error: `User skill "${manifest.name}" threw: ${err?.message ?? String(e)}`,
          metadata: { owner, kind: 'user-script' },
        };
      }
    },
  };
}

/**
 * Lightweight "test runner" that executes a user skill outside of the
 * orchestrator pipeline, used by the IPC `SKILL.TEST` handler to let
 * users dry-run their script.
 */
export async function dryRunUserSkill(input: {
  manifest: SkillManifest;
  implementation: string;
  args: Record<string, unknown>;
  workingDirectory: string;
  signal?: AbortSignal;
}): Promise<SkillResult> {
  const def = buildUserScriptSkill({
    manifest: input.manifest,
    implementation: input.implementation,
  });
  const ctx: SkillContext = {
    agent: {
      id: 'test-agent',
      name: 'Test Agent',
      description: '',
      systemPrompt: '',
      providerId: '',
      role: 'observer',
      enabledSkills: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    chatRoomId: 'test-chatroom',
    messageId: 'test-message',
    workingDirectory: input.workingDirectory,
    signal: input.signal,
  };
  return def.execute(input.args, ctx);
}

// We deliberately don't export `createRequire` — kept here only as a
// reminder that `require` is *not* exposed to the sandbox.
void createRequire;
