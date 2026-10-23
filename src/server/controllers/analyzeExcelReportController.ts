import type { Request, Response } from "express";
import { AppError } from "../http/appError.js";
import { analyzeExcelReport } from "../services/excelReportAnalysisService.js";
import { storeReport } from "../services/reportLibraryService.js";

export async function analyzeExcelReportController(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.file) {
    throw new AppError(
      400,
      'Missing report file. Upload one file using the field name "report".',
      "MISSING_REPORT_FILE",
    );
  }

  let analysis;

  try {
    analysis = await analyzeExcelReport(
      req.file.buffer,
      req.file.originalname,
    );
  } catch {
    throw new AppError(
      422,
      "The uploaded file could not be read as a valid Arena Excel report.",
      "REPORT_PARSE_FAILED",
    );
  }

  const storedReport = storeReport(req.file.originalname, analysis);

  res.status(201).json({
    reportId: storedReport.reportId,
    report: storedReport.analysis.report,
    semantics: storedReport.analysis.semantics,
    insights: storedReport.analysis.insights,
  });
}
