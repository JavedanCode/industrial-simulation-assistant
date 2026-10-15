export type ReportWarningCode =
  | "MISSING_FORMULA_RESULT"
  | "INVALID_VALUE"
  | "EXCEL_ERROR_VALUE";
export type ReportWarningSeverity = "warning" | "error";

export interface ReportWarning {
  code: ReportWarningCode;
  severity: ReportWarningSeverity;
  message: string;
  worksheet: string;
  cellAddress?: string;
  field?: string;
}
