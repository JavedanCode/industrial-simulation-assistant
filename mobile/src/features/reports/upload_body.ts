import { File, Paths } from "expo-file-system";
import type { SavedReport } from "./report_types";

// Keep the user's filename while reading bytes from the app-owned UUID copy.
class ReportUploadFile extends File {
  constructor(
    path: string,
    private readonly originalName: string,
  ) {
    super(Paths.document, path);
  }
  override get name() {
    return this.originalName;
  }
}

export async function uploadBody(report: SavedReport) {
  if (!report.documentPath || !report.documentName)
    throw new Error(
      "The original document is unavailable. Select it again from Home.",
    );
  const file = new ReportUploadFile(report.documentPath, report.documentName);
  if (!file.exists)
    throw new Error(
      "The saved document is missing. Select it again from Home.",
    );
  const body = new FormData();
  // SDK 58's fetch reads File.bytes(); URI-only descriptors are unsupported.
  // Let fetch generate the multipart boundary and Content-Type header.
  body.append("report", file);
  return body;
}
