import type { SavedReport } from "./report_types";

export async function uploadBody(report: SavedReport) {
  if (!report.documentPath || !report.documentName)
    throw new Error("Select the document again from Home.");
  const response = await fetch(report.documentPath);
  if (!response.ok)
    throw new Error("The selected document is no longer available.");
  const body = new FormData();
  body.append("report", await response.blob(), report.documentName);
  return body;
}
