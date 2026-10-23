import type { ContinuousStatisticGroup } from "../services/reportSemanticsService.js";
import type { AiGenerationInput, AiProvider } from "./types.js";

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function findHighestAverageStatistic(
  statistics: ContinuousStatisticGroup[],
): { group: ContinuousStatisticGroup; value: number } | null {
  const ranked = statistics
    .map((group) => ({
      group,
      value: average(
        group.replications
          .map((replication) => replication.overallAverage)
          .filter((value): value is number => value !== null),
      ),
    }))
    .filter(
      (
        entry,
      ): entry is { group: ContinuousStatisticGroup; value: number } =>
        entry.value !== null,
    )
    .sort((left, right) => right.value - left.value);

  return ranked[0] ?? null;
}

/**
 * Deterministic, report-grounded placeholder used until a real model is
 * configured. It intentionally returns facts from the normalized report so
 * the conversation pipeline can be demoed and tested without network access.
 */
export const mockAiProvider: AiProvider = {
  name: "mock",

  async generateReply(input: AiGenerationInput): Promise<string> {
    const { question, report, semantics } = input;
    const projectName = semantics.projectName ?? "This report";
    const replicationCount = semantics.declaredReplicationCount;
    const topStatistic = findHighestAverageStatistic(
      semantics.continuousStatistics,
    );

    const replicationText =
      replicationCount === null
        ? ""
        : ` across ${replicationCount} replication(s)`;

    const lines = [
      `[Mock AI] ${projectName} has ${semantics.totalContinuousRows} continuous-time statistic row(s) grouped into ${semantics.continuousStatistics.length} statistic(s)${replicationText}.`,
    ];

    if (topStatistic) {
      const type = topStatistic.group.type ?? "unknown type";

      lines.push(
        `The highest average continuous statistic is "${topStatistic.group.name}" (${type}) at ${topStatistic.value.toFixed(4)}.`,
      );
    } else {
      lines.push("No continuous-time statistics were found in this report.");
    }

    if (report.metadata.timeUnitLabel) {
      lines.push(`The report's time unit is ${report.metadata.timeUnitLabel}.`);
    }

    lines.push(
      `You asked: "${question}".`,
      "This is a deterministic mock response. Configure a real AI provider to generate a full analysis of this report.",
    );

    return lines.join("\n\n");
  },
};
