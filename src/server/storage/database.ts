import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getConfig } from "../../config.js";

let database: DatabaseSync | null = null;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    project_name TEXT,
    model_run_date TEXT,
    declared_replication_count INTEGER,
    analysis_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    title TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (report_id) REFERENCES reports (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_report_id
    ON conversations (report_id, created_at);

  CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
    ON messages (conversation_id, created_at);
`;

export function getDatabase(): DatabaseSync {
  if (database) {
    return database;
  }

  const { databasePath } = getConfig();

  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec(SCHEMA);

  return database;
}

export function closeDatabase(): void {
  if (!database) {
    return;
  }

  database.close();
  database = null;
}

export function withTransaction<T>(operation: () => T): T {
  const db = getDatabase();

  db.exec("BEGIN");

  try {
    const result = operation();

    db.exec("COMMIT");

    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Drops all application tables and recreates them. Only intended for tests.
 */
export function resetDatabaseForTests(): void {
  const db = getDatabase();

  db.exec(`
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS conversations;
    DROP TABLE IF EXISTS reports;
  `);

  db.exec(SCHEMA);
}
