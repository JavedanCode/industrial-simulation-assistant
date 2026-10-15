import type { RawCellValue } from "./RawWorkbook.js";
import type { ReportWarning } from "./ReportWarning.js";

export interface ReportMetadata {
  projectName: RawCellValue;
  modelFile: RawCellValue;
  modelRunDate: RawCellValue;
  timeUnits: RawCellValue;
  numberOfReplications: RawCellValue;
  averageStatCollectionLength: RawCellValue;
  confidenceInterval: RawCellValue;
}

export interface NormalizedTableRow {
  [column: string]: RawCellValue;
}

export interface NormalizedTable {
  sourceWorksheet: string;
  columns: string[];
  rows: NormalizedTableRow[];
}

export interface NormalizedReport {
  schemaVersion: 1;
  sourceFormat: "xlsm" | "xlsx";
  metadata: ReportMetadata;
  tables: {
    discreteTimeStats: NormalizedTable;
    continuousTimeStats: NormalizedTable;
    counterStats: NormalizedTable;
    outputStats: NormalizedTable;
    frequencyStats: NormalizedTable;
  };
  warnings: ReportWarning[];
}
