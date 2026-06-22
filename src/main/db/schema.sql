-- Office AI Agent database schema
-- All IDs are TEXT (UUIDs). Timestamps stored as ISO 8601 TEXT.

CREATE TABLE IF NOT EXISTS llm_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_encrypted TEXT,
  model TEXT NOT NULL,
  temperature REAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,
  top_p REAL DEFAULT 1.0,
  system_prompt_prefix TEXT,
  is_default INTEGER DEFAULT 0,
  headers TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_llm_providers_default ON llm_providers(is_default);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  color TEXT,
  avatar TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar TEXT,
  system_prompt TEXT NOT NULL DEFAULT '',
  provider_id TEXT NOT NULL,
  team_id TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  color TEXT,
  is_lead INTEGER NOT NULL DEFAULT 0,
  temperature REAL,
  max_tokens INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (provider_id) REFERENCES llm_providers(id) ON DELETE RESTRICT,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_agents_team ON agents(team_id);
CREATE INDEX IF NOT EXISTS idx_agents_provider ON agents(provider_id);

CREATE TABLE IF NOT EXISTS agent_skills (
  agent_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  config TEXT,
  PRIMARY KEY (agent_id, skill_name),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_skills_agent ON agent_skills(agent_id);

CREATE TABLE IF NOT EXISTS chatrooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  team_id TEXT,
  type TEXT NOT NULL DEFAULT 'team',
  created_at TEXT NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chatrooms_team ON chatrooms(team_id);

CREATE TABLE IF NOT EXISTS chatroom_agents (
  chatroom_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  PRIMARY KEY (chatroom_id, agent_id),
  FOREIGN KEY (chatroom_id) REFERENCES chatrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chatroom_agents_agent ON chatroom_agents(agent_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chatroom_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  role TEXT,
  tool_calls TEXT,
  tool_call_id TEXT,
  parent_id TEXT,
  created_at TEXT NOT NULL,
  metadata TEXT,
  is_streaming INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (chatroom_id) REFERENCES chatrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_chatroom_created ON messages(chatroom_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'long_term',
  content TEXT NOT NULL,
  importance REAL NOT NULL DEFAULT 0.5,
  category TEXT,
  created_at TEXT NOT NULL,
  last_accessed_at TEXT NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  source_message_id TEXT,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (source_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_agent_importance ON memories(agent_id, importance DESC);
CREATE INDEX IF NOT EXISTS idx_memories_agent_pinned ON memories(agent_id, is_pinned);
CREATE INDEX IF NOT EXISTS idx_memories_agent_type ON memories(agent_id, type);
CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(agent_id, category);

CREATE TABLE IF NOT EXISTS conversation_summaries (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  chatroom_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  start_message_id TEXT,
  end_message_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (chatroom_id) REFERENCES chatrooms(id) ON DELETE CASCADE,
  FOREIGN KEY (start_message_id) REFERENCES messages(id) ON DELETE SET NULL,
  FOREIGN KEY (end_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_summaries_agent ON conversation_summaries(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_summaries_chatroom ON conversation_summaries(chatroom_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tool_executions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  arguments TEXT,
  result TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tool_exec_message ON tool_executions(message_id);
CREATE INDEX IF NOT EXISTS idx_tool_exec_status ON tool_executions(status);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspaces_default ON workspaces(is_default);

-- Only one default LLM provider at a time
CREATE TRIGGER IF NOT EXISTS trg_llm_providers_single_default
BEFORE UPDATE OF is_default ON llm_providers
WHEN NEW.is_default = 1
BEGIN
  UPDATE llm_providers SET is_default = 0
   WHERE id != NEW.id AND is_default = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_llm_providers_single_default_insert
BEFORE INSERT ON llm_providers
WHEN NEW.is_default = 1
BEGIN
  UPDATE llm_providers SET is_default = 0 WHERE is_default = 1;
END;

-- Only one default workspace at a time
CREATE TRIGGER IF NOT EXISTS trg_workspaces_single_default
BEFORE UPDATE OF is_default ON workspaces
WHEN NEW.is_default = 1
BEGIN
  UPDATE workspaces SET is_default = 0 WHERE id != NEW.id AND is_default = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_workspaces_single_default_insert
BEFORE INSERT ON workspaces
WHEN NEW.is_default = 1
BEGIN
  UPDATE workspaces SET is_default = 0 WHERE is_default = 1;
END;