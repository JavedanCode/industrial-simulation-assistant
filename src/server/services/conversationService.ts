import { AppError, NotFoundError } from "../http/appError.js";
import { getAiProvider } from "../ai/index.js";
import {
  appendMessage,
  deleteConversationById,
  findConversationById,
  insertConversation,
  listConversationsByReportId,
  listMessagesByConversationId,
  setConversationTitle,
} from "../storage/conversationRepository.js";
import { findReportById } from "../storage/reportRepository.js";
import type {
  Conversation,
  ConversationDetail,
  ConversationMessage,
} from "../storage/types.js";

const MAX_HISTORY_MESSAGES = 20;
const MAX_TITLE_LENGTH = 60;

function createTitleFromMessage(content: string): string {
  if (content.length <= MAX_TITLE_LENGTH) {
    return content;
  }

  return `${content.slice(0, MAX_TITLE_LENGTH - 3).trimEnd()}...`;
}

export function createConversation(
  reportId: string,
  title?: string,
): Conversation {
  if (!findReportById(reportId)) {
    throw new NotFoundError("Report not found.");
  }

  return insertConversation(reportId, title ?? null);
}

export function listReportConversations(reportId: string): Conversation[] {
  if (!findReportById(reportId)) {
    throw new NotFoundError("Report not found.");
  }

  return listConversationsByReportId(reportId);
}

export function getConversationDetail(
  conversationId: string,
): ConversationDetail {
  const conversation = findConversationById(conversationId);

  if (!conversation) {
    throw new NotFoundError("Conversation not found.");
  }

  return {
    conversation,
    messages: listMessagesByConversationId(conversationId),
  };
}

export function deleteConversation(conversationId: string): void {
  if (!deleteConversationById(conversationId)) {
    throw new NotFoundError("Conversation not found.");
  }
}

export interface SendMessageResult {
  userMessage: ConversationMessage;
  assistantMessage: ConversationMessage;
}

export async function sendConversationMessage(
  conversationId: string,
  content: string,
): Promise<SendMessageResult> {
  const conversation = findConversationById(conversationId);

  if (!conversation) {
    throw new NotFoundError("Conversation not found.");
  }

  const report = findReportById(conversation.reportId);

  if (!report) {
    throw new NotFoundError("Report not found.");
  }

  const history = listMessagesByConversationId(conversationId)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  const userMessage = appendMessage(conversationId, "user", content);

  if (!conversation.title) {
    setConversationTitle(conversationId, createTitleFromMessage(content));
  }

  let reply: string;

  try {
    reply = await getAiProvider().generateReply({
      question: content,
      report: report.analysis.report,
      semantics: report.analysis.semantics,
      history,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      502,
      "The AI provider could not generate a response.",
      "AI_PROVIDER_ERROR",
    );
  }

  const assistantMessage = appendMessage(conversationId, "assistant", reply);

  return {
    userMessage,
    assistantMessage,
  };
}
