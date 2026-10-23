import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeExcelReport } from "../../src/server/services/excelReportAnalysisService.js";

describe("derived report insights", () => {
  const reportFileName = "arena-example-2.xlsm";
  const reportPath = `local-reports/${reportFileName}`;

  it.skipIf(!existsSync(reportPath))(
    "derives resource, queue, entity, and throughput metrics from a real report",
    async () => {
      const { insights } = await analyzeExcelReport(
        readFileSync(reportPath),
        reportFileName,
      );

      expect(insights.timeUnitLabel).toBe("Minutes");
      expect(insights.replicationCount).toBe(50);
      expect(insights.confidenceInterval).toBe(0.95);

      const milkShakeMaker = insights.resources.find(
        (resource) => resource.name === "MilkShake_Maker",
      );
      const cashier = insights.resources.find(
        (resource) => resource.name === "Cashier",
      );

      expect(milkShakeMaker?.averageNumberScheduled).toBe(1);
      expect(
        milkShakeMaker?.scheduledUtilization?.average,
      ).toBeCloseTo(0.8231, 4);
      expect(
        milkShakeMaker?.numberSeized?.average,
      ).toBeCloseTo(34.96, 2);
      expect(cashier?.averageNumberScheduled).toBe(2);
      expect(cashier?.numberBusy?.average).toBeCloseTo(1.2402, 4);
      expect(cashier?.numberSeized?.average).toBeCloseTo(63.72, 2);

      const billingQueue = insights.queues.find(
        (queue) => queue.name === "Billing Counter.Queue",
      );

      expect(billingQueue?.waitingTime?.average).toBeCloseTo(8.8691, 4);
      expect(billingQueue?.waitingTime?.maximum).toBeCloseTo(51.4522, 4);
      expect(billingQueue?.numberWaiting?.average).toBeCloseTo(3.055, 3);
      expect(billingQueue?.resourceName).toBeNull();

      const customer = insights.entities.find(
        (entity) => entity.name === "Customer",
      );

      expect(customer?.numberIn?.average).toBeCloseTo(46.46, 2);
      expect(customer?.numberOut?.average).toBeCloseTo(31.14, 2);
      expect(customer?.wip?.average).toBeCloseTo(9.8194, 4);
      expect(customer?.totalTime?.average).toBeCloseTo(26.5778, 4);
      expect(customer?.waitTime?.average).toBeCloseTo(24.2123, 4);
      expect(customer?.valueAddedTime?.average).toBeCloseTo(2.3655, 4);

      expect(insights.system.numberOut?.average).toBeCloseTo(31.14, 2);
      expect(insights.system.numberOut?.halfWidth).toBeCloseTo(1.2941, 4);

      expect(insights.bottleneck.resource?.name).toBe("MilkShake_Maker");
      expect(insights.bottleneck.resource?.utilizationType).toBe("scheduled");
      expect(insights.bottleneck.resource?.utilization).toBeCloseTo(0.8231, 4);
      expect(insights.bottleneck.queue?.name).toBe(
        "Billing Counter.Queue",
      );
      expect(
        insights.bottleneck.queue?.averageNumberWaiting,
      ).toBeCloseTo(3.055, 3);
      expect(
        insights.bottleneck.queue?.averageWaitingTime,
      ).toBeCloseTo(8.8691, 4);
      expect(insights.bottleneck.summary).toContain("MilkShake_Maker");
      expect(insights.bottleneck.summary).toContain("Billing Counter.Queue");
    },
  );

  const zeroFlowReportFileName = "arena-example-1.xlsm";
  const zeroFlowReportPath = `local-reports/${zeroFlowReportFileName}`;

  it.skipIf(!existsSync(zeroFlowReportPath))(
    "does not invent a bottleneck when utilization and throughput are zero",
    async () => {
      const { insights } = await analyzeExcelReport(
        readFileSync(zeroFlowReportPath),
        zeroFlowReportFileName,
      );

      expect(insights.resources.length).toBeGreaterThan(0);
      expect(insights.bottleneck.resource).toBeNull();
      expect(insights.bottleneck.queue).toBeNull();
      expect(
        insights.notes.some((note) =>
          note.includes(
            "All resource utilizations and system throughput are zero",
          ),
        ),
      ).toBe(true);
    },
  );
});
