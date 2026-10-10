import { DocumentPickerAsset } from "expo-document-picker";

type ReportSubmissionInput =
  | {
      source: "text";
      title: string;
      content: string;
    }
  | {
      source: "document";
      document: DocumentPickerAsset;
    };

type DemoSubmissionOptions = {
  shouldFail?: boolean;
};

export async function submitReportDemo(
  report: ReportSubmissionInput,
  options: DemoSubmissionOptions = {},
): Promise<void> {
  if (report.source === "text" && !report.content.trim()) {
    throw new Error("Enter some report text before submitting.");
  }

  if (report.source === "document" && !report.document.uri) {
    throw new Error("Select a document before submitting.");
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 2000);
  });

  if (options.shouldFail) {
    throw new Error("Demo submission failed. Please try again.");
  }
}
