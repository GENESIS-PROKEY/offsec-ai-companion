// SQLite database connection and schema initialization using sql.js (pure JS/WASM)

import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';

let db: SqlJsDatabase;

export async function getDatabase(): Promise<SqlJsDatabase> {
  if (!db) {
    const SQL = await initSqlJs();

    // Ensure data directory exists
    const dir = path.dirname(config.database.sqlitePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Load existing database or create new
    if (fs.existsSync(config.database.sqlitePath)) {
      const buffer = fs.readFileSync(config.database.sqlitePath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    initSchema(db);
    logger.info({ path: config.database.sqlitePath }, 'SQLite connected (sql.js)');
  }
  return db;
}

function initSchema(db: SqlJsDatabase) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      preferred_level TEXT NOT NULL DEFAULT 'beginner',
      detected_level TEXT NOT NULL DEFAULT 'beginner',
      preferred_style TEXT NOT NULL DEFAULT 'detailed',
      topics_of_interest TEXT NOT NULL DEFAULT '[]',
      total_interactions INTEGER NOT NULL DEFAULT 0,
      concepts_explored TEXT NOT NULL DEFAULT '[]',
      questions_asked INTEGER NOT NULL DEFAULT 0,
      streak_days INTEGER NOT NULL DEFAULT 0,
      last_streak_date TEXT,
      data_retention TEXT NOT NULL DEFAULT 'full',
      opted_in_analytics INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_active_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      command TEXT NOT NULL,
      query TEXT NOT NULL,
      response TEXT NOT NULL,
      level TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 1.0,
      topics TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_interactions_user
      ON interactions(user_id, created_at DESC);
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS history_summaries (
      user_id TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      interaction_count INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS quiz_sessions (
      user_id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      question_number INTEGER NOT NULL DEFAULT 1,
      total_questions INTEGER NOT NULL DEFAULT 5,
      previous_questions TEXT NOT NULL DEFAULT '[]',
      score INTEGER NOT NULL DEFAULT 0,
      level TEXT NOT NULL DEFAULT 'beginner',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );
  `);

  logger.info('SQLite schema initialized');
}

/**
 * Persist the database to disk.
 */
export function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.database.sqlitePath, buffer);
    logger.info('SQLite database saved to disk');
  }
}

// ─── Debounced Save ──────────────────────────────────────────────────
// Coalesces multiple save calls within 10s into a single disk write.
// Used by MCPs that update after every interaction (memory, preference).
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 10_000;

export function debouncedSave(): void {
  if (saveTimer) return; // Already scheduled
  saveTimer = setTimeout(() => {
    saveDatabase();
    saveTimer = null;
  }, SAVE_DEBOUNCE_MS);
  saveTimer.unref(); // Don't block process exit
}

/**
 * Close and save the database.
 */
export function closeDatabase() {
  if (db) {
    saveDatabase();
    db.close();
    logger.info('SQLite connection closed');
  }
}

// ─── Helper functions (wraps sql.js API to be more ergonomic) ────────

/**
 * Run a statement with parameters (INSERT, UPDATE, DELETE).
 */
export function dbRun(sql: string, params: SqlValue[] = []): void {
  db.run(sql, params);
}

/**
 * Get a single row.
 */
export function dbGet(sql: string, params: SqlValue[] = []): Record<string, unknown> | undefined {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row as Record<string, unknown>;
  }
  stmt.free();
  return undefined;
}

/**
 * Get all matching rows.
 */
export function dbAll(sql: string, params: SqlValue[] = []): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  return results;
}
