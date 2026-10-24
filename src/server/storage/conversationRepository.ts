import { randomUUID } from "node:crypto";
import { getDatabase, withTransaction } from "./database.js";
import type {
  Conversation,
  ConversationMessage,
  MessageRole,
} from "./types.js";

interface ConversationRow {
  id: string;
  report_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

function mapConversation(row: ConversationRow): Conversation {
  return {
    conversationId: row.id,
    reportId: row.report_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow): ConversationMessage {
  return {
    messageId: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

export function insertConversation(
  reportId: string,
  title: string | null,
): Conversation {
  const conversationId = randomUUID();
  const now = new Date().toISOString();

  getDatabase()
    .prepare(
      `
        INSERT INTO conversations (id, report_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(conversationId, reportId, title, now, now);

  return {
    conversationId,
    reportId,
    title,
    createdAt: now,
    updatedAt: now,
  };
}

export function findConversationById(
  conversationId: string,
): Conversation | null {
  const row = getDatabase()
    .prepare("SELECT * FROM conversations WHERE id = ?")
    .get(conversationId) as unknown as ConversationRow | undefined;

  return row ? mapConversation(row) : null;
}

export function listConversationsByReportId(reportId: string): Conversation[] {
  const rows = getDatabase()
    .prepare(
      `
        SELECT *
        FROM conversations
        WHERE report_id = ?
        ORDER BY created_at DESC, rowid DESC
      `,
    )
    .all(reportId) as unknown as ConversationRow[];

  return rows.map(mapConversation);
}

export function deleteConversationById(conversationId: string): boolean {
  const result = getDatabase()
    .prepare("DELETE FROM conversations WHERE id = ?")
    .run(conversationId);

  return Number(result.changes) > 0;
}

export function listMessagesByConversationId(
  conversationId: string,
): ConversationMessage[] {
  const rows = getDatabase()
    .prepare(
      `
        SELECT *
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC, rowid ASC
      `,
    )
    .all(conversationId) as unknown as MessageRow[];

  return rows.map(mapMessage);
}

export function appendMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
  messageId: string = randomUUID(),
): ConversationMessage {
  const createdAt = new Date().toISOString();

  return withTransaction(() => {
    const db = getDatabase();

    db.prepare(
      `
        INSERT INTO messages (id, conversation_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
    ).run(messageId, conversationId, role, content, createdAt);

    db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(
      createdAt,
      conversationId,
    );

    return {
      messageId,
      conversationId,
      role,
      content,
      createdAt,
    };
  });
}

export function setConversationTitle(
  conversationId: string,
  title: string,
): void {
  getDatabase()
    .prepare("UPDATE conversations SET title = ? WHERE id = ?")
    .run(title, conversationId);
}
