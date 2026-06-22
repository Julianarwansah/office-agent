import type { LLMTool } from '../../../shared/types';
import type { SkillContext, SkillDefinition, SkillResult } from '../types';

function manifest() {
  return {
    name: 'web_fetch',
    displayName: 'Fetch Web Page',
    description:
      'Fetch the content of a URL. Returns the raw HTML or text content (up to 50k chars).',
    category: 'web',
    version: '1.0.0',
    author: 'Office AI Agent',
    parameters: [
      {
        name: 'url',
        type: 'string' as const,
        description: 'URL to fetch',
        required: true,
      },
      {
        name: 'format',
        type: 'string' as const,
        description: 'Response format',
        required: false,
        default: 'text',
        enum: ['html', 'text'],
      },
      {
        name: 'maxLength',
        type: 'number' as const,
        description: 'Maximum length of returned content in characters',
        required: false,
        default: 50000,
      },
      {
        name: 'headers',
        type: 'object' as const,
        description: 'Optional HTTP headers to send',
        required: false,
      },
    ],
    requiresApproval: false,
    dangerous: false,
    examples: [
      {
        title: 'Fetch a homepage',
        input: { url: 'https://example.com', format: 'text' },
      },
    ],
  };
}

interface WebFetchArgs {
  url: string;
  format?: 'html' | 'text';
  maxLength?: number;
  headers?: Record<string, string>;
}

function stripHtml(html: string): string {
  let out = html;
  out = out.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  out = out.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  out = out.replace(/<!--([\s\S]*?)-->/g, '');
  out = out.replace(/<\/?[a-zA-Z][^>]*>/g, '');
  out = out
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  out = out.replace(/\s+\n/g, '\n').replace(/[ \t]{2,}/g, ' ');
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

export const webFetchSkill: SkillDefinition = {
  manifest: manifest(),
  toTool(): LLMTool {
    return {
      type: 'function',
      function: {
        name: 'web_fetch',
        description: this.manifest.description,
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to fetch' },
            format: { type: 'string', enum: ['html', 'text'], description: 'Response format' },
            maxLength: { type: 'number', description: 'Maximum characters to return' },
            headers: { type: 'object', description: 'Optional headers' },
          },
          required: ['url'],
        },
      },
    };
  },
  async execute(rawArgs, ctx): Promise<SkillResult> {
    const args = rawArgs as unknown as WebFetchArgs;
    if (!args || typeof args.url !== 'string' || !args.url.trim()) {
      return { success: false, output: '', error: 'Parameter "url" is required.' };
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(args.url);
    } catch {
      return { success: false, output: '', error: `Invalid URL: ${args.url}` };
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return {
        success: false,
        output: '',
        error: `Unsupported URL protocol: ${parsedUrl.protocol}`,
      };
    }

    const format: 'html' | 'text' = args.format === 'html' ? 'html' : 'text';
    const maxLength =
      typeof args.maxLength === 'number' && args.maxLength > 0
        ? Math.min(args.maxLength, 1_000_000)
        : 50_000;

    const timeoutMs = 30_000;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = ctx.signal
      ? AbortSignal.any([ctx.signal, timeoutSignal])
      : timeoutSignal;

    try {
      const response = await fetch(parsedUrl.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; OfficeAIAgent/1.0; +https://example.com)',
          Accept: format === 'html' ? 'text/html,application/xhtml+xml' : 'text/html,text/plain',
          ...(args.headers || {}),
        },
      });

      if (!response.ok) {
        return {
          success: false,
          output: '',
          error: `HTTP ${response.status} ${response.statusText}`,
          data: { status: response.status, url: response.url },
        };
      }

      const raw = await response.text();
      const truncated = raw.length > maxLength;
      const sliced = truncated ? raw.slice(0, maxLength) : raw;
      const content = format === 'html' ? sliced : stripHtml(sliced);

      return {
        success: true,
        output: content,
        data: {
          status: response.status,
          url: response.url,
          contentType: response.headers.get('content-type'),
          length: content.length,
          truncated,
        },
        metadata: { format, maxLength },
      };
    } catch (e) {
      const err = e as Error;
      const aborted = err?.name === 'AbortError' || signal.aborted;
      return {
        success: false,
        output: '',
        error: aborted
          ? 'web_fetch was aborted or timed out'
          : `web_fetch failed: ${err?.message || String(e)}`,
      };
    }
  },
};

export default webFetchSkill;
