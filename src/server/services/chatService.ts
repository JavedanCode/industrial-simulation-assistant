import type { ChatRequest } from "../../schemas/chatSchemas.js";
import { AppError } from "../http/appError.js";
import {
  getConversationDetail,
  sendConversationMessage,
} from "./conversationService.js";

/**
 * Deprecated entry point kept for compatibility.
 *
 * Conversation history is now owned by the server, so `history` in the request
 * is ignored. New clients should use POST /api/conversations/:id/messages.
 */
export async function processMessage(request: ChatRequest) {
  const detail = getConversationDetail(request.conversationId);

  if (detail.conversation.reportId !== request.reportId) {
    throw new AppError(
      400,
      "reportId does not match the conversation.",
      "REPORT_MISMATCH",
    );
  }

  const { userMessage, assistantMessage } = await sendConversationMessage(
    request.conversationId,
    request.message.content,
  );

  return {
    response: assistantMessage.content,
    userMessage,
    assistantMessage,
  };
}
