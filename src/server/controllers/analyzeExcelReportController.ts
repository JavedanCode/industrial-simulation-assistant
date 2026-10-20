import type { Request, Response } from "express";
import { analyzeExcelReport } from "../services/excelReportAnalysisService.js";

export async function analyzeExcelReportController(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.file) {
    res.status(400).json({
      error:
        'Missing report file. Upload one file using the field name "report".',
    });
    return;
  }

  try {
    const result = await analyzeExcelReport(
      req.file.buffer,
      req.file.originalname,
    );

    res.status(200).json(result);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(400).json({
        error: error.message,
      });
      return;
    }

    res.status(500).json({
      error: "An unexpected error occurred while analyzing the report.",
    });
  }
}
