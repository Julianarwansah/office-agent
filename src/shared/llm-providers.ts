export interface PresetProviderTemplate {
  name: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  description: string;
}

export const PRESET_PROVIDERS: PresetProviderTemplate[] = [
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    description: 'Official OpenAI API (GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo).',
  },
  {
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
    models: ['llama3', 'mistral', 'codellama'],
    description: 'Local Ollama server with OpenAI-compatible endpoint.',
  },
  {
    name: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    models: ['local-model'],
    description: 'LM Studio local inference server.',
  },
  {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o',
    models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-pro-1.5'],
    description: 'OpenRouter unified API for many model providers.',
  },
  {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.1-70b-versatile',
    models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    description: 'Groq ultra-fast LPU inference for open models.',
  },
  {
    name: 'Together',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3-70b-chat-hf',
    models: [
      'meta-llama/Llama-3-70b-chat-hf',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
      'togethercomputer/CodeLlama-34b-Instruct',
    ],
    description: 'Together AI hosted open-source models.',
  },
  {
    name: 'Custom',
    baseUrl: '',
    defaultModel: '',
    models: [],
    description: 'Define a custom OpenAI-compatible endpoint.',
  },
];

export function modelSuggestions(baseUrl: string): string[] {
  const lower = baseUrl.toLowerCase();
  const preset = PRESET_PROVIDERS.find((p) => lower.includes(p.name.toLowerCase()));
  if (preset) return preset.models;
  return [];
}
