import { buildReport, type ReportSubmissionInput } from "./report_submission";
import type { SavedReport } from "./report_types";
import { validateReportTitle } from "./report_management";

// Browser demo only. Picked document URIs and records last for this session.
const reports: SavedReport[] = [];
export async function renameReport(id: string, value: string): Promise<string> {
  const title = validateReportTitle(value);
  const report = reports.find((item) => item.id === id);
  if (!report) throw new Error("Report not found.");
  report.title = title;
  return title;
}

export async function deleteReport(id: string): Promise<void> {
  const index = reports.findIndex((item) => item.id === id);
  // Browser files belong to the picker; remove only our temporary record.
  if (index !== -1) reports.splice(index, 1);
}
export async function loadReports(): Promise<SavedReport[]> {
  return [...reports];
}
export async function saveReport(
  id: string,
  input: ReportSubmissionInput,
): Promise<SavedReport> {
  const report = buildReport(id, input);
  report.documentPath = input.document.uri;
  reports.unshift(report);
  return report;
}
