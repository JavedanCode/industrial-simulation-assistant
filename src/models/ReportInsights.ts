export type HalfWidthStatus =
  | "available"
  | "insufficient-data"
  | "correlated"
  | "unknown";

export interface MetricSummary {
  average: number | null;
  halfWidth: number | null;
  halfWidthStatus: HalfWidthStatus;
  minimum: number | null;
  maximum: number | null;
}

export interface ResourceInsight {
  name: string;
  averageNumberScheduled: number | null;
  scheduledUtilization: MetricSummary | null;
  instantaneousUtilization: MetricSummary | null;
  numberBusy: MetricSummary | null;
  numberSeized: MetricSummary | null;
}

export interface QueueInsight {
  name: string;
  resourceName: string | null;
  waitingTime: MetricSummary | null;
  numberWaiting: MetricSummary | null;
}

export interface EntityInsight {
  name: string;
  numberIn: MetricSummary | null;
  numberOut: MetricSummary | null;
  wip: MetricSummary | null;
  totalTime: MetricSummary | null;
  waitTime: MetricSummary | null;
  valueAddedTime: MetricSummary | null;
  nonValueAddedTime: MetricSummary | null;
  transferTime: MetricSummary | null;
  otherTime: MetricSummary | null;
}

export interface SystemInsight {
  numberOut: MetricSummary | null;
}

export interface ResourceBottleneckInsight {
  name: string;
  utilization: number;
  utilizationType: "scheduled" | "instantaneous";
  averageNumberScheduled: number | null;
  reasons: string[];
}

export interface QueueBottleneckInsight {
  name: string;
  averageNumberWaiting: number | null;
  averageWaitingTime: number | null;
  reasons: string[];
}

export interface BottleneckInsight {
  resource: ResourceBottleneckInsight | null;
  queue: QueueBottleneckInsight | null;
  summary: string;
}

export interface ReportInsights {
  schemaVersion: 1;
  timeUnitLabel: string | null;
  replicationCount: number | null;
  confidenceInterval: number | null;
  resources: ResourceInsight[];
  queues: QueueInsight[];
  entities: EntityInsight[];
  system: SystemInsight;
  bottleneck: BottleneckInsight;
  notes: string[];
}
