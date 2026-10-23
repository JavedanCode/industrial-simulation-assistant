import type { NormalizedReport } from "../../models/NormalizedReport.js";
import type { ReportInsights } from "../../models/ReportInsights.js";
import {
  buildReportSemanticSummary,
  type ReportSemanticSummary,
} from "./reportSemanticsService.js";
import { buildReportInsights } from "./reportInsightsService.js";

export interface ReportAnalysisResult {
  report: NormalizedReport;
  semantics: ReportSemanticSummary;
  insights: ReportInsights;
}

export function analyzeNormalizedReport(
  report: NormalizedReport,
): ReportAnalysisResult {
  const semantics = buildReportSemanticSummary(report);
  const insights = buildReportInsights(report);

  return {
    report,
    semantics,
    insights,
  };
}
