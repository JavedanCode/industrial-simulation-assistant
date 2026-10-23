import type { Request, Response } from "express";
import { parseUuidParam } from "../http/validation.js";
import {
  deleteStoredReport,
  getStoredReport,
  listStoredReports,
} from "../services/reportLibraryService.js";

export function listReportsController(
  _req: Request,
  res: Response,
): void {
  res.json({
    reports: listStoredReports(),
  });
}

export function getReportController(req: Request, res: Response): void {
  const reportId = parseUuidParam(req.params.reportId, "reportId");
  const storedReport = getStoredReport(reportId);

  res.json({
    reportId: storedReport.reportId,
    fileName: storedReport.fileName,
    createdAt: storedReport.createdAt,
    report: storedReport.analysis.report,
    semantics: storedReport.analysis.semantics,
  });
}

export function deleteReportController(req: Request, res: Response): void {
  const reportId = parseUuidParam(req.params.reportId, "reportId");

  deleteStoredReport(reportId);

  res.status(204).send();
}
