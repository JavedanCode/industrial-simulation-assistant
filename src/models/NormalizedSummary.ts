import type { RawCellValue } from "./RawWorkbook.js";

export interface NormalizedSummarySection {
  sourceWorksheet: "AcrossReplicationsSummary";
  startColumn: string;
  endColumn: string;
  columns: string[];
  rows: Record<string, RawCellValue>[];
}

export interface NormalizedSummary {
  schemaVersion: 1;
  sections: {
    replicationAveragesWithObservations: NormalizedSummarySection;
    replicationAverages: NormalizedSummarySection;
    continuousAcrossReplications: NormalizedSummarySection;
    discreteAcrossReplications: NormalizedSummarySection;
    frequencySummary: NormalizedSummarySection;
  };
}
