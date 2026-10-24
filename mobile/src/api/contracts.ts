import { ApiError } from "./client";
import type { chatMsg } from "@/features/reports/chat/chat_types";

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(
      "Unexpected API response. Check that both branches use the same API version.",
    );
  return value as Record<string, unknown>;
}
export function text(value: unknown): string {
  if (typeof value !== "string")
    throw new ApiError("The server returned an invalid text field.");
  return value;
}
export function uuid(value: unknown): string {
  const result = text(value);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      result,
    )
  )
    throw new ApiError("The server returned an invalid ID.");
  return result;
}
export function array(value: unknown): unknown[] {
  if (!Array.isArray(value))
    throw new ApiError("The server returned an invalid list.");
  return value;
}
export function apiMsg(value: unknown, conversationId: string): chatMsg {
  const msg = object(value);
  if (
    uuid(msg.conversationId) !== conversationId ||
    (msg.role !== "user" && msg.role !== "assistant") ||
    !Number.isFinite(Date.parse(text(msg.createdAt)))
  )
    throw new ApiError("The server returned an invalid chat message.");
  return {
    id: uuid(msg.messageId),
    role: msg.role,
    content: text(msg.content),
    createdAt: text(msg.createdAt),
  };
}

export type AnalysisPresentation = {
  markdown: string;
  utilization: { name: string; value: number; kind: string }[];
};
const escapeCell = (value: string) =>
  value.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
function numeric(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new ApiError("The server returned an invalid analysis value.");
  return value;
}
function average(value: unknown) {
  return value === null ? null : numeric(object(value).average);
}
const display = (value: number | null) =>
  value === null ? "Not available" : String(value);

// Presentation only: metrics and bottleneck conclusions are supplied by the backend.
export function analysisPresentation(value: unknown): AnalysisPresentation {
  const data = object(value);
  object(data.report);
  const semantics = object(data.semantics);
  const insights = object(data.insights);
  if (insights.schemaVersion !== 1)
    throw new ApiError("Unsupported analysis schema version.");
  const unit =
    insights.timeUnitLabel === null
      ? "unit not specified"
      : text(insights.timeUnitLabel);
  const lines = [
    "## Report analysis",
    semantics.projectName === null
      ? "Project name not available"
      : escapeCell(text(semantics.projectName)),
    `Time units: ${escapeCell(unit)}`,
    `Replications: ${display(numeric(insights.replicationCount))}`,
    "",
    "### Main finding",
    text(object(insights.bottleneck).summary),
  ];
  const utilization: AnalysisPresentation["utilization"] = [];
  const resources = array(insights.resources);
  if (resources.length) {
    lines.push(
      "",
      "### Resources",
      "| Resource | Utilization (ratio) | Basis |",
      "| --- | --- | --- |",
    );
    for (const value of resources) {
      const row = object(value),
        name = text(row.name);
      const scheduled = average(row.scheduledUtilization);
      const instantaneous = average(row.instantaneousUtilization);
      const metric = scheduled ?? instantaneous,
        kind = scheduled !== null ? "Scheduled" : "Instantaneous";
      lines.push(
        `| ${escapeCell(name)} | ${display(metric)} | ${metric === null ? "Not available" : kind} |`,
      );
      if (metric !== null) utilization.push({ name, value: metric, kind });
    }
  }
  const queues = array(insights.queues);
  if (queues.length) {
    lines.push(
      "",
      "### Queues",
      `Waiting time uses ${escapeCell(unit)}.`,
      "| Queue | Average waiting time | Average number waiting |",
      "| --- | --- | --- |",
    );
    for (const value of queues) {
      const row = object(value);
      lines.push(
        `| ${escapeCell(text(row.name))} | ${display(average(row.waitingTime))} | ${display(average(row.numberWaiting))} |`,
      );
    }
  }
  const entities = array(insights.entities);
  if (entities.length) {
    lines.push(
      "",
      "### Entities",
      `Total time uses ${escapeCell(unit)}.`,
      "| Entity | Average number out | Average total time |",
      "| --- | --- | --- |",
    );
    for (const value of entities) {
      const row = object(value);
      lines.push(
        `| ${escapeCell(text(row.name))} | ${display(average(row.numberOut))} | ${display(average(row.totalTime))} |`,
      );
    }
  }
  lines.push(
    "",
    `System average number out: ${display(average(object(insights.system).numberOut))}`,
  );
  const notes = array(insights.notes).map(text);
  if (notes.length)
    lines.push("", "### Notes", ...notes.map((note) => `- ${note}`));
  return { markdown: lines.join("\n"), utilization };
}
