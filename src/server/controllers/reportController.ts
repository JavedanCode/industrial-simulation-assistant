import { Request, Response } from "express";
import { parseReport } from "../services/reportService";

export function parseReportController(req: Request, res: Response): void {
  const { reportText } = req.body;

  const result = parseReport(reportText);

  res.json(result);
}
