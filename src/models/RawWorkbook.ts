import type { ReportWarning } from "./ReportWarning.ts";
export type RawCellValue = string | number | boolean | null;

export interface RawCell {
  address: string;
  value: RawCellValue;
  type: string;
  formula?: string;
  result?: RawCellValue;
}

export interface RawWorksheet {
  name: string;
  rowCount: number;
  columnCount: number;
  rows: {
    excelRow: number;
    cells: RawCell[];
  }[];
}

export interface RawWorkbook {
  schemaVersion: 1;
  sourceFormat: "xlsm" | "xlsx";
  worksheets: RawWorksheet[];
  warnings?: ReportWarning[];
}
