import type { chatMsg, ReportConversation } from "./chat_types";

// Keep old local/demo history available, but never present it as backend analysis.
export function reconcileHistory(
  current: ReportConversation,
  serverMsgs: chatMsg[],
): Partial<ReportConversation> {
  const pending =
    current.failedMsg ??
    current.msgs.find((msg) => msg.id === current.pendingMsgId);
  const serverIds = new Set(serverMsgs.map((msg) => msg.id));
  const archived = new Map(
    (current.archivedMsgs ?? []).map((msg) => [msg.id, msg]),
  );
  for (const msg of current.msgs) {
    if (!serverIds.has(msg.id) && msg.id !== pending?.id)
      archived.set(msg.id, msg);
  }
  const index = pending
    ? serverMsgs.findIndex((msg) => msg.id === pending.id)
    : -1;
  const hasReply = index >= 0 && serverMsgs[index + 1]?.role === "assistant";
  return {
    msgs: pending && index === -1 ? [...serverMsgs, pending] : serverMsgs,
    archivedMsgs: [...archived.values()],
    errorMsg: "",
    failedMsg: hasReply ? null : (pending ?? null),
    pendingMsgId: hasReply ? null : current.pendingMsgId,
    replyStatus: pending && !hasReply ? "failed" : "idle",
  };
}
