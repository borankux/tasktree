import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/tasktree.db');

const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_USERNAME = 'mirzat';

function hashSync(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(password, salt, 32);
  return `${salt}:${key.toString('hex')}`;
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dir = path.dirname(DB_PATH);
  fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  // Step 1: Create tables (IF NOT EXISTS — no-op if table already exists)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      parent_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','done','dropped')),
      position_x REAL NOT NULL DEFAULT 0,
      position_y REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      edge_label TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      label TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_nodes_project ON nodes(project_id);
    CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);
    CREATE INDEX IF NOT EXISTS idx_edges_project ON edges(project_id);

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6B7280',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, name)
    );

    CREATE TABLE IF NOT EXISTS node_tags (
      node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (node_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS views (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      layout_config TEXT DEFAULT '{}',
      is_default INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(project_id, name)
    );

    CREATE TABLE IF NOT EXISTS view_nodes (
      view_id TEXT NOT NULL REFERENCES views(id) ON DELETE CASCADE,
      node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      parent_id TEXT,
      sort_order INTEGER,
      position_x REAL,
      position_y REAL,
      edge_label TEXT,
      PRIMARY KEY (view_id, node_id)
    );

    CREATE TABLE IF NOT EXISTS filter_presets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      config TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tags_project ON tags(project_id);
    CREATE INDEX IF NOT EXISTS idx_node_tags_tag ON node_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_views_project ON views(project_id);

    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      data TEXT NOT NULL DEFAULT '{}',
      node_count INTEGER NOT NULL DEFAULT 0,
      edge_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots(project_id);
  `);

  // Step 2: Migration — add user_id to projects if missing (existing DB)
  const columns = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  if (!columns.some(c => c.name === 'user_id')) {
    const hash = hashSync(ADMIN_USERNAME);
    db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (?, ?, ?)')
      .run(ADMIN_ID, ADMIN_USERNAME, hash);

    db.exec(`ALTER TABLE projects ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE`);
    db.prepare('UPDATE projects SET user_id = ? WHERE user_id IS NULL').run(ADMIN_ID);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id)`);
  }

  // Step 3: Ensure admin user exists
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get(ADMIN_USERNAME);
  if (!adminExists) {
    const hash = hashSync(ADMIN_USERNAME);
    db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (?, ?, ?)')
      .run(ADMIN_ID, ADMIN_USERNAME, hash);
  }

  // Step 4: Add enrichment columns to nodes table
  const nodeColumns = db.prepare("PRAGMA table_info(nodes)").all() as { name: string }[];
  if (!nodeColumns.some(c => c.name === 'priority')) {
    db.exec(`ALTER TABLE nodes ADD COLUMN priority TEXT NOT NULL DEFAULT 'p2' CHECK(priority IN ('p0','p1','p2','p3'))`);
    db.exec(`ALTER TABLE nodes ADD COLUMN due_date TEXT`);
    db.exec(`ALTER TABLE nodes ADD COLUMN assignee_id TEXT REFERENCES users(id)`);
    db.exec(`ALTER TABLE nodes ADD COLUMN progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100)`);
    db.exec(`ALTER TABLE nodes ADD COLUMN node_type TEXT NOT NULL DEFAULT 'task' CHECK(node_type IN ('task','milestone','group','decision','note'))`);
    db.exec(`ALTER TABLE nodes ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]'`);

    // Backfill: nodes with children → 'group', others stay 'task'
    db.exec(`UPDATE nodes SET node_type = 'group' WHERE id IN (SELECT DISTINCT parent_id FROM nodes WHERE parent_id IS NOT NULL)`);
  }

  // Step 5: Add enrichment columns to edges table
  const edgeColumns = db.prepare("PRAGMA table_info(edges)").all() as { name: string }[];
  if (!edgeColumns.some(c => c.name === 'edge_type')) {
    db.exec(`ALTER TABLE edges ADD COLUMN edge_type TEXT NOT NULL DEFAULT 'relates_to' CHECK(edge_type IN ('depends_on','blocks','relates_to','child_of'))`);
    db.exec(`ALTER TABLE edges ADD COLUMN style TEXT NOT NULL DEFAULT '{}'`);
  }
}
