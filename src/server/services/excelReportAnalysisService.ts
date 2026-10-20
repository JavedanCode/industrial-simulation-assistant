import type { ReportAnalysisResult } from "./reportAnalysisService.js";
import { extractWorkbook } from "./reportParserService.js";
import { normalizeReport } from "./reportNormalizerService.js";
import { analyzeNormalizedReport } from "./reportAnalysisService.js";

export async function analyzeExcelReport(
  buffer: Uint8Array,
  fileName: string,
): Promise<ReportAnalysisResult> {
  const workbook = await extractWorkbook(buffer, fileName);
  const normalizedReport = normalizeReport(workbook);

  return analyzeNormalizedReport(normalizedReport);
}
