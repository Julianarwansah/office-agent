import type { LLMTool } from '../../../shared/types';
import type { SkillContext, SkillDefinition, SkillResult } from '../types';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function manifest() {
  return {
    name: 'web_search',
    displayName: 'Web Search',
    description:
      'Search the web. Returns a list of {title, url, snippet}. Uses DuckDuckGo HTML (no API key required) as default; can be configured.',
    category: 'web',
    version: '1.0.0',
    author: 'Office AI Agent',
    parameters: [
      {
        name: 'query',
        type: 'string' as const,
        description: 'Search query',
        required: true,
      },
      {
        name: 'maxResults',
        type: 'number' as const,
        description: 'Maximum number of results to return',
        required: false,
        default: 10,
      },
    ],
    requiresApproval: false,
    dangerous: false,
    examples: [
      { title: 'Search the web', input: { query: 'typescript skill system design' } },
    ],
  };
}

interface WebSearchArgs {
  query: string;
  maxResults?: number;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function extractResults(html: string, max: number): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  // DuckDuckGo HTML: results live inside <a class="result__a" href="...">...</a>
  // with snippets in <a class="result__snippet" ...> or <td class="result__snippet">
  const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    if (results.length >= max) break;
    let href = decodeHtmlEntities(m[1]);
    if (href.startsWith('//')) href = 'https:' + href;
    try {
      const u = new URL(href);
      // DuckDuckGo sometimes wraps result URLs in a redirect like //duckduckgo.com/l/?uddg=<encoded>
      if (u.hostname.endsWith('duckduckgo.com') && u.pathname.startsWith('/l/')) {
        const real = u.searchParams.get('uddg');
        if (real) href = real;
      }
    } catch {
      // ignore URL parse failures
    }
    const title = stripTags(m[2]);
    if (!title || !href || seen.has(href)) continue;
    seen.add(href);

    // Look for a snippet near this match.
    const tail = html.slice(m.index, m.index + 4000);
    const snippetMatch =
      /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/i.exec(tail) ||
      /<td[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/td>/i.exec(tail);
    const snippet = snippetMatch ? stripTags(snippetMatch[1]) : '';
    results.push({ title, url: href, snippet });
  }

  if (results.length > 0) return results;

  // Fallback: very loose parsing for any <a href="http...">title</a>
  const looseRe = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = looseRe.exec(html)) !== null) {
    if (results.length >= max) break;
    const href = decodeHtmlEntities(m[1]);
    const title = stripTags(m[2]);
    if (!title || title.length < 4) continue;
    if (/duckduckgo\.com/i.test(href)) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    results.push({ title, url: href, snippet: '' });
  }

  return results;
}

export const webSearchSkill: SkillDefinition = {
  manifest: manifest(),
  toTool(): LLMTool {
    return {
      type: 'function',
      function: {
        name: 'web_search',
        description: this.manifest.description,
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            maxResults: { type: 'number', description: 'Maximum number of results' },
          },
          required: ['query'],
        },
      },
    };
  },
  async execute(rawArgs, ctx): Promise<SkillResult> {
    const args = rawArgs as unknown as WebSearchArgs;
    if (!args || typeof args.query !== 'string' || !args.query.trim()) {
      return { success: false, output: '', error: 'Parameter "query" is required.' };
    }
    const max = typeof args.maxResults === 'number' && args.maxResults > 0
      ? Math.min(args.maxResults, 50)
      : 10;

    const timeoutMs = 30_000;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = ctx.signal
      ? AbortSignal.any([ctx.signal, timeoutSignal])
      : timeoutSignal;

    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`;
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!res.ok) {
        return {
          success: false,
          output: '',
          error: `Search HTTP ${res.status} ${res.statusText}`,
          data: { status: res.status },
        };
      }
      const html = await res.text();
      const results = extractResults(html, max);
      if (results.length === 0) {
        return {
          success: true,
          output: `No results found for "${args.query}".`,
          data: { results: [], count: 0 },
        };
      }
      const formatted = results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}${r.snippet ? `\n   ${r.snippet}` : ''}`)
        .join('\n\n');
      return {
        success: true,
        output: formatted,
        data: { results, count: results.length, query: args.query },
        metadata: { source: 'duckduckgo' },
      };
    } catch (e) {
      const err = e as Error;
      const aborted = err?.name === 'AbortError' || signal.aborted;
      return {
        success: false,
        output: '',
        error: aborted
          ? 'web_search was aborted or timed out'
          : `web_search failed: ${err?.message || String(e)}`,
      };
    }
  },
};

export default webSearchSkill;
