const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function initDatabase() {
  const dbPath = path.resolve(process.env.DB_PATH || './data/nexus.db');
  
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Performance optimizations
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('cache_size = -8000'); // 8MB cache

  runMigrations(db);

  return db;
}

function runMigrations(db) {
  db.exec(`
    -- Agents table
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT DEFAULT '',
      avatar_emoji TEXT DEFAULT '🤖',
      provider TEXT DEFAULT '9router',
      model_id TEXT DEFAULT '',
      api_key TEXT DEFAULT '',
      api_endpoint TEXT DEFAULT '',
      system_prompt TEXT DEFAULT '',
      permissions TEXT DEFAULT '{"file_create":true,"file_edit":true,"web_search":true,"create_tasks":true,"read_files":true,"execute_commands":false}',
      status TEXT DEFAULT 'active' CHECK(status IN ('active','paused','offline')),
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 4096,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Projects table
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'planning' CHECK(status IN ('planning','in_progress','review','completed','archived')),
      folder_path TEXT DEFAULT '',
      roadmap TEXT DEFAULT '[]',
      progress_percent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tasks table
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      agent_id INTEGER,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','review_pending','completed','cancelled')),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
      checklist TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      due_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
    );

    -- Messages table (chat history)
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      context_type TEXT NOT NULL CHECK(context_type IN ('project','task','agent','global')),
      context_id INTEGER,
      agent_id INTEGER,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      is_summary INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
    );

    -- Project-Agent assignments
    CREATE TABLE IF NOT EXISTS project_agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      agent_id INTEGER NOT NULL,
      role_in_project TEXT DEFAULT 'collaborator' CHECK(role_in_project IN ('lead','collaborator','reviewer')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
      UNIQUE(project_id, agent_id)
    );

    -- Memories table (Long-term learning)
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER,
      project_id INTEGER,
      title TEXT DEFAULT '',
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    -- Usage log for token tracking
    CREATE TABLE IF NOT EXISTS usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER,
      context_type TEXT,
      context_id INTEGER,
      model TEXT DEFAULT '',
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_context ON messages(context_type, context_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_agent ON messages(agent_id);
    CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
    CREATE INDEX IF NOT EXISTS idx_project_agents_project ON project_agents(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_agents_agent ON project_agents(agent_id);
    CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_id);
    CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id);
    CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
    CREATE INDEX IF NOT EXISTS idx_usage_agent ON usage_log(agent_id);
    CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_model ON usage_log(model);
  `);

  // Safe migrations for existing DBs
  const safeAlter = (sql) => { try { db.prepare(sql).run(); } catch(e) {} };
  
  safeAlter("ALTER TABLE messages ADD COLUMN is_summary INTEGER DEFAULT 0");
  safeAlter("ALTER TABLE messages ADD COLUMN archived INTEGER DEFAULT 0");
  safeAlter("ALTER TABLE tasks ADD COLUMN tags TEXT DEFAULT '[]'");
}

module.exports = { initDatabase };
