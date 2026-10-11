export type ReportSummery = {
  id: string;
  title: string;
  createdAt: string;
  source: "text" | "document";
  status: "processing" | "ready" | "failed";
};
