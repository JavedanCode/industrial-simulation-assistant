import type { AnalysisPresentation } from "@/api/contracts";

export type ReportSync = {
  apiUrl: string;
  serverReportId: string | null;
  conversationId: string | null;
  analysis: AnalysisPresentation | null;
  error: string | null;
};

export type ReportSummery = {
  id: string;
  title: string;
  createdAt: string;
  source: "text" | "document";
  status: "awaiting_backend" | "processing" | "ready" | "failed";
};

export type SavedReport = ReportSummery & {
  sync?: ReportSync;
  content: string | null;
  documentName: string | null;
  documentPath: string | null;
  mimeType: string | null;
  size: number | null;
};

export const reportStatusLabels: Record<ReportSummery["status"], string> = {
  awaiting_backend: "Not uploaded",
  processing: "Processing",
  ready: "Analysis ready",
  failed: "Analysis failed",
};
