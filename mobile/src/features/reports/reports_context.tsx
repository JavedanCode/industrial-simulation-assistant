import { randomUUID } from "expo-crypto";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { loadReports, saveReport } from "./report_storage";
import type { SavedReport } from "./report_types";
import type { ReportSubmissionInput } from "./report_submission";

type ReportsValue = {
  reports: SavedReport[];
  status: "loading" | "ready" | "failed";
  retryLoad: () => void;
  createReport: (input: ReportSubmissionInput) => Promise<SavedReport>;
};
const ReportsContext = createContext<ReportsValue | null>(null);

export function ReportsProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [status, setStatus] = useState<ReportsValue["status"]>("loading");
  const [attempt, setAttempt] = useState(0);
  const savingRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    loadReports()
      .then((saved) => {
        if (cancelled) return;
        setReports(saved);
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
      setReports((previous) =>
        [saved, ...previous].sort(
          (a, b) =>
            b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
        ),
      );
      return saved;
    } finally {
      savingRef.current = false;
    }
  }

  return (
    <ReportsContext.Provider
      value={{ reports, status, retryLoad, createReport }}
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
