import type {
  NormalizedReport,
  NormalizedTableRow,
} from "../../models/NormalizedReport.js";
import type {
  BottleneckInsight,
  EntityInsight,
  MetricSummary,
  QueueInsight,
  ReportInsights,
  ResourceInsight,
} from "../../models/ReportInsights.js";
import { interpretHalfWidth } from "./reportSemanticsService.js";

interface StatisticGroup {
  name: string;
  type: string;
  source: string;
  rows: NormalizedTableRow[];
}

const SCHEDULED_UTILIZATION_SUFFIX = ".ScheduledUtilization";
const NUMBER_SEIZED_SUFFIX = ".NumberSeized";

const VALUE_ADDED_TIME_TYPES = ["VA Time", "Value Added Time", "Value-Added Time"];
const NON_VALUE_ADDED_TIME_TYPES = [
  "NVA Time",
  "Non-Value Added Time",
  "Non Value Added Time",
];

function readText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readNonNegativeInteger(value: unknown): number | null {
  const number = readFiniteNumber(value);

  return number !== null && Number.isSafeInteger(number) && number >= 0
    ? number
    : null;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function finiteValues(rows: NormalizedTableRow[], keys: string[]): number[] {
  const values: number[] = [];

  for (const row of rows) {
    for (const key of keys) {
      const value = readFiniteNumber(row[key]);

      if (value !== null) {
        values.push(value);
      }
    }
  }

  return values;
}

function firstNumber(
  rows: NormalizedTableRow[],
  keys: string[],
): number | null {
  for (const row of rows) {
    for (const key of keys) {
      const value = readFiniteNumber(row[key]);

      if (value !== null) {
        return value;
      }
    }
  }

  return null;
}

function firstPresent(
  rows: NormalizedTableRow[],
  keys: string[],
): NormalizedTableRow[string] | undefined {
  for (const row of rows) {
    for (const key of keys) {
      const value = row[key];

      if (value !== undefined && value !== null) {
        return value;
      }
    }
  }

  return undefined;
}

function minimum(rows: NormalizedTableRow[], keys: string[]): number | null {
  const values = finiteValues(rows, keys);

  return values.length > 0 ? Math.min(...values) : null;
}

function maximum(rows: NormalizedTableRow[], keys: string[]): number | null {
  const values = finiteValues(rows, keys);

  return values.length > 0 ? Math.max(...values) : null;
}

function readAverage(rows: NormalizedTableRow[]): number | null {
  const overallAverage = firstNumber(rows, ["AverageOfAverage"]);

  if (overallAverage !== null) {
    return overallAverage;
  }

  const replicationAverages = finiteValues(rows, ["Average"]);

  if (replicationAverages.length > 0) {
    return average(replicationAverages);
  }

  return average(finiteValues(rows, ["RecordedValue"]));
}

function summarizeMetric(rows: NormalizedTableRow[]): MetricSummary | null {
  if (rows.length === 0) {
    return null;
  }

  const rawHalfWidth = firstPresent(rows, ["SummaryHalfWidth", "HalfWidth"]);
  const halfWidth = interpretHalfWidth(rawHalfWidth ?? null);

  return {
    average: readAverage(rows),
    halfWidth: halfWidth.status === "available" ? halfWidth.value : null,
    halfWidthStatus:
      halfWidth.status === "available"
        ? "available"
        : halfWidth.reason === "insufficient-data" ||
            halfWidth.reason === "correlated"
          ? halfWidth.reason
          : "unknown",
    minimum: minimum(rows, ["OverallMinimum", "Minimum"]),
    maximum: maximum(rows, ["OverallMaximum", "Maximum"]),
  };
}

function groupStatistics(rows: NormalizedTableRow[]): StatisticGroup[] {
  const groups = new Map<string, StatisticGroup>();

  for (const row of rows) {
    const name = readText(row.Name);
    const type = readText(row.Type);
    const source = readText(row.Source);

    if (name === null || type === null || source === null) {
      continue;
    }

    const key = JSON.stringify([name, type, source]);
    let group = groups.get(key);

    if (!group) {
      group = {
        name,
        type,
        source,
        rows: [],
      };

      groups.set(key, group);
    }

    group.rows.push(row);
  }

  return Array.from(groups.values());
}

function findGroup(
  groups: StatisticGroup[],
  criteria: {
    name?: string;
    types: string[];
    source: string;
  },
): StatisticGroup | null {
  const expectedName = criteria.name?.toLowerCase();
  const expectedTypes = new Set(
    criteria.types.map((type) => type.toLowerCase()),
  );
  const expectedSource = criteria.source.toLowerCase();

  return (
    groups.find(
      (group) =>
        group.source.toLowerCase() === expectedSource &&
        expectedTypes.has(group.type.toLowerCase()) &&
        (expectedName === undefined ||
          group.name.toLowerCase() === expectedName),
    ) ?? null
  );
}

function summarizeGroup(
  groups: StatisticGroup[],
  criteria: {
    name?: string;
    types: string[];
    source: string;
  },
): MetricSummary | null {
  const group = findGroup(groups, criteria);

  return group ? summarizeMetric(group.rows) : null;
}

function inferResourceName(
  queueName: string,
  resources: ResourceInsight[],
): string | null {
  const baseName = queueName.replace(/\.Queue\d*$/i, "").trim();
  const exactMatch = resources.find(
    (resource) =>
      resource.name.toLowerCase() === baseName.toLowerCase(),
  );

  if (exactMatch) {
    return exactMatch.name;
  }

  const prefixMatch = resources.find((resource) =>
    queueName.toLowerCase().startsWith(`${resource.name.toLowerCase()}.`),
  );

  return prefixMatch?.name ?? null;
}

function buildResources(
  continuousGroups: StatisticGroup[],
  outputGroups: StatisticGroup[],
): ResourceInsight[] {
  const names = new Set<string>();

  for (const group of continuousGroups) {
    if (group.source.toLowerCase() === "resource") {
      names.add(group.name);
    }
  }

  for (const group of outputGroups) {
    const lowerName = group.name.toLowerCase();

    if (
      group.type.toLowerCase() === "scheduled utilization" &&
      lowerName.endsWith(SCHEDULED_UTILIZATION_SUFFIX.toLowerCase())
    ) {
      names.add(group.name.slice(0, -SCHEDULED_UTILIZATION_SUFFIX.length));
    }

    if (
      group.type.toLowerCase() === "total number seized" &&
      lowerName.endsWith(NUMBER_SEIZED_SUFFIX.toLowerCase())
    ) {
      names.add(group.name.slice(0, -NUMBER_SEIZED_SUFFIX.length));
    }
  }

  return Array.from(names)
    .map((name): ResourceInsight => {
      const numberScheduled = summarizeGroup(continuousGroups, {
        name,
        types: ["Number Scheduled"],
        source: "Resource",
      });

      return {
        name,
        averageNumberScheduled: numberScheduled?.average ?? null,
        scheduledUtilization: summarizeGroup(outputGroups, {
          name: `${name}${SCHEDULED_UTILIZATION_SUFFIX}`,
          types: ["Scheduled Utilization"],
          source: "Resource",
        }),
        instantaneousUtilization: summarizeGroup(continuousGroups, {
          name,
          types: ["Instantaneous Utilization"],
          source: "Resource",
        }),
        numberBusy: summarizeGroup(continuousGroups, {
          name,
          types: ["Number Busy"],
          source: "Resource",
        }),
        numberSeized: summarizeGroup(outputGroups, {
          name: `${name}${NUMBER_SEIZED_SUFFIX}`,
          types: ["Total Number Seized"],
          source: "Resource",
        }),
      };
    })
    .sort((left, right) => {
      const leftUtilization =
        left.scheduledUtilization?.average ??
        left.instantaneousUtilization?.average ??
        -1;
      const rightUtilization =
        right.scheduledUtilization?.average ??
        right.instantaneousUtilization?.average ??
        -1;

      return (
        rightUtilization - leftUtilization ||
        left.name.localeCompare(right.name)
      );
    });
}

function buildQueues(
  continuousGroups: StatisticGroup[],
  discreteGroups: StatisticGroup[],
  resources: ResourceInsight[],
): QueueInsight[] {
  const names = new Set<string>();

  for (const group of continuousGroups) {
    if (
      group.source.toLowerCase() === "queue" &&
      group.type.toLowerCase() === "number waiting"
    ) {
      names.add(group.name);
    }
  }

  for (const group of discreteGroups) {
    if (
      group.source.toLowerCase() === "queue" &&
      group.type.toLowerCase() === "waiting time"
    ) {
      names.add(group.name);
    }
  }

  return Array.from(names)
    .map(
      (name): QueueInsight => ({
        name,
        resourceName: inferResourceName(name, resources),
        waitingTime: summarizeGroup(discreteGroups, {
          name,
          types: ["Waiting Time"],
          source: "Queue",
        }),
        numberWaiting: summarizeGroup(continuousGroups, {
          name,
          types: ["Number Waiting"],
          source: "Queue",
        }),
      }),
    )
    .sort((left, right) => {
      const leftWaitingTime = left.waitingTime?.average ?? -1;
      const rightWaitingTime = right.waitingTime?.average ?? -1;
      const leftNumberWaiting = left.numberWaiting?.average ?? -1;
      const rightNumberWaiting = right.numberWaiting?.average ?? -1;

      return (
        rightWaitingTime - leftWaitingTime ||
        rightNumberWaiting - leftNumberWaiting ||
        left.name.localeCompare(right.name)
      );
    });
}

function buildEntities(
  continuousGroups: StatisticGroup[],
  discreteGroups: StatisticGroup[],
  outputGroups: StatisticGroup[],
): EntityInsight[] {
  const names = new Set<string>();

  for (const group of continuousGroups) {
    if (
      group.source.toLowerCase() === "entity" &&
      group.type.toLowerCase() === "wip"
    ) {
      names.add(group.name);
    }
  }

  for (const group of discreteGroups) {
    if (group.source.toLowerCase() === "entity") {
      names.add(group.name);
    }
  }

  for (const group of outputGroups) {
    if (group.source.toLowerCase() === "entity") {
      names.add(
        group.name.replace(/\.(NumberIn|NumberOut)$/i, ""),
      );
    }
  }

  function entityMetric(
    name: string,
    types: string[],
    source: "Entity",
    tableGroups: StatisticGroup[],
  ): MetricSummary | null {
    const group = findGroup(tableGroups, { name, types, source });

    return group ? summarizeMetric(group.rows) : null;
  }

  return Array.from(names)
    .map(
      (name): EntityInsight => ({
        name,
        numberIn: entityMetric(
          `${name}.NumberIn`,
          ["Number In"],
          "Entity",
          outputGroups,
        ),
        numberOut: entityMetric(
          `${name}.NumberOut`,
          ["Number Out"],
          "Entity",
          outputGroups,
        ),
        wip: entityMetric(name, ["WIP"], "Entity", continuousGroups),
        totalTime: entityMetric(
          name,
          ["Total Time"],
          "Entity",
          discreteGroups,
        ),
        waitTime: entityMetric(
          name,
          ["Wait Time"],
          "Entity",
          discreteGroups,
        ),
        valueAddedTime: entityMetric(
          name,
          VALUE_ADDED_TIME_TYPES,
          "Entity",
          discreteGroups,
        ),
        nonValueAddedTime: entityMetric(
          name,
          NON_VALUE_ADDED_TIME_TYPES,
          "Entity",
          discreteGroups,
        ),
        transferTime: entityMetric(
          name,
          ["Transfer Time"],
          "Entity",
          discreteGroups,
        ),
        otherTime: entityMetric(
          name,
          ["Other Time"],
          "Entity",
          discreteGroups,
        ),
      }),
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}

function formatNumber(value: number, digits = 2): string {
  const rounded = Number(value.toFixed(digits));

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits);
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function buildBottleneck(
  resources: ResourceInsight[],
  queues: QueueInsight[],
  systemNumberOut: number | null,
  timeUnitLabel: string | null,
): BottleneckInsight {
  const hasResourceUtilization = resources.some(
    (resource) =>
      (resource.scheduledUtilization?.average ??
        resource.instantaneousUtilization?.average ??
        0) > 0,
  );
  const hasSystemThroughput = (systemNumberOut ?? 0) > 0;
  const canAssessBottleneck =
    resources.length === 0 || hasResourceUtilization || hasSystemThroughput;

  const topResource = !canAssessBottleneck
    ? undefined
    : resources
        .map((resource) => {
          const scheduledUtilization =
            resource.scheduledUtilization?.average ?? null;
          const instantaneousUtilization =
            resource.instantaneousUtilization?.average ?? null;
          const utilization =
            scheduledUtilization ?? instantaneousUtilization;

          return {
            resource,
            utilization,
            utilizationType:
              scheduledUtilization !== null
                ? ("scheduled" as const)
                : ("instantaneous" as const),
          };
        })
        .filter(
          (
            entry,
          ): entry is {
            resource: ResourceInsight;
            utilization: number;
            utilizationType: "scheduled" | "instantaneous";
          } => entry.utilization !== null && entry.utilization > 0,
        )
        .sort(
          (left, right) =>
            right.utilization - left.utilization ||
            left.resource.name.localeCompare(right.resource.name),
        )[0];

  const topQueue = !canAssessBottleneck
    ? undefined
    : queues
        .map((queue) => ({
          queue,
          waitingTime: queue.waitingTime?.average ?? null,
          numberWaiting: queue.numberWaiting?.average ?? null,
        }))
        .filter(
          (entry) =>
            (entry.waitingTime ?? 0) > 0 || (entry.numberWaiting ?? 0) > 0,
        )
        .sort(
          (left, right) =>
            (right.waitingTime ?? -1) - (left.waitingTime ?? -1) ||
            (right.numberWaiting ?? -1) - (left.numberWaiting ?? -1) ||
            left.queue.name.localeCompare(right.queue.name),
        )[0];

  const timeUnit = timeUnitLabel ?? "time units";
  const resourceReasonParts: string[] = [];

  if (topResource) {
    const { resource, utilization, utilizationType } = topResource;
    const utilizationLabel =
      utilizationType === "scheduled"
        ? "Scheduled utilization"
        : "Instantaneous utilization";

    resourceReasonParts.push(
      `${utilizationLabel}: ${formatPercentage(utilization)}`,
    );

    if (resource.averageNumberScheduled !== null) {
      resourceReasonParts.push(
        `Average scheduled units: ${formatNumber(resource.averageNumberScheduled)}`,
      );
    }

    if (resource.numberBusy && resource.numberBusy.average !== null) {
      resourceReasonParts.push(
        `Average number busy: ${formatNumber(resource.numberBusy.average)}`,
      );
    }

    if (resource.numberSeized && resource.numberSeized.average !== null) {
      resourceReasonParts.push(
        `Average number seized: ${formatNumber(resource.numberSeized.average)}`,
      );
    }
  }

  const queueReasonParts: string[] = [];

  if (topQueue) {
    const { queue, waitingTime, numberWaiting } = topQueue;

    if (numberWaiting !== null) {
      queueReasonParts.push(
        `Average number waiting: ${formatNumber(numberWaiting)}`,
      );
    }

    if (waitingTime !== null) {
      queueReasonParts.push(
        `Average waiting time: ${formatNumber(waitingTime)} ${timeUnit}`,
      );
    }

    if (queue.waitingTime && queue.waitingTime.maximum !== null) {
      queueReasonParts.push(
        `Maximum waiting time: ${formatNumber(queue.waitingTime.maximum)} ${timeUnit}`,
      );
    }
  }

  const resource = topResource
    ? {
        name: topResource.resource.name,
        utilization: topResource.utilization,
        utilizationType: topResource.utilizationType,
        averageNumberScheduled:
          topResource.resource.averageNumberScheduled,
        reasons: resourceReasonParts,
      }
    : null;

  const queue = topQueue
    ? {
        name: topQueue.queue.name,
        averageNumberWaiting: topQueue.numberWaiting,
        averageWaitingTime: topQueue.waitingTime,
        reasons: queueReasonParts,
      }
    : null;

  const summaryParts: string[] = [];

  if (resource) {
    const scheduledUnits =
      resource.averageNumberScheduled === null
        ? null
        : formatNumber(resource.averageNumberScheduled);
    const capacityText =
      scheduledUnits === null
        ? ""
        : `, averaging ${scheduledUnits} scheduled ${scheduledUnits === "1" ? "unit" : "units"}`;
    const utilizationLabel =
      resource.utilizationType === "scheduled"
        ? "scheduled utilization"
        : "instantaneous utilization";

    summaryParts.push(
      `The most utilized resource is "${resource.name}" at ${formatPercentage(resource.utilization)} ${utilizationLabel}${capacityText}.`,
    );
  }

  if (queue) {
    const queueMetricParts: string[] = [];

    if (queue.averageNumberWaiting !== null) {
      queueMetricParts.push(
        `${formatNumber(queue.averageNumberWaiting)} entities waiting on average`,
      );
    }

    if (queue.averageWaitingTime !== null) {
      queueMetricParts.push(
        `${formatNumber(queue.averageWaitingTime)} ${timeUnit} of average waiting time`,
      );
    }

    summaryParts.push(
      `The most congested queue is "${queue.name}" with ${queueMetricParts.length > 0 ? queueMetricParts.join(" and ") : "the highest waiting metrics"}.`,
    );
  }

  if (summaryParts.length === 0) {
    summaryParts.push(
      canAssessBottleneck
        ? "No positive resource utilization or queue waiting averages were found in this report."
        : "No bottleneck was designated because all resource utilizations and system throughput are zero.",
    );
  }

  return {
    resource,
    queue,
    summary: summaryParts.join(" "),
  };
}

export function buildReportInsights(report: NormalizedReport): ReportInsights {
  const continuousGroups = groupStatistics(
    report.tables.continuousTimeStats.rows,
  );
  const discreteGroups = groupStatistics(report.tables.discreteTimeStats.rows);
  const outputGroups = groupStatistics(report.tables.outputStats.rows);

  const resources = buildResources(continuousGroups, outputGroups);
  const queues = buildQueues(continuousGroups, discreteGroups, resources);
  const entities = buildEntities(
    continuousGroups,
    discreteGroups,
    outputGroups,
  );

  const systemNumberOut = summarizeGroup(outputGroups, {
    name: "System.NumberOut",
    types: ["Number Out"],
    source: "System",
  });

  const bottleneck = buildBottleneck(
    resources,
    queues,
    systemNumberOut?.average ?? null,
    report.metadata.timeUnitLabel,
  );

  const notes: string[] = [];

  if (report.metadata.timeUnitLabel === null) {
    notes.push(
      "The report does not declare a time unit; time-based values use Arena time units.",
    );
  }

  const unmatchedQueues = queues
    .filter((queue) => queue.resourceName === null)
    .map((queue) => `"${queue.name}"`);

  if (unmatchedQueues.length > 0) {
    notes.push(
      `Queue-resource links could not be inferred by name for ${unmatchedQueues.join(", ")}. Queue metrics are reported independently.`,
    );
  }

  if (resources.length === 0 && queues.length === 0) {
    notes.push(
      "No resource or queue statistics were found in this report.",
    );
  } else if (
    resources.length > 0 &&
    !resources.some(
      (resource) =>
        (resource.scheduledUtilization?.average ??
          resource.instantaneousUtilization?.average ??
          0) > 0,
    ) &&
    (systemNumberOut?.average ?? 0) <= 0
  ) {
    notes.push(
      "All resource utilizations and system throughput are zero; bottleneck detection was skipped.",
    );
  } else if (bottleneck.resource === null && bottleneck.queue === null) {
    notes.push(
      "No positive resource utilization or queue waiting averages were found; bottleneck detection was skipped.",
    );
  }

  return {
    schemaVersion: 1,
    timeUnitLabel: report.metadata.timeUnitLabel,
    replicationCount: readNonNegativeInteger(
      report.metadata.numberOfReplications,
    ),
    confidenceInterval: readFiniteNumber(
      report.metadata.confidenceInterval,
    ),
    resources,
    queues,
    entities,
    system: {
      numberOut: systemNumberOut,
    },
    bottleneck,
    notes,
  };
}
