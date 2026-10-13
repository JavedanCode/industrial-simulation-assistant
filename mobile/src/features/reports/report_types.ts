export type ReportSummery = {
  id: string;
  title: string;
  createdAt: string;
  source: "text" | "document";
  status: "awaiting_backend" | "processing" | "ready" | "failed";
};

export type SavedReport = ReportSummery & {
  content: string | null;
  documentName: string | null;
  documentPath: string | null;
  mimeType: string | null;
  size: number | null;
};

export const reportStatusLabels: Record<ReportSummery["status"], string> = {
  awaiting_backend: "Awaiting backend",
  processing: "Processing",
  ready: "Analysis ready",
  failed: "Analysis failed",
};
