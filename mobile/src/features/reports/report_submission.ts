import type { DocumentPickerAsset } from "expo-document-picker";
import type { SavedReport } from "./report_types";

export type ReportSubmissionInput = {
  source: "document";
  document: DocumentPickerAsset;
};

export function buildReport(
  id: string,
  input: ReportSubmissionInput,
): SavedReport {
  if (
    input.source !== "document" ||
    !input.document ||
    !input.document.uri ||
    !/\.(xls|xlsx|xlsm)$/i.test(input.document.name)
  ) {
    throw new Error("Select a supported document first.");
  }
  return {
    id,
    title: input.document.name,
    createdAt: new Date().toISOString(),
    source: input.source,
    status: "awaiting_backend",
    content: null,
    documentName: input.document.name,
    documentPath: null,
    mimeType: input.document.mimeType ?? null,
    size: input.document.size ?? null,
  };
}
