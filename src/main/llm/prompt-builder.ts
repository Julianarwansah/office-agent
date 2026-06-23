import type {
  Agent,
  LLMMessage,
  Memory,
  Message,
} from '../../shared/types';

const MEMORY_TRIGGER_PATTERNS: RegExp[] = [
  /\bremember\b/i,
  /\bdon'?t forget\b/i,
  /\bmy name is\b/i,
  /\bi (?:am|'m) called\b/i,
  /\bi (?:prefer|like|love|hate|dislike)\b/i,
  /\bi (?:always|never)\b/i,
  /\bcall me\b/i,
  /\bmy (?:favorite|favourite|preferred)\b/i,
  /\bmy (?:email|phone|address|birthday)\b/i,
  /\bi work (?:at|for|on)\b/i,
  /\bi live in\b/i,
  /\bi (?:use|am using)\b/i,
  /\bnote (?:that|this)\b/i,
  /\bkeep in mind\b/i,
  /\bimportant(?: that)?\b/i,
];

const CATEGORY_RULES: Array<{ category: Memory['category']; pattern: RegExp }> = [
  { category: 'user_preference', pattern: /\bprefer|like|love|hate|dislike|favorite|favourite/i },
  { category: 'instruction', pattern: /\balways|never|don'?t|must|should|remember\b/i },
  { category: 'task', pattern: /\btask|todo|to-do|deadline|due\b/i },
  { category: 'fact', pattern: /\bmy name|i am|i work|i live|my email|my phone/i },
];

function importanceFor(text: string): number {
  let score = 0.5;
  if (/\b(always|never|must)\b/i.test(text)) score += 0.2;
  if (/\b(my name is|call me|i am)\b/i.test(text)) score += 0.15;
  if (/\b(important|critical|urgent)\b/i.test(text)) score += 0.15;
  if (text.length < 20) score -= 0.1;
  if (text.length > 200) score += 0.05;
  return Math.max(0.1, Math.min(1, score));
}

function categoryFor(text: string): Memory['category'] {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule.category;
  }
  return 'context';
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export interface ExtractedMemory {
  content: string;
  category: Memory['category'];
  importance: number;
}

export function extractMemoriesViaHeuristic(text: string): ExtractedMemory[] {
  if (!text || typeof text !== 'string') return [];
  const sentences = splitSentences(text);
  const out: ExtractedMemory[] = [];
  const seen = new Set<string>();
  for (const sentence of sentences) {
    const matched = MEMORY_TRIGGER_PATTERNS.some((re) => re.test(sentence));
    if (!matched) continue;
    const clean = sentence.replace(/^[\s"'“”\-–—]+|[\s"'“”\-–—]+$/g, '').trim();
    if (!clean || clean.length < 4) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      content: clean,
      category: categoryFor(clean),
      importance: importanceFor(clean),
    });
    if (out.length >= 5) break;
  }
  if (out.length === 0 && text.trim().length > 0) {
    const sample = text.trim().slice(0, 200);
    out.push({
      content: sample,
      category: 'context',
      importance: 0.3,
    });
  }
  return out;
}

export function extractMemories(text: string): ExtractedMemory[] {
  return extractMemoriesViaHeuristic(text);
}

const DEFAULT_CONTEXT_WINDOW = 8000;
const APPROX_CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}

function estimateMessageTokens(m: LLMMessage): number {
  let chars = 0;
  if (typeof m.content === 'string') chars += m.content.length;
  if (m.toolCalls) {
    for (const tc of m.toolCalls) {
      chars += tc.function.name.length + tc.function.arguments.length + 16;
    }
  }
  if (m.name) chars += m.name.length;
  return Math.ceil(chars / APPROX_CHARS_PER_TOKEN) + 4;
}

export interface BuildSystemPromptOptions {
  agent: Agent;
  memories: Memory[];
  teamInstructions?: string;
  systemPromptPrefix?: string;
  now?: Date;
  hasTools?: boolean;
}

export function buildSystemPrompt(opts: BuildSystemPromptOptions): string {
  const { agent, memories, teamInstructions, systemPromptPrefix, now, hasTools } = opts;
  const sections: string[] = [];

  if (systemPromptPrefix && systemPromptPrefix.trim().length > 0) {
    sections.push(systemPromptPrefix.trim());
  }

  sections.push(`You are ${agent.name}.`);
  if (agent.description) {
    sections.push(agent.description.trim());
  }
  if (agent.systemPrompt && agent.systemPrompt.trim().length > 0) {
    sections.push(agent.systemPrompt.trim());
  }

  if (teamInstructions && teamInstructions.trim().length > 0) {
    sections.push(`## Team Instructions\n${teamInstructions.trim()}`);
  }

  if (memories && memories.length > 0) {
    const sorted = [...memories]
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        if (b.importance !== a.importance) return b.importance - a.importance;
        return b.lastAccessedAt - a.lastAccessedAt;
      })
      .slice(0, 10);
    const lines = sorted.map(
      (m, i) => `${i + 1}. [${m.category}] ${m.content}`,
    );
    sections.push(`## Memory\n${lines.join('\n')}`);
  }

  if (hasTools) {
    sections.push(
      `## Tool Usage\n` +
      `Only call tools when the user's request genuinely requires it (running code, fetching URLs, executing commands, performing calculations, etc.).\n` +
      `For greetings, casual conversation, simple questions, or anything you can answer from knowledge — respond directly WITHOUT calling any tool.\n` +
      `Never call a tool just because it is available. Prefer a direct answer whenever possible.`,
    );
  } else {
    sections.push(
      `## Response Mode\n` +
      `No tools are available right now. Respond directly and conversationally based on your knowledge.\n` +
      `Do NOT attempt to delegate, run commands, search the web, or call any tool — simply give a helpful, direct answer.\n` +
      `You MUST always write a response. Never return an empty reply.`,
    );
  }

  const date = now ?? new Date();
  const isoDate = date.toISOString().split('T')[0];
  const time = date.toTimeString().split(' ')[0];
  sections.push(`## Current Time\n${isoDate} ${time} (UTC offset ${date.getTimezoneOffset()} min)`);

  return sections.join('\n\n');
}

export interface BuildChatMessagesOptions {
  systemPrompt: string;
  history: Message[];
  userMessage: string;
  toolDefinitions?: unknown;
  maxContextTokens?: number;
  maxOutputTokens?: number;
}

function messageToLLM(m: Message): LLMMessage | null {
  const role = m.role ?? (m.senderType === 'user' ? 'user' : m.senderType === 'agent' ? 'assistant' : 'system');
  if (role === 'system') {
    return { role: 'system', content: m.content };
  }
  if (role === 'tool') {
    return {
      role: 'tool',
      content: m.content,
      toolCallId: m.toolCallId,
      name: m.senderId,
    };
  }
  if (role === 'assistant') {
    return {
      role: 'assistant',
      content: m.content,
      toolCalls: m.toolCalls,
    };
  }
  return { role: 'user', content: m.content, name: m.senderId };
}

export function buildChatMessages(opts: BuildChatMessagesOptions): LLMMessage[] {
  const {
    systemPrompt,
    history,
    userMessage,
    maxContextTokens = DEFAULT_CONTEXT_WINDOW,
    maxOutputTokens = 1024,
  } = opts;

  const out: LLMMessage[] = [];
  if (systemPrompt && systemPrompt.trim().length > 0) {
    out.push({ role: 'system', content: systemPrompt });
  }

  const mapped: LLMMessage[] = [];
  for (const m of history) {
    const llm = messageToLLM(m);
    if (llm) mapped.push(llm);
  }

  let usedTokens = estimateMessageTokens(out[0] ?? { role: 'system', content: '' });
  const userMsg: LLMMessage = { role: 'user', content: userMessage };
  const userTokens = estimateMessageTokens(userMsg);
  const reserve = maxOutputTokens + userTokens + 64;
  const budget = Math.max(256, maxContextTokens - reserve);

  const kept: LLMMessage[] = [];
  for (let i = mapped.length - 1; i >= 0; i--) {
    const t = estimateMessageTokens(mapped[i]);
    if (usedTokens + t > budget) break;
    kept.unshift(mapped[i]);
    usedTokens += t;
  }

  out.push(...kept);
  out.push(userMsg);
  return out;
}

export const PromptBuilder = {
  buildSystemPrompt,
  buildChatMessages,
  extractMemories,
  extractMemoriesViaHeuristic,
};

export default PromptBuilder;
