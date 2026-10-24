import { AppError, NotFoundError } from "../http/appError.js";
import { createHash } from "node:crypto";
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
import { buildReportInsights } from "./reportInsightsService.js";
import type {
  Conversation,
  ConversationDetail,
  ConversationMessage,
} from "../storage/types.js";

const MAX_HISTORY_MESSAGES = 8;
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

const pendingReplies = new Map<
  string,
  { key: string | undefined; content: string; work: Promise<SendMessageResult> }
>();

export async function sendConversationMessage(
  conversationId: string,
  content: string,
  clientMsgId?: string,
): Promise<SendMessageResult> {
  const pending = pendingReplies.get(conversationId);
  if (pending) {
    if (
      clientMsgId &&
      pending.key === clientMsgId &&
      pending.content === content
    )
      return pending.work;
    throw new AppError(
      409,
      "A reply is already being generated. Please retry shortly.",
      "REPLY_PENDING",
    );
  }
  const work = generateConversationReply(conversationId, content, clientMsgId);
  pendingReplies.set(conversationId, { key: clientMsgId, content, work });
  try {
    return await work;
  } finally {
    pendingReplies.delete(conversationId);
  }
}

async function generateConversationReply(
  conversationId: string,
  content: string,
  clientMsgId?: string,
): Promise<SendMessageResult> {
  const conversation = findConversationById(conversationId);

  if (!conversation) {
    throw new NotFoundError("Conversation not found.");
  }

  const report = findReportById(conversation.reportId);

  if (!report) {
    throw new NotFoundError("Report not found.");
  }

  const storedMsgs = listMessagesByConversationId(conversationId);
  const previousUser = storedMsgs.find((msg) => msg.messageId === clientMsgId);
  if (
    previousUser &&
    (previousUser.role !== "user" || previousUser.content !== content)
  )
    throw new AppError(
      409,
      "This message ID was already used for different content.",
    );
  // Deterministic reply IDs let a retry recover a completed reply after a lost
  // response or restart. Failed providers can retry without duplicating the user.
  const hash = clientMsgId
    ? createHash("sha256")
        .update(`reply:${conversationId}:${clientMsgId}`)
        .digest("hex")
    : null;
  const assistantId = hash
    ? `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`
    : undefined;
  const previousReply = storedMsgs.find((msg) => msg.messageId === assistantId);
  if (previousUser && previousReply)
    return { userMessage: previousUser, assistantMessage: previousReply };
  const history = storedMsgs
    .filter((msg) => msg.messageId !== clientMsgId)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  const userMessage =
    previousUser ?? appendMessage(conversationId, "user", content, clientMsgId);

  if (!conversation.title) {
    setConversationTitle(conversationId, createTitleFromMessage(content));
  }

  let reply: string;

  try {
    reply = await getAiProvider().generateReply({
      question: content,
      report: report.analysis.report,
      semantics: report.analysis.semantics,
      insights:
        report.analysis.insights ?? buildReportInsights(report.analysis.report),
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

  if (!findConversationById(conversationId))
    throw new NotFoundError(
      "Conversation was deleted while generating a reply.",
    );
  const assistantMessage = appendMessage(
    conversationId,
    "assistant",
    reply,
    assistantId,
  );

  return {
    userMessage,
    assistantMessage,
  };
}
