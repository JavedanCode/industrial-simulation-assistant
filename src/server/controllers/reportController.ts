import { Request, Response } from "express";
import { parseReport } from "../services/reportService";

export function parseReportController(req: Request, res: Response): void {
  const { reportText } = req.body;

  if (typeof reportText !== "string" || reportText.trim().length === 0) {
    res.status(400).json({
      error: "reportText must be a non-empty string",
    });
    return;
  }

  const result = parseReport(reportText);

  res.json(result);
}
