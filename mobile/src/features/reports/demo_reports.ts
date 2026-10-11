import type { ReportSummery } from "./report_types";

export const demoReports: ReportSummery[] = [
  {
    id: "demo-report-1",
    title: "Weekly Production Report",
    createdAt: "2026-10-11T09:00+03:00",
    source: "document",
    status: "ready",
  },
  {
    id: "demo-report-2",
    title: "Assembly Line Review",
    createdAt: "2026-10-10T14:30+03:00",
    source: "text",
    status: "processing",
  },
  {
    id: "demo-report-3",
    title: "Resource Utilization",
    createdAt: "2026-10-09T11:15:00+03:00",
    source: "document",
    status: "failed",
  },
];
