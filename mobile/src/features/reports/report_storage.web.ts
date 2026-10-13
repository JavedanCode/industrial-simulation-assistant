import { buildReport, type ReportSubmissionInput } from "./report_submission";
import type { SavedReport } from "./report_types";

// Browser demo only. Picked document URIs and records last for this session.
const reports: SavedReport[] = [];
export async function loadReports(): Promise<SavedReport[]> {
  return [...reports];
}
export async function saveReport(
  id: string,
  input: ReportSubmissionInput,
): Promise<SavedReport> {
  const report = buildReport(id, input);
  if (input.source === "document") report.documentPath = input.document.uri;
  reports.unshift(report);
  return report;
}
