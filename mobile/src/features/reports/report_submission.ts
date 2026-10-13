import type { DocumentPickerAsset } from "expo-document-picker";
import type { SavedReport } from "./report_types";

export type ReportSubmissionInput =
  | { source: "text"; title: string; content: string }
  | { source: "document"; document: DocumentPickerAsset };

export function buildReport(
  id: string,
  input: ReportSubmissionInput,
): SavedReport {
  if (input.source === "text") {
    if (!input.content.trim()) throw new Error("Enter some report text first.");
    if (input.content.length > 10_000 || input.title.length > 120) {
      throw new Error(
        "Keep report text within 10,000 characters and the title within 120.",
      );
    }
  } else if (
    !input.document.uri ||
    !/\.(pdf|docx?|txt|md|csv|rtf|xls|xlsx|xlsm)$/i.test(input.document.name)
  ) {
    throw new Error("Select a supported document first.");
  }
  return {
    id,
    title:
      input.source === "text"
        ? input.title.trim() || "Untitled report"
        : input.document.name,
    createdAt: new Date().toISOString(),
    source: input.source,
    status: "awaiting_backend",
    content: input.source === "text" ? input.content.trim() : null,
    documentName: input.source === "document" ? input.document.name : null,
    documentPath: null,
    mimeType:
      input.source === "document" ? (input.document.mimeType ?? null) : null,
    size: input.source === "document" ? (input.document.size ?? null) : null,
  };
}
