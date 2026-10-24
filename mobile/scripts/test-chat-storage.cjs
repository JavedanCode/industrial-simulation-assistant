// Tests the production SQL against real SQLite via Node, not the native Expo bridge.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../src/features/reports/chat/chat_storage.ts"),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function openStorage(filename) {
  const raw = new DatabaseSync(filename);
  const adapter = {
    execAsync: async (sql) => raw.exec(sql),
    runAsync: async (sql, ...params) => raw.prepare(sql).run(...params),
    getAllAsync: async (sql) => raw.prepare(sql).all(),
    closeAsync: async () => raw.close(),
    async withExclusiveTransactionAsync(work) {
      raw.exec("BEGIN IMMEDIATE");
      try {
        await work(adapter);
        raw.exec("COMMIT");
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const sandbox = {
    exports: {},
    require(name) {
      assert.equal(name, "expo-sqlite");
      return { openDatabaseAsync: async () => adapter };
    },
  };
  vm.runInNewContext(compiled, sandbox);
  return { storage: sandbox.exports, close: () => raw.close() };
}

test("chat round-trip, ordered saves, interrupted retry, and rollback", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-storage-"));
  const filename = path.join(dir, "test.db");
  let handle = openStorage(filename);
  try {
    const msg = {
      id: "user-1",
      role: "user",
      content: "Quotes ' and unicode مرحبا",
      createdAt: "2026-10-13T12:00:00Z",
    };
    const base = {
      msgs: [msg],
      draft: "unsent",
      errorMsg: "",
      replyStatus: "idle",
      failedMsg: null,
      pendingMsgId: null,
      archivedMsgs: [
        { ...msg, id: "old-local-msg", content: "Earlier local conversation" },
      ],
    };
    await handle.storage.saveConversation("A", base);
    await Promise.all([
      handle.storage.saveConversation("A", { ...base, draft: "older" }),
      handle.storage.saveConversation("A", { ...base, draft: "latest" }),
      handle.storage.saveConversation("B", {
        ...base,
        msgs: [],
        draft: "separate",
      }),
    ]);
    let loaded = await handle.storage.loadConversations();
    assert.equal(loaded.A.draft, "latest");
    assert.equal(loaded.B.draft, "separate");
    await assert.rejects(
      handle.storage.saveConversation("A", { ...base, msgs: [msg, msg] }),
    );
    loaded = await handle.storage.loadConversations();
    assert.equal(
      loaded.A.draft,
      "latest",
      "failed transaction preserves previous data",
    );
    await handle.storage.saveConversation("A", {
      ...base,
      replyStatus: "loading",
      pendingMsgId: msg.id,
    });
    handle.close();
    handle = openStorage(filename);
    loaded = await handle.storage.loadConversations();
    assert.equal(loaded.A.replyStatus, "failed");
    assert.equal(loaded.A.failedMsg.id, msg.id);
    assert.equal(loaded.A.pendingMsgId, msg.id);
    assert.equal(loaded.A.msgs[0].content, msg.content);
    assert.equal(loaded.A.draft, "unsent");
    assert.equal(
      loaded.A.archivedMsgs[0].content,
      "Earlier local conversation",
    );
    const reply = {
      ...msg,
      id: "reply-1",
      role: "assistant",
      content: "Demo reply",
    };
    await handle.storage.saveConversation("A", { ...base, msgs: [msg, reply] });
    loaded = await handle.storage.loadConversations();
    assert.equal(
      loaded.A.msgs.map((item) => item.id).join(","),
      "user-1,reply-1",
    );
    assert.equal(loaded.A.replyStatus, "idle");
    assert.equal(loaded.A.pendingMsgId, null);
    assert.equal(loaded.B.draft, "separate");
    // Delete waits behind an already queued save and cascades to its msgs.
    await Promise.all([
      handle.storage.saveConversation("A", {
        ...base,
        draft: "queued before delete",
      }),
      handle.storage.deleteConversation("A"),
    ]);
    await handle.storage.deleteConversation("A");
    handle.close();
    handle = openStorage(filename);
    loaded = await handle.storage.loadConversations();
    assert.equal(loaded.A, undefined);
    assert.equal(loaded.B.draft, "separate");
    // Reusing a deleted msg ID in another chat proves the old msg was removed.
    await handle.storage.saveConversation("B", base);
    loaded = await handle.storage.loadConversations();
    assert.equal(loaded.B.msgs[0].id, msg.id);
  } finally {
    handle.close();
    fs.rmSync(filename, { force: true });
    for (const suffix of ["-wal", "-shm"])
      fs.rmSync(filename + suffix, { force: true });
    fs.rmdirSync(dir);
  }
});
