// Keep validation shared so native storage and the browser demo behave alike.
export const MAX_REPORT_TITLE_LENGTH = 120;

export function validateReportTitle(value: string) {
  const title = value.trim();
  if (!title) throw new Error("Enter a report name.");
  if (title.length > MAX_REPORT_TITLE_LENGTH)
    throw new Error("Keep the report name within 120 characters.");
  return title;
}
