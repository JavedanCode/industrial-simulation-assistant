import type { ReportAnalysisResult } from "../services/reportAnalysisService.js";

export interface StoredReport {
  reportId: string;
  fileName: string;
  createdAt: string;
  analysis: ReportAnalysisResult;
}

export interface ReportSummary {
  reportId: string;
  fileName: string;
  createdAt: string;
  projectName: string | null;
  modelRunDate: string | null;
  declaredReplicationCount: number | null;
}

export type MessageRole = "user" | "assistant";

export interface Conversation {
  conversationId: string;
  reportId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  messageId: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: ConversationMessage[];
}
