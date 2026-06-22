import type { LLMTool } from '../../../shared/types';
import type { SkillContext, SkillDefinition, SkillResult } from '../types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type BodyType = 'json' | 'text' | 'form';

function manifest() {
  return {
    name: 'http_request',
    displayName: 'HTTP Request',
    description: 'Make an HTTP request to any URL. Useful for calling APIs.',
    category: 'network',
    version: '1.0.0',
    author: 'Office AI Agent',
    parameters: [
      {
        name: 'method',
        type: 'string' as const,
        description: 'HTTP method',
        required: true,
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      },
      {
        name: 'url',
        type: 'string' as const,
        description: 'Target URL',
        required: true,
      },
      {
        name: 'headers',
        type: 'object' as const,
        description: 'Optional request headers',
        required: false,
      },
      {
        name: 'body',
        type: 'string' as const,
        description: 'Request body as a string (already serialized)',
        required: false,
      },
      {
        name: 'bodyType',
        type: 'string' as const,
        description: 'How to encode the body',
        required: false,
        default: 'text',
        enum: ['json', 'text', 'form'],
      },
      {
        name: 'timeout',
        type: 'number' as const,
        description: 'Timeout in ms',
        required: false,
        default: 30000,
      },
    ],
    requiresApproval: false,
    dangerous: false,
    examples: [
      {
        title: 'GET request',
        input: { method: 'GET', url: 'https://api.github.com/zen' },
      },
    ],
  };
}

interface HttpRequestArgs {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  bodyType?: BodyType;
  timeout?: number;
}

const RESERVED_HEADERS = new Set([
  'content-length',
  'host',
  'connection',
  'cookie',
  'set-cookie',
]);

function safeResponseHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (RESERVED_HEADERS.has(key.toLowerCase())) return;
    out[key] = value;
  });
  return out;
}

export const httpRequestSkill: SkillDefinition = {
  manifest: manifest(),
  toTool(): LLMTool {
    return {
      type: 'function',
      function: {
        name: 'http_request',
        description: this.manifest.description,
        parameters: {
          type: 'object',
          properties: {
            method: {
              type: 'string',
              enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
              description: 'HTTP method',
            },
            url: { type: 'string', description: 'Target URL' },
            headers: { type: 'object', description: 'Request headers' },
            body: { type: 'string', description: 'Request body string' },
            bodyType: { type: 'string', enum: ['json', 'text', 'form'] },
            timeout: { type: 'number', description: 'Timeout in milliseconds' },
          },
          required: ['method', 'url'],
        },
      },
    };
  },
  async execute(rawArgs, ctx): Promise<SkillResult> {
    const args = (rawArgs ?? {}) as unknown as HttpRequestArgs;
    if (!args.url || typeof args.url !== 'string') {
      return { success: false, output: '', error: 'Parameter "url" is required.' };
    }
    let parsed: URL;
    try {
      parsed = new URL(args.url);
    } catch {
      return { success: false, output: '', error: `Invalid URL: ${args.url}` };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        success: false,
        output: '',
        error: `Unsupported URL protocol: ${parsed.protocol}`,
      };
    }

    const method = (args.method || 'GET').toUpperCase() as HttpMethod;
    const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    if (!validMethods.includes(method)) {
      return {
        success: false,
        output: '',
        error: `Unsupported HTTP method: ${method}`,
      };
    }

    const timeoutMs =
      typeof args.timeout === 'number' && args.timeout > 0
        ? Math.min(args.timeout, 5 * 60_000)
        : 30_000;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = ctx.signal
      ? AbortSignal.any([ctx.signal, timeoutSignal])
      : timeoutSignal;

    const headers = new Headers();
    for (const [k, v] of Object.entries(args.headers ?? {})) {
      if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') continue;
      headers.set(k, String(v));
    }

    let body: string | undefined;
    if (args.body !== undefined && args.body !== null) {
      const bodyType: BodyType = args.bodyType ?? 'text';
      if (method === 'GET' || method === 'DELETE') {
        return {
          success: false,
          output: '',
          error: `${method} requests cannot have a body.`,
        };
      }
      switch (bodyType) {
        case 'json':
          if (!headers.has('content-type')) headers.set('content-type', 'application/json');
          body = args.body;
          break;
        case 'form':
          if (!headers.has('content-type'))
            headers.set('content-type', 'application/x-www-form-urlencoded');
          body = args.body;
          break;
        case 'text':
        default:
          if (!headers.has('content-type')) headers.set('content-type', 'text/plain');
          body = args.body;
          break;
      }
    }

    try {
      const fetchInit: RequestInit = {
        method,
        headers,
        redirect: 'follow',
        signal,
      };
      if (body !== undefined) {
        fetchInit.body = body;
      }
      const res = await fetch(parsed.toString(), fetchInit);
      const text = await res.text();
      const contentType = res.headers.get('content-type') ?? '';
      let parsedBody: unknown = text;
      if (contentType.includes('application/json')) {
        try {
          parsedBody = JSON.parse(text);
        } catch {
          // leave as text
        }
      }

      const out = typeof parsedBody === 'string' ? parsedBody : JSON.stringify(parsedBody, null, 2);
      return {
        success: res.ok,
        output: out,
        data: {
          status: res.status,
          statusText: res.statusText,
          headers: safeResponseHeaders(res.headers),
          body: parsedBody,
        },
        error: res.ok ? undefined : `HTTP ${res.status} ${res.statusText}`,
        metadata: { method, url: res.url, contentType, durationMs: 0 },
      };
    } catch (e) {
      const err = e as Error;
      const aborted = err?.name === 'AbortError' || signal.aborted;
      return {
        success: false,
        output: '',
        error: aborted
          ? 'http_request was aborted or timed out'
          : `http_request failed: ${err?.message || String(e)}`,
      };
    }
  },
};

export default httpRequestSkill;
