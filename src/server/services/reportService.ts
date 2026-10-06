export function parseReport(reportText: string) {
  return {
    message: "Report received successfully",
    characterCount: reportText.length,
  };
}
