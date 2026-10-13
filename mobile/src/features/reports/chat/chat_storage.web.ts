import type { Conversations, ReportConversation } from "./chat_types";

// Web keeps the existing in-memory demo. The UI explicitly labels it as temporary.
// Native SQLite stays out of this bundle until WASM/hosting support is configured.
export async function loadConversations(): Promise<Conversations> {
  return {};
}

export async function saveConversation(
  _reportId: string,
  _conversation: ReportConversation,
): Promise<void> {
  // No persistence on web yet.
}
