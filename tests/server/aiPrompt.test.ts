import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildGroundedPrompt } from "../../src/server/ai/promptBuilder.js";
import { analyzeExcelReport } from "../../src/server/services/excelReportAnalysisService.js";
import { createTestAiInput } from "../helpers/createAiInput.js";

describe("grounded AI prompt", () => {
  it("puts report facts and grounding rules in the system instruction", async () => {
    const input = await createTestAiInput({
      history: [
        { role: "user", content: "Earlier question" },
        { role: "assistant", content: "Earlier answer" },
      ],
    });

    const prompt = buildGroundedPrompt(input);

    expect(prompt.question).toBe("Which resource is the bottleneck?");
    expect(prompt.history).toEqual(input.history);
    expect(prompt.systemInstruction).toContain("REPORT CONTEXT");
    expect(prompt.systemInstruction).toContain("AI Test Project");
    expect(prompt.systemInstruction).toContain("Assembler");
    expect(prompt.systemInstruction).toContain("bottleneck");
    expect(prompt.systemInstruction).toContain("Do not estimate");
    expect(prompt.systemInstruction).toContain("untrusted data");
  });

  it("includes compact statistics without sending local file paths", async () => {
    const input = await createTestAiInput();
    const prompt = buildGroundedPrompt(input);

    // The two synthetic replications average to 0.775.
    expect(prompt.systemInstruction).toContain('"average": 0.775');
    expect(prompt.systemInstruction).toContain('"continuousTimeStats": 2');
    expect(prompt.systemInstruction).not.toContain("test.p");
  });

  const reportFileName = "arena-example-2.xlsm";
  const reportPath = `local-reports/${reportFileName}`;

  it.skipIf(!existsSync(reportPath))(
    "keeps a real report's key facts in a compact prompt",
    async () => {
      const analysis = await analyzeExcelReport(
        readFileSync(reportPath),
        reportFileName,
      );

      const prompt = buildGroundedPrompt({
        question: "Where is the bottleneck?",
        report: analysis.report,
        semantics: analysis.semantics,
        insights: analysis.insights,
        history: [],
      });

      expect(prompt.systemInstruction).toContain("MilkShake_Maker");
      expect(prompt.systemInstruction).toContain("Billing Counter.Queue");
      expect(prompt.systemInstruction).toContain("8.8691");
      expect(prompt.systemInstruction).toContain('"timeUnit": "Minutes"');
      expect(prompt.systemInstruction).not.toContain("local-reports");
      expect(prompt.systemInstruction.length).toBeLessThan(50_000);
    },
  );
});
