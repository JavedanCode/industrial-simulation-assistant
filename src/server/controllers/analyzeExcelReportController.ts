import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { requestKey, readReceipt, saveReceipt } from "../http/idempotency.js";
import { withTransaction } from "../storage/database.js";
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

  const key = requestKey(req.get("Idempotency-Key"));
  const fingerprint = createHash("sha256")
    .update(req.file.originalname)
    .update(req.file.buffer)
    .digest("hex");
  const prior = readReceipt("upload", key, fingerprint);
  if (prior) {
    res.status(201).json(prior);
    return;
  }
  let analysis;

  try {
    analysis = await analyzeExcelReport(req.file.buffer, req.file.originalname);
  } catch {
    throw new AppError(
      422,
      "The uploaded file could not be read as a valid Arena Excel report.",
      "REPORT_PARSE_FAILED",
    );
  }

  const fileName = req.file.originalname;
  const result = withTransaction(() => {
    // Parsing can overlap, so check again before inserting anything.
    const existing = readReceipt("upload", key, fingerprint);
    if (existing) return existing;
    const storedReport = storeReport(fileName, analysis);
    const response = {
      reportId: storedReport.reportId,
      ...storedReport.analysis,
    };
    saveReceipt("upload", key, fingerprint, storedReport.reportId, response);
    return response;
  });
  res.status(201).json(result);
}
