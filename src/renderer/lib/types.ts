import type {
  AgentRole,
  AgentSkill,
  ChatRoom,
  LLMToolCall,
  Memory,
  SenderType,
} from '../../shared/types';

export type * from '../../shared/types';

export interface ChatSendParams {
  chatRoomId: string;
  userMessage: string;
  mentionedAgentIds?: string[];
  agentId?: string;
  parentMessageId?: string;
}

export interface StreamingMessageState {
  agentId: string;
  messageId: string;
  content: string;
  toolCalls: LLMToolCall[];
  toolResults: Array<{
    toolCallId: string;
    toolName: string;
    result: string;
    ok: boolean;
  }>;
  status: 'pending' | 'streaming' | 'tool_call' | 'done' | 'error';
  startedAt: number;
  error?: string;
}

export type StreamingMessagesByChat = Record<string, StreamingMessageState[]>;

export interface StreamingState {
  activeChats: Map<string, StreamingMessageState[]>;
}

export interface AgentFormData {
  id?: string;
  name: string;
  description?: string;
  avatar?: string;
  systemPrompt: string;
  providerId: string;
  teamId?: string;
  role: AgentRole;
  color?: string;
  isLead?: boolean;
  enabledSkills: AgentSkill[];
  temperature?: number;
  maxTokens?: number;
}

export interface TeamFormData {
  id?: string;
  name: string;
  description?: string;
  instructions?: string;
  color?: string;
  avatar?: string;
}

export interface ChatRoomFormData {
  id?: string;
  name: string;
  description?: string;
  teamId?: string;
  type: ChatRoom['type'];
  agentIds: string[];
}

export interface LLMSettingsData {
  id?: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  systemPromptPrefix?: string;
  isDefault?: boolean;
  headers?: Record<string, string>;
}

export interface MemoryFormData {
  id?: string;
  agentId: string;
  type: Memory['type'];
  category: Memory['category'];
  content: string;
  importance: number;
  isPinned?: boolean;
}

export interface SystemInfo {
  platform: NodeJS.Platform | 'web';
  versions: {
    node?: string;
    chrome?: string;
    electron?: string;
    app: string;
  };
  arch: string;
  cpus: number;
  totalMemory: number;
  freeMemory: number;
  hostname: string;
}

export interface NavItem {
  label: string;
  path: string;
  iconName:
    | 'LayoutDashboard'
    | 'MessageSquare'
    | 'Bot'
    | 'Users'
    | 'Wand2'
    | 'Brain'
    | 'FolderOpen'
    | 'Settings'
    | 'Terminal';
}

export interface SenderMeta {
  type: SenderType;
  id: string;
  name?: string;
  color?: string;
  avatar?: string;
}