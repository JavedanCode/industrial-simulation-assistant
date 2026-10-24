import type { Conversations, ReportConversation } from "./chat_types";

export async function deleteConversation(_reportId: string): Promise<void> {
  // The chat provider clears browser state; there is no persistent web database.
}

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
