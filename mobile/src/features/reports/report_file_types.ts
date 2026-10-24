// Share these rules between the picker, Home, and saving so they stay consistent.
export const REPORT_FILE_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
];

export const REPORT_FORMAT_ERROR =
  "Please select an Excel file (.xls, .xlsx, or .xlsm).";

export function isExcelReport(name: string): boolean {
  // Check the final extension, including uppercase names such as REPORT.XLSX.
  // The backend still needs to validate the workbook's actual contents/layout.
  return /\.(xls|xlsx|xlsm)$/i.test(name);
}
