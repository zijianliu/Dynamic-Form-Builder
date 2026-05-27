import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'form_builder.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS form_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    fields TEXT NOT NULL DEFAULT '[]',
    current_version INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS form_versions (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    fields TEXT NOT NULL DEFAULT '[]',
    config_snapshot TEXT NOT NULL DEFAULT '{}',
    published_at TEXT NOT NULL,
    published_by TEXT NOT NULL,
    FOREIGN KEY (form_id) REFERENCES form_configs(id) ON DELETE CASCADE,
    FOREIGN KEY (published_by) REFERENCES users(id)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_form_versions_unique
    ON form_versions(form_id, version);

  CREATE TABLE IF NOT EXISTS form_submissions (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    submitted_by TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (form_id) REFERENCES form_configs(id),
    FOREIGN KEY (version_id) REFERENCES form_versions(id),
    FOREIGN KEY (submitted_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_submissions_form
    ON form_submissions(form_id);
  CREATE INDEX IF NOT EXISTS idx_submissions_user
    ON form_submissions(submitted_by);
  CREATE INDEX IF NOT EXISTS idx_submissions_time
    ON form_submissions(submitted_at);
`);

export default db;
