type ReportSubmissionInput = {
  title: string;
  content: string;
};

type DemoSubmissionOptions = {
  shouldFail?: boolean;
};

export async function submitReportDemo(
  report: ReportSubmissionInput,
  options: DemoSubmissionOptions = {},
): Promise<void> {
  if (!report.content.trim()) {
    throw new Error("Enter some report text before submitting.");
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 2000);
  });

  if (options.shouldFail) {
    throw new Error("Demo submission failed. Please try again.");
  }
}
