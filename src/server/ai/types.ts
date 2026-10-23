import type { NormalizedReport } from "../../models/NormalizedReport.js";
import type { ReportInsights } from "../../models/ReportInsights.js";
import type { ReportSemanticSummary } from "../services/reportSemanticsService.js";
import type { MessageRole } from "../storage/types.js";

export interface AiHistoryMessage {
  role: MessageRole;
  content: string;
}

export interface AiGenerationInput {
  question: string;
  report: NormalizedReport;
  semantics: ReportSemanticSummary;
  insights: ReportInsights;
  history: AiHistoryMessage[];
}

/**
 * The boundary between the backend and whichever model powers the chat.
 *
 * Implementations are selected with the AI_PROVIDER environment variable.
 * Keeping this interface small means a hosted model, a local model, or a
 * fine-tuned model can be swapped in without touching the conversation code.
 */
export interface AiProvider {
  readonly name: string;
  generateReply(input: AiGenerationInput): Promise<string>;
}
