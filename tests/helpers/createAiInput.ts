import { analyzeExcelReport } from "../../src/server/services/excelReportAnalysisService.js";
import type {
  AiGenerationInput,
  AiHistoryMessage,
} from "../../src/server/ai/types.js";
import { createTestReport } from "./createTestReport.js";

export interface TestAiInputOptions {
  projectName?: string;
  question?: string;
  history?: AiHistoryMessage[];
}

/**
 * Build the same kind of structured input the conversation service passes to
 * an AI provider, but from the small synthetic workbook used by the API tests.
 */
export async function createTestAiInput(
  options: TestAiInputOptions = {},
): Promise<AiGenerationInput> {
  const analysis = await analyzeExcelReport(
    await createTestReport({
      projectName: options.projectName ?? "AI Test Project",
    }),
    "ai-test.xlsx",
  );

  return {
    question: options.question ?? "Which resource is the bottleneck?",
    report: analysis.report,
    semantics: analysis.semantics,
    insights: analysis.insights,
    history: options.history ?? [],
  };
}
