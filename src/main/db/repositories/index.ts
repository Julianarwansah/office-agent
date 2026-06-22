import { LLMProviderRepository, llmProviders } from './llm-providers';
import { TeamRepository, teams } from './teams';
import { AgentRepository, agents } from './agents';
import { ChatRoomRepository, chatrooms } from './chatrooms';
import { MessageRepository, messages } from './messages';
import { MemoryRepository, memories } from './memories';
import {
  ConversationSummaryRepository,
  summaries,
} from './summaries';
import { ToolExecutionRepository, toolExecutions } from './tool-executions';
import { SettingsRepository, settings, DEFAULT_APP_SETTINGS } from './settings';
import { WorkspaceRepository, workspaces } from './workspaces';
import { UserSkillRepository, userSkills } from './user-skills';
import { KanbanRepository, kanban } from './kanban';
import type {
  BoardCreateInput,
  BoardUpdateInput,
  ColumnCreateInput,
  ColumnUpdateInput,
  TaskCreateInput,
  TaskUpdateInput,
  EventCreateInput,
} from './kanban';

export {
  LLMProviderRepository,
  llmProviders,
  TeamRepository,
  teams,
  AgentRepository,
  agents,
  ChatRoomRepository,
  chatrooms,
  MessageRepository,
  messages,
  MemoryRepository,
  memories,
  ConversationSummaryRepository,
  summaries,
  ToolExecutionRepository,
  toolExecutions,
  SettingsRepository,
  settings,
  DEFAULT_APP_SETTINGS,
  WorkspaceRepository,
  workspaces,
  UserSkillRepository,
  userSkills,
  KanbanRepository,
  kanban,
};

export type {
  BoardCreateInput,
  BoardUpdateInput,
  ColumnCreateInput,
  ColumnUpdateInput,
  TaskCreateInput,
  TaskUpdateInput,
  EventCreateInput,
};

export interface Repositories {
  llmProviders: LLMProviderRepository;
  teams: TeamRepository;
  agents: AgentRepository;
  chatrooms: ChatRoomRepository;
  messages: MessageRepository;
  memories: MemoryRepository;
  summaries: ConversationSummaryRepository;
  toolExecutions: ToolExecutionRepository;
  settings: SettingsRepository;
  workspaces: WorkspaceRepository;
  userSkills: UserSkillRepository;
  kanban: KanbanRepository;
}

export function getRepositories(): Repositories {
  // Late-bind the agents repository onto the chatrooms repository so that
  // `type === 'global'` chatrooms can resolve their dynamic membership.
  chatrooms.setAgentsRepository(agents);
  return {
    llmProviders,
    teams,
    agents,
    chatrooms,
    messages,
    memories,
    summaries,
    toolExecutions,
    settings,
    workspaces,
    userSkills,
    kanban,
  };
}
