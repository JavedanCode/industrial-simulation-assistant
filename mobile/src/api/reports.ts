import { apiRequest, ApiError } from "./client";
import { object, uuid, array, apiMsg, analysisPresentation } from "./contracts";
import type { chatMsg } from "@/features/reports/chat/chat_types";

export async function analyzeReport(body: FormData, requestId: string) {
  const data = object(
    await apiRequest("/reports/analyze", { method: "POST", body, requestId }),
  );
  return {
    reportId: uuid(data.reportId),
    analysis: analysisPresentation(data),
  };
}
export async function createConversation(reportId: string, requestId: string) {
  const data = object(
    await apiRequest(`/reports/${reportId}/conversations`, {
      method: "POST",
      body: "{}",
      json: true,
      requestId,
    }),
  );
  const conversation = object(data.conversation);
  if (uuid(conversation.reportId) !== reportId)
    throw new ApiError("The conversation belongs to a different report.");
  return uuid(conversation.conversationId);
}
export async function loadHistory(
  conversationId: string,
  signal?: AbortSignal,
) {
  const data = object(
    await apiRequest(`/conversations/${conversationId}`, {
      signal,
      timeoutMs: 20_000,
    }),
  );
  if (uuid(object(data.conversation).conversationId) !== conversationId)
    throw new ApiError("Unexpected conversation ID.");
  return array(data.messages).map((msg) => apiMsg(msg, conversationId));
}
export async function sendApiMsg(
  conversationId: string,
  msg: chatMsg,
  signal: AbortSignal,
) {
  const data = object(
    await apiRequest(`/conversations/${conversationId}/messages`, {
      method: "POST",
      json: true,
      body: JSON.stringify({ content: msg.content, clientMsgId: msg.id }),
      signal,
    }),
  );
  const user = apiMsg(data.userMessage, conversationId),
    assistant = apiMsg(data.assistantMessage, conversationId);
  if (
    user.role !== "user" ||
    assistant.role !== "assistant" ||
    user.id !== msg.id ||
    user.content !== msg.content
  )
    throw new ApiError(
      "Unexpected message response. Refresh the conversation before retrying.",
    );
  return { user, assistant };
}
