import type { RawCellValue } from "../../models/RawWorkbook.js";

import type { NormalizedTableRow } from "../../models/NormalizedReport.js";

import type { NormalizedReport } from "../../models/NormalizedReport.js";

export type StatisticInterpretation = {
  category: "utilization" | "resource" | "throughput" | "unknown";
  description: string;
  recognized: boolean;
};

interface StatisticRule {
  type: string;
  source: string;
  category: StatisticInterpretation["category"];
  description: string;
}

const STATISTIC_RULES: StatisticRule[] = [
  {
    type: "Instantaneous Utilization",
    source: "Resource",
    category: "utilization",
    description:
      "Describes the resource's utilization at a particular instant.",
  },
  {
    type: "Number Busy",
    source: "Resource",
    category: "resource",
    description:
      "Measures the number of resource units busy over the observation period.",
  },
  {
    type: "Number Scheduled",
    source: "Resource",
    category: "resource",
    description:
      "Measures the number of resource units scheduled to be available.",
  },
  {
    type: "Scheduled Utilization",
    source: "Resource",
    category: "utilization",
    description:
      "Describes resource utilization relative to its scheduled capacity.",
  },
  {
    type: "Number Out",
    source: "System",
    category: "throughput",
    description: "Measures the number of entities that have exited the system.",
  },
  {
    type: "Total Number Seized",
    source: "Resource",
    category: "resource",
    description:
      "Measures the total number of times the resource has been seized.",
  },
];

export function interpretStatisticRow(
  row: NormalizedTableRow,
): StatisticInterpretation {
  const type =
    typeof row.Type === "string" ? row.Type.trim().toLowerCase() : "";

  const source =
    typeof row.Source === "string" ? row.Source.trim().toLowerCase() : "";

  const rule = STATISTIC_RULES.find(
    (candidate) =>
      candidate.type.toLowerCase() === type &&
      candidate.source.toLowerCase() === source,
  );

  if (!rule) {
    return {
      category: "unknown",
      description:
        "This statistic is not yet supported by the interpretation rules.",
      recognized: false,
    };
  }

  return {
    category: rule.category,
    description: rule.description,
    recognized: true,
  };
}

export type HalfWidthInterpretation =
  | {
      status: "available";
      value: number;
    }
  | {
      status: "unavailable";
      reason: "insufficient-data" | "correlated" | "unknown";
      rawValue: RawCellValue;
    };

export function interpretHalfWidth(
  value: RawCellValue,
): HalfWidthInterpretation {
  if (typeof value === "number" && Number.isFinite(value)) {
    return {
      status: "available",
      value,
    };
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "insufficient") {
      return {
        status: "unavailable",
        reason: "insufficient-data",
        rawValue: value,
      };
    }

    if (normalizedValue === "correlated") {
      return {
        status: "unavailable",
        reason: "correlated",
        rawValue: value,
      };
    }
  }

  return {
    status: "unavailable",
    reason: "unknown",
    rawValue: value,
  };
}

export interface ContinuousTimeStatistic {
  name: string | null;
  type: string | null;
  source: string | null;
  replication: number | null;
  replicationAverage: number | null;
  overallAverage: number | null;
  overallHalfWidth: HalfWidthInterpretation;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function interpretContinuousTimeRow(
  row: NormalizedTableRow,
): ContinuousTimeStatistic {
  return {
    name: readString(row.Name),
    type: readString(row.Type),
    source: readString(row.Source),
    replication: readFiniteNumber(row.Replication),
    replicationAverage: readFiniteNumber(row.Average),
    overallAverage: readFiniteNumber(row.AverageOfAverage),
    overallHalfWidth: interpretHalfWidth(row.SummaryHalfWidth),
  };
}

export interface ContinuousStatisticGroup {
  name: string | null;
  type: string | null;
  source: string | null;
  replicationCount: number;
  replications: ContinuousTimeStatistic[];
}

export function groupContinuousTimeStats(
  rows: NormalizedTableRow[],
): ContinuousStatisticGroup[] {
  const groups = new Map<string, ContinuousStatisticGroup>();

  for (const row of rows) {
    const statistic = interpretContinuousTimeRow(row);

    // Without these fields, we cannot safely identify the statistic.
    if (
      statistic.name === null ||
      statistic.type === null ||
      statistic.source === null
    ) {
      continue;
    }

    const key = JSON.stringify([
      statistic.name,
      statistic.type,
      statistic.source,
    ]);

    let group = groups.get(key);

    if (!group) {
      group = {
        name: statistic.name,
        type: statistic.type,
        source: statistic.source,
        replicationCount: 0,
        replications: [],
      };

      groups.set(key, group);
    }

    group.replications.push(statistic);
    group.replicationCount += 1;
  }

  return Array.from(groups.values());
}

export interface ReportSemanticSummary {
  projectName: string | null;
  modelRunDate: string | null;
  declaredReplicationCount: number | null;
  continuousStatistics: ContinuousStatisticGroup[];
  totalContinuousRows: number;
  groupedContinuousRows: number;
  skippedContinuousRows: number;
  recognizedStatisticCount: number;
  unrecognizedStatisticCount: number;
}

function readNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

export function buildReportSemanticSummary(
  report: NormalizedReport,
): ReportSemanticSummary {
  const rows = report.tables.continuousTimeStats.rows;
  const continuousStatistics = groupContinuousTimeStats(rows);

  const recognizedStatisticCount = rows.filter(
    (row) => interpretStatisticRow(row).recognized,
  ).length;

  const groupedContinuousRows = continuousStatistics.reduce(
    (count, group) => count + group.replications.length,
    0,
  );

  return {
    projectName: readString(report.metadata.projectName),
    modelRunDate: readString(report.metadata.modelRunDate),
    declaredReplicationCount: readNonNegativeInteger(
      report.metadata.numberOfReplications,
    ),
    continuousStatistics,
    totalContinuousRows: rows.length,
    groupedContinuousRows,
    skippedContinuousRows: rows.length - groupedContinuousRows,
    recognizedStatisticCount,
    unrecognizedStatisticCount: rows.length - recognizedStatisticCount,
  };
}
