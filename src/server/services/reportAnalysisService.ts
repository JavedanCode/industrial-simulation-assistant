import type { NormalizedReport } from "../../models/NormalizedReport.js";
import {
  buildReportSemanticSummary,
  type ReportSemanticSummary,
} from "./reportSemanticsService.js";

export interface ReportAnalysisResult {
  report: NormalizedReport;
  semantics: ReportSemanticSummary;
}

export function analyzeNormalizedReport(
  report: NormalizedReport,
): ReportAnalysisResult {
  const semantics = buildReportSemanticSummary(report);

  return {
    report,
    semantics,
  };
}
