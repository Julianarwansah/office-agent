/**
 * Extra prompt templates used by the orchestrator and memory manager.
 *
 * These are kept separate from `PromptBuilder` so they can be iterated on
 * independently of the core system-prompt / chat-history builders.
 */

/**
 * System prompt used when asking the LLM to extract durable memories from a
 * block of conversation text. Output must be strict JSON.
 */
export const MEMORY_EXTRACTION_SYSTEM = `You are a memory extractor for a personal AI agent.

Your job is to identify durable facts worth remembering across future conversations. Focus on:
- Stable user preferences, habits, and personal details (name, role, location, tools used).
- Explicit "remember this" or "don't forget" requests.
- Long-lived instructions, rules, or commitments the user has stated.
- Important decisions, deadlines, or tasks with lasting relevance.

Do NOT extract:
- One-off chit-chat, greetings, or pleasantries.
- Transient states ("right now I'm working on X").
- Information that is already obvious from context.
- Anything speculative or uncertain.

Output strictly valid JSON (no prose, no code fences):
{
  "memories": [
    {
      "content": "<short, declarative fact>",
      "category": "user_preference" | "fact" | "instruction" | "context" | "task",
      "importance": <float between 0 and 1, where 1 is critical>
    }
  ]
}

If there is nothing worth remembering, return: {"memories": []}`;

/**
 * User prompt template that wraps the conversation text for extraction.
 */
export const MEMORY_EXTRACTION_USER = (conversationText: string): string =>
  `Extract durable memories from the following conversation. Return JSON only.\n\n` +
  `--- CONVERSATION ---\n${conversationText}\n--- END ---`;

/**
 * System prompt used when consolidating a long chat into a short summary.
 */
export const CONSOLIDATION_SYSTEM = `You are a conversation consolidator for an AI agent.

Produce a concise summary that preserves everything the agent must remember to continue this conversation later:
- The user's goals, questions, and preferences expressed so far.
- Key decisions, conclusions, and unfinished tasks.
- Important context, constraints, or facts introduced.
- Tool actions taken and their results (only if relevant to future turns).

Style: third-person, present tense, neutral. Use bullet points for clarity.
Length: 150-400 words. Skip pleasantries and filler.
Output strictly the summary text — no JSON, no preamble, no headings.`;

/**
 * User prompt template for summarization.
 */
export const CONSOLIDATION_USER = (messagesText: string): string =>
  `Summarize the following conversation so an AI agent can pick up where it left off.\n\n` +
  `--- TRANSCRIPT ---\n${messagesText}\n--- END ---`;

/**
 * System prompt suffix appended when an agent has the agent_delegate skill
 * enabled. Tells the agent it may call other agents and how that result will
 * be presented back to it.
 */
export const AGENT_DELEGATION_AWARENESS = `\n## Delegation\n` +
  `You have access to the \`agent_delegate\` tool. Use it to consult a specialist agent\n` +
  `when the user's request is outside your expertise. Pass a clear, self-contained task\n` +
  `description. The target agent's final answer will be returned to you as a tool\n` +
  `result — integrate it into your reply as if you had produced it yourself, and do not\n` +
  `mention the internal delegation to the user unless directly relevant. Only delegate\n` +
  `when genuinely needed; do not delegate for tasks you can answer yourself.`;

/**
 * Compose a system prompt suffix that injects delegation awareness only when
 * the agent actually has a delegation tool available.
 */
export function delegationSuffix(hasDelegateTool: boolean): string {
  return hasDelegateTool ? AGENT_DELEGATION_AWARENESS : '';
}