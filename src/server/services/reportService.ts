import { Report } from "../../models/Report";

export function parseReport(reportText: string): Report {
  return {
    rawText: reportText,
  };
}
