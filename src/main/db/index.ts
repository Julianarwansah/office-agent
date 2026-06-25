import Database, { Database as DatabaseType, Statement, Transaction } from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SCHEMA_SQL = `
-- Inline schema mirror of src/main/db/schema.sql. The file is the canonical source
-- and is executed when present; this string is the safety-net fallback so that
-- packaged builds (where .sql is not copied to dist-main) still work.

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
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_skills (
  agent_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  config TEXT,
  PRIMARY KEY (agent_id, skill_name)
);

CREATE TABLE IF NOT EXISTS chatrooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  team_id TEXT,
  type TEXT NOT NULL DEFAULT 'team',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chatroom_agents (
  chatroom_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  PRIMARY KEY (chatroom_id, agent_id)
);

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
  is_streaming INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_messages_chatroom_created ON messages(chatroom_id, created_at);

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
  source_message_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_memories_agent_importance ON memories(agent_id, importance DESC);

CREATE TABLE IF NOT EXISTS conversation_summaries (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  chatroom_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  start_message_id TEXT,
  end_message_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tool_executions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  arguments TEXT,
  result TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error TEXT
);

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

CREATE TABLE IF NOT EXISTS user_skills (
  name TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'productivity',
  version TEXT NOT NULL DEFAULT '1.0.0',
  author TEXT,
  parameters TEXT NOT NULL DEFAULT '[]',
  requires_approval INTEGER NOT NULL DEFAULT 0,
  dangerous INTEGER NOT NULL DEFAULT 0,
  implementation TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_skills_enabled ON user_skills(enabled);

CREATE TABLE IF NOT EXISTS kanban_boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  team_id TEXT,
  owner_agent_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_kanban_boards_team ON kanban_boards(team_id);
CREATE INDEX IF NOT EXISTS idx_kanban_boards_owner ON kanban_boards(owner_agent_id);

CREATE TABLE IF NOT EXISTS kanban_columns (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'todo',
  wip_limit INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kanban_columns_board ON kanban_columns(board_id, position);

CREATE TABLE IF NOT EXISTS kanban_tasks (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  column_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  assignee_agent_id TEXT,
  creator_agent_id TEXT,
  due_date TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  parent_task_id TEXT,
  tags TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE,
  FOREIGN KEY (column_id) REFERENCES kanban_columns(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  FOREIGN KEY (creator_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_task_id) REFERENCES kanban_tasks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_kanban_tasks_board ON kanban_tasks(board_id, position);
CREATE INDEX IF NOT EXISTS idx_kanban_tasks_column ON kanban_tasks(column_id, position);
CREATE INDEX IF NOT EXISTS idx_kanban_tasks_assignee ON kanban_tasks(assignee_agent_id);
CREATE INDEX IF NOT EXISTS idx_kanban_tasks_status ON kanban_tasks(status);

CREATE TABLE IF NOT EXISTS kanban_task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  board_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  from_column_id TEXT,
  to_column_id TEXT,
  agent_id TEXT,
  message TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES kanban_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE,
  FOREIGN KEY (from_column_id) REFERENCES kanban_columns(id) ON DELETE SET NULL,
  FOREIGN KEY (to_column_id) REFERENCES kanban_columns(id) ON DELETE SET NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_kanban_events_task ON kanban_task_events(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_kanban_events_board ON kanban_task_events(board_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  chatroom_id TEXT,
  agent_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
`;

interface PreparedEntry {
  stmt: Statement;
  lastUsed: number;
}

class DatabaseManager {
  private db: DatabaseType | null = null;
  private prepared: Map<string, PreparedEntry> = new Map();
  private dbPath: string | null = null;
  private readonly MAX_PREPARED = 200;

  init(dbPath: string): DatabaseType {
    if (this.db) return this.db;

    const dir = path.dirname(dbPath);
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    db.pragma('temp_store = MEMORY');
    db.pragma('busy_timeout = 5000');

    this.applySchema(db);
    this.applyMigrations(db);

    this.db = db;
    this.dbPath = dbPath;
    return db;
  }

  private applySchema(db: DatabaseType): void {
    const schemaPath = path.join(__dirname, 'schema.sql');
    let schemaSql: string;
    if (fs.existsSync(schemaPath)) {
      schemaSql = fs.readFileSync(schemaPath, 'utf8');
    } else {
      schemaSql = SCHEMA_SQL;
    }
    db.exec(schemaSql);
  }

  private applyMigrations(db: DatabaseType): void {
    // Migration registry: idempotent, applied in order. Each migration runs in a
    // transaction so partial application is not possible.
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      );
    `);

    const applied = new Set<string>(
      db.prepare('SELECT name FROM _migrations').all().map((r: any) => r.name as string),
    );

    const migrations: Array<{ name: string; up: string }> = [
      {
        name: '001_initial_indexes',
        up: `
          CREATE INDEX IF NOT EXISTS idx_messages_chatroom_created ON messages(chatroom_id, created_at);
          CREATE INDEX IF NOT EXISTS idx_memories_agent_importance ON memories(agent_id, importance DESC);
        `,
      },
      {
        name: '002_agent_team_index',
        up: `
          CREATE INDEX IF NOT EXISTS idx_agents_team ON agents(team_id);
        `,
      },
      {
        name: '003_user_skills',
        up: `
          CREATE TABLE IF NOT EXISTS user_skills (
            name TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            category TEXT NOT NULL DEFAULT 'productivity',
            version TEXT NOT NULL DEFAULT '1.0.0',
            author TEXT,
            parameters TEXT NOT NULL DEFAULT '[]',
            requires_approval INTEGER NOT NULL DEFAULT 0,
            dangerous INTEGER NOT NULL DEFAULT 0,
            implementation TEXT NOT NULL DEFAULT '',
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_user_skills_enabled ON user_skills(enabled);
        `,
      },
      {
        name: '004_kanban',
        up: `
          CREATE TABLE IF NOT EXISTS kanban_boards (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            color TEXT,
            team_id TEXT,
            owner_agent_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
            FOREIGN KEY (owner_agent_id) REFERENCES agents(id) ON DELETE SET NULL
          );
          CREATE INDEX IF NOT EXISTS idx_kanban_boards_team ON kanban_boards(team_id);
          CREATE INDEX IF NOT EXISTS idx_kanban_boards_owner ON kanban_boards(owner_agent_id);

          CREATE TABLE IF NOT EXISTS kanban_columns (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL,
            name TEXT NOT NULL,
            position INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'todo',
            wip_limit INTEGER,
            created_at TEXT NOT NULL,
            FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE
          );
          CREATE INDEX IF NOT EXISTS idx_kanban_columns_board ON kanban_columns(board_id, position);

          CREATE TABLE IF NOT EXISTS kanban_tasks (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL,
            column_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'todo',
            priority TEXT NOT NULL DEFAULT 'medium',
            assignee_agent_id TEXT,
            creator_agent_id TEXT,
            due_date TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            parent_task_id TEXT,
            tags TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            completed_at TEXT,
            FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE,
            FOREIGN KEY (column_id) REFERENCES kanban_columns(id) ON DELETE CASCADE,
            FOREIGN KEY (assignee_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
            FOREIGN KEY (creator_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
            FOREIGN KEY (parent_task_id) REFERENCES kanban_tasks(id) ON DELETE SET NULL
          );
          CREATE INDEX IF NOT EXISTS idx_kanban_tasks_board ON kanban_tasks(board_id, position);
          CREATE INDEX IF NOT EXISTS idx_kanban_tasks_column ON kanban_tasks(column_id, position);
          CREATE INDEX IF NOT EXISTS idx_kanban_tasks_assignee ON kanban_tasks(assignee_agent_id);
          CREATE INDEX IF NOT EXISTS idx_kanban_tasks_status ON kanban_tasks(status);

          CREATE TABLE IF NOT EXISTS kanban_task_events (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            board_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            from_column_id TEXT,
            to_column_id TEXT,
            agent_id TEXT,
            message TEXT,
            metadata TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (task_id) REFERENCES kanban_tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (board_id) REFERENCES kanban_boards(id) ON DELETE CASCADE,
            FOREIGN KEY (from_column_id) REFERENCES kanban_columns(id) ON DELETE SET NULL,
            FOREIGN KEY (to_column_id) REFERENCES kanban_columns(id) ON DELETE SET NULL,
            FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
          );
          CREATE INDEX IF NOT EXISTS idx_kanban_events_task ON kanban_task_events(task_id, created_at);
          CREATE INDEX IF NOT EXISTS idx_kanban_events_board ON kanban_task_events(board_id, created_at);
        `,
      },
      {
        name: '005_thread_support',
        up: `
          -- Index untuk mencari replies by parent message
          CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id);
          -- Index untuk thread ordering (parent + created_at)
          CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(parent_id, created_at);
          -- Index untuk mengecek apakah message punya replies (covering index)
          CREATE INDEX IF NOT EXISTS idx_messages_has_replies ON messages(chatroom_id, parent_id) WHERE parent_id IS NOT NULL;
        `,
      },
      {
        name: '006_notifications',
        up: `
          CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL DEFAULT '',
            chatroom_id TEXT,
            agent_id TEXT,
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
          CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
        `,
      },
    ];

    const insert = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');
    const tx = db.transaction((m: { name: string; up: string }) => {
      db.exec(m.up);
      insert.run(m.name, new Date().toISOString());
    });

    for (const m of migrations) {
      if (!applied.has(m.name)) {
        try {
          tx(m);
        } catch (err) {
          // If migration fails because object already exists (e.g. schema.sql
          // already created it), record it as applied so we don't keep retrying.
          if (/already exists/i.test(String((err as Error).message))) {
            insert.run(m.name, new Date().toISOString());
          } else {
            throw err;
          }
        }
      }
    }
  }

  getDatabase(): DatabaseType {
    if (!this.db) throw new Error('Database not initialized. Call initDatabase() first.');
    return this.db;
  }

  isInitialized(): boolean {
    return this.db !== null;
  }

  prepare(sql: string): Statement {
    const existing = this.prepared.get(sql);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing.stmt;
    }
    if (!this.db) throw new Error('Database not initialized.');
    const stmt = this.db.prepare(sql);
    if (this.prepared.size >= this.MAX_PREPARED) {
      // Evict the least-recently-used entry
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [k, v] of this.prepared) {
        if (v.lastUsed < oldestTime) {
          oldestTime = v.lastUsed;
          oldestKey = k;
        }
      }
      if (oldestKey !== null) this.prepared.delete(oldestKey);
    }
    this.prepared.set(sql, { stmt, lastUsed: Date.now() });
    return stmt;
  }

  withTransaction<T>(fn: () => T): T {
    if (!this.db) throw new Error('Database not initialized.');
    const tx: Transaction<(fn: () => T) => T> = this.db.transaction(fn);
    return tx(fn);
  }

  close(): void {
    if (this.db) {
      try {
        this.db.close();
      } finally {
        this.db = null;
        this.dbPath = null;
        this.prepared.clear();
      }
    }
  }

  path(): string | null {
    return this.dbPath;
  }
}

const manager = new DatabaseManager();

export function getDb(): DatabaseType {
  return manager.getDatabase();
}

export function initDatabase(userDataPath: string, filename = 'office-ai-agent.db'): DatabaseType {
  const dbPath = path.join(userDataPath, filename);
  return manager.init(dbPath);
}

export function closeDatabase(): void {
  manager.close();
}

export function withTransaction<T>(fn: () => T): T {
  return manager.withTransaction(fn);
}

export function isDatabaseInitialized(): boolean {
  return manager.isInitialized();
}

export function getDatabasePath(): string | null {
  return manager.path();
}

export { DatabaseManager };
export type { DatabaseType };