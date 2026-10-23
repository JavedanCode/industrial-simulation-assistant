import { NotFoundError } from "../http/appError.js";
import {
  deleteReportById,
  findReportById,
  insertReport,
  listReportSummaries,
} from "../storage/reportRepository.js";
import type {
  ReportSummary,
  StoredReport,
} from "../storage/types.js";
import type { ReportAnalysisResult } from "./reportAnalysisService.js";

export function storeReport(
  fileName: string,
  analysis: ReportAnalysisResult,
): StoredReport {
  return insertReport(fileName, analysis);
}

export function listStoredReports(): ReportSummary[] {
  return listReportSummaries();
}

export function getStoredReport(reportId: string): StoredReport {
  const report = findReportById(reportId);

  if (!report) {
    throw new NotFoundError("Report not found.");
  }

  return report;
}

export function deleteStoredReport(reportId: string): void {
  if (!deleteReportById(reportId)) {
    throw new NotFoundError("Report not found.");
  }
}
