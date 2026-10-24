const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const sandbox = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(
      path.join(__dirname, "../src/features/reports/chat/reconcile_history.ts"),
      "utf8",
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  sandbox,
);
const reconcile = (current, server) =>
  JSON.parse(JSON.stringify(sandbox.exports.reconcileHistory(current, server)));
const msg = (id, role = "user") => ({
  id,
  role,
  content: id,
  createdAt: "2026-10-24T00:00:00Z",
});
const base = {
  msgs: [],
  draft: "draft",
  errorMsg: "",
  replyStatus: "idle",
  failedMsg: null,
  pendingMsgId: null,
};

test("refresh archives earlier local messages without discarding a pending question", () => {
  const pending = msg("pending");
  const current = {
    ...base,
    msgs: [msg("old", "assistant"), pending],
    failedMsg: pending,
    replyStatus: "failed",
  };
  const result = reconcile(current, []);
  assert.equal(result.archivedMsgs[0].id, "old");
  assert.equal(result.msgs[0].id, "pending");
  assert.equal(result.failedMsg.id, "pending");
  assert.equal(result.replyStatus, "failed");
  assert.equal(current.draft, "draft");
  assert.equal(reconcile({ ...current, ...result }, []).archivedMsgs.length, 1);
});
test("refresh reconciles a reply completed after a lost response", () => {
  const pending = msg("pending");
  const current = {
    ...base,
    msgs: [pending],
    pendingMsgId: pending.id,
    failedMsg: pending,
    replyStatus: "failed",
  };
  const result = reconcile(current, [pending, msg("reply", "assistant")]);
  assert.equal(result.msgs.length, 2);
  assert.equal(result.replyStatus, "idle");
  assert.equal(result.failedMsg, null);
  assert.equal(result.pendingMsgId, null);
  assert.equal(result.archivedMsgs.length, 0);
});
