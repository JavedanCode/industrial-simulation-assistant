import { randomUUID } from "expo-crypto";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  loadReports,
  saveReport,
  saveReportSync,
  renameReport as renameStoredReport,
  deleteReport as deleteStoredReport,
} from "./report_storage";
import type { SavedReport, ReportSync } from "./report_types";
import { getApiUrl } from "@/api/client";
import { analyzeReport, createConversation } from "@/api/reports";
import { uploadBody } from "./upload_body";
import type { ReportSubmissionInput } from "./report_submission";

type ReportsValue = {
  reports: SavedReport[];
  status: "loading" | "ready" | "failed";
  retryLoad: () => void;
  createReport: (input: ReportSubmissionInput) => Promise<SavedReport>;
  submitReport: (reportId: string) => Promise<void>;
  renameReport: (id: string, title: string) => Promise<void>;
  deleteReport: (id: string, clearChat: () => Promise<void>) => Promise<void>;
};
const ReportsContext = createContext<ReportsValue | null>(null);

export function ReportsProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [status, setStatus] = useState<ReportsValue["status"]>("loading");
  const [attempt, setAttempt] = useState(0);
  const savingRef = useRef(false);
  const reportsRef = useRef<SavedReport[]>([]);
  const submittingRef = useRef(new Set<string>());

  function replaceReports(update: (reports: SavedReport[]) => SavedReport[]) {
    reportsRef.current = update(reportsRef.current);
    setReports(reportsRef.current);
  }
  useEffect(() => {
    let cancelled = false;
    loadReports()
      .then((saved) => {
        if (cancelled) return;
        replaceReports(() => saved);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retryLoad() {
    if (status !== "failed") return;
    setStatus("loading");
    setAttempt((previous) => previous + 1);
  }

  async function createReport(input: ReportSubmissionInput) {
    if (status !== "ready")
      throw new Error("Report storage is not ready. Please try again.");
    if (savingRef.current) throw new Error("A report is already being saved.");
    savingRef.current = true;
    try {
      const saved = await saveReport(randomUUID(), input);
      replaceReports((previous) =>
        [saved, ...previous].sort(
          (a, b) =>
            b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
        ),
      );
      // Save first, then submit in the provider so navigation never loses the job.
      void submitReport(saved.id);
      return saved;
    } finally {
      savingRef.current = false;
    }
  }

  async function submitReport(reportId: string) {
    if (submittingRef.current.has(reportId)) return;
    const report = reportsRef.current.find((item) => item.id === reportId);
    if (!report || report.source !== "document") return;
    submittingRef.current.add(reportId);
    let sync: ReportSync = report.sync ?? {
      apiUrl: "",
      serverReportId: null,
      conversationId: null,
      analysis: null,
      error: null,
    };
    async function update(status: SavedReport["status"]) {
      await saveReportSync(reportId, sync, status);
      replaceReports((items) =>
        items.map((item) =>
          item.id === reportId ? { ...item, status, sync: { ...sync } } : item,
        ),
      );
    }
    try {
      const apiUrl = getApiUrl();
      if (sync.apiUrl && sync.apiUrl !== apiUrl)
        throw new Error(
          `This report belongs to ${sync.apiUrl}. Restore that address in Settings before retrying.`,
        );
      sync = { ...sync, apiUrl, error: null };
      await update("processing");
      if (!sync.serverReportId) {
        const result = await analyzeReport(await uploadBody(report), report.id);
        sync = {
          ...sync,
          serverReportId: result.reportId,
          analysis: result.analysis,
        };
        await update("processing");
      }
      if (!sync.conversationId) {
        sync = {
          ...sync,
          conversationId: await createConversation(
            sync.serverReportId!,
            report.id,
          ),
        };
      }
      await update("ready");
    } catch (error) {
      sync = {
        ...sync,
        error:
          error instanceof Error ? error.message : "Could not submit report.",
      };
      try {
        await update("failed");
      } catch {
        replaceReports((items) =>
          items.map((item) =>
            item.id === reportId
              ? {
                  ...item,
                  status: "failed",
                  sync: {
                    ...sync,
                    error: `${sync.error} Local storage also failed. Retry to recover the same request.`,
                  },
                }
              : item,
          ),
        );
      }
    } finally {
      submittingRef.current.delete(reportId);
    }
  }

  async function renameReport(id: string, value: string) {
    if (status !== "ready" || savingRef.current)
      throw new Error("Storage is busy. Please try again.");
    savingRef.current = true;
    try {
      const title = await renameStoredReport(id, value);
      // Change the visible list only after storage confirms the update.
      replaceReports((previous) =>
        previous.map((report) =>
          report.id === id ? { ...report, title } : report,
        ),
      );
    } finally {
      savingRef.current = false;
    }
  }

  async function deleteReport(id: string, clearChat: () => Promise<void>) {
    if (submittingRef.current.has(id))
      throw new Error(
        "Wait for report submission to finish before deleting it.",
      );
    if (status !== "ready" || savingRef.current)
      throw new Error("Storage is busy. Please try again.");
    savingRef.current = true;
    try {
      // The chat provider stops pending replies and drafts before deleting its data.
      // Remove the report last, so a partial failure leaves a visible retry target.
      await clearChat();
      await deleteStoredReport(id);
      replaceReports((previous) =>
        previous.filter((report) => report.id !== id),
      );
    } finally {
      savingRef.current = false;
    }
  }

  return (
    <ReportsContext.Provider
      value={{
        reports,
        status,
        retryLoad,
        createReport,
        submitReport,
        renameReport,
        deleteReport,
      }}
    >
      {children}
    </ReportsContext.Provider>
  );
}
export function useReports() {
  const context = useContext(ReportsContext);
  if (!context)
    throw new Error("useReports must be used inside ReportsProvider.");
  return context;
}
