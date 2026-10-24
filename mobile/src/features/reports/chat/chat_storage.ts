import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import type { chatMsg, Conversations, ReportConversation } from "./chat_types";

let dbPromise: Promise<SQLiteDatabase> | undefined;
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.catch(() => undefined);
  return result;
}

export function initChatDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDatabaseAsync("report_chats.db");
      try {
        await db.execAsync(`
          PRAGMA journal_mode = WAL;
          PRAGMA foreign_keys = ON;
          CREATE TABLE IF NOT EXISTS chat_conversations (
            report_id TEXT PRIMARY KEY NOT NULL,
            draft TEXT NOT NULL DEFAULT '',
            reply_status TEXT NOT NULL CHECK(reply_status IN ('idle','loading','failed')),
            failed_msg_id TEXT,
            pending_msg_id TEXT
          );
          CREATE TABLE IF NOT EXISTS chat_msgs (
            id TEXT PRIMARY KEY NOT NULL,
            report_id TEXT NOT NULL REFERENCES chat_conversations(report_id) ON DELETE CASCADE,
            role TEXT NOT NULL CHECK(role IN ('user','assistant')),
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            position INTEGER NOT NULL,
            UNIQUE(report_id, position)
          );
        `);
        const columns = await db.getAllAsync<{ name: string }>(
          "PRAGMA table_info(chat_conversations)",
        );
        if (!columns.some((column) => column.name === "archived_msgs")) {
          await db.execAsync(
            "ALTER TABLE chat_conversations ADD COLUMN archived_msgs TEXT NOT NULL DEFAULT '[]'",
          );
        }
        return db;
      } catch (error) {
        await db.closeAsync();
        throw error;
      }
    })().catch((error) => {
      dbPromise = undefined;
      throw error;
    });
  }
  return dbPromise;
}

export function loadConversations(): Promise<Conversations> {
  return enqueue(async () => {
    const db = await initChatDb();
    const rows = await db.getAllAsync<{
      report_id: string;
      draft: string;
      reply_status: ReportConversation["replyStatus"];
      failed_msg_id: string | null;
      pending_msg_id: string | null;
      archived_msgs: string;
    }>("SELECT * FROM chat_conversations");
    const msgs = await db.getAllAsync<chatMsg & { report_id: string }>(
      "SELECT id, report_id, role, content, created_at AS createdAt FROM chat_msgs ORDER BY report_id, position",
    );
    const result: Conversations = {};
    for (const row of rows) {
      const reportMsgs = msgs
        .filter((msg) => msg.report_id === row.report_id)
        .map(({ id, role, content, createdAt }) => ({
          id,
          role,
          content,
          createdAt,
        }));
      const interrupted =
        row.reply_status === "loading" || row.pending_msg_id !== null;
      const failedId = interrupted ? row.pending_msg_id : row.failed_msg_id;
      const failedMsg =
        reportMsgs.find((msg) => msg.id === failedId && msg.role === "user") ??
        null;
      if ((row.reply_status !== "idle" || interrupted) && !failedMsg)
        throw new Error("Saved request has no matching user msg.");
      result[row.report_id] = {
        ...(row.archived_msgs !== "[]"
          ? { archivedMsgs: JSON.parse(row.archived_msgs) as chatMsg[] }
          : {}),
        msgs: reportMsgs,
        draft: row.draft,
        errorMsg: "",
        replyStatus: interrupted ? "failed" : row.reply_status,
        failedMsg,
        pendingMsgId: interrupted ? failedId : null,
      };
    }
    return result;
  });
}

export function saveConversation(
  reportId: string,
  conversation: ReportConversation,
): Promise<void> {
  return enqueue(async () => {
    const db = await initChatDb();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `INSERT INTO chat_conversations (report_id, draft, reply_status, failed_msg_id, pending_msg_id, archived_msgs)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(report_id) DO UPDATE SET
        draft=excluded.draft, reply_status=excluded.reply_status,
        failed_msg_id=excluded.failed_msg_id, pending_msg_id=excluded.pending_msg_id,
        archived_msgs=excluded.archived_msgs`,
        reportId,
        conversation.draft,
        conversation.replyStatus,
        conversation.failedMsg?.id ?? null,
        conversation.pendingMsgId,
        JSON.stringify(conversation.archivedMsgs ?? []),
      );
      await tx.runAsync("DELETE FROM chat_msgs WHERE report_id = ?", reportId);
      for (const [position, msg] of conversation.msgs.entries()) {
        await tx.runAsync(
          "INSERT INTO chat_msgs (id, report_id, role, content, created_at, position) VALUES (?, ?, ?, ?, ?, ?)",
          msg.id,
          reportId,
          msg.role,
          msg.content,
          msg.createdAt,
          position,
        );
      }
    });
  });
}

export function deleteConversation(reportId: string): Promise<void> {
  // Use the same queue as saving: an older queued save must finish before deletion.
  return enqueue(async () => {
    const db = await initChatDb();
    // Foreign-key cascading deletes this conversation's msgs as well.
    await db.runAsync(
      "DELETE FROM chat_conversations WHERE report_id = ?",
      reportId,
    );
  });
}
