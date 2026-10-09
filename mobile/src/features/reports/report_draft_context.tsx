import { createContext, useContext, useState, type ReactNode } from "react";

type ReportDraftContextValue = {
  title: string;
  content: string;
  setTitle: (value: string) => void;
  setContent: (value: string) => void;
  clearDraft: () => void;
};

const ReportDraftContext = createContext<ReportDraftContextValue | null>(null);

export function ReportDraftProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  function clearDraft() {
    setTitle("");
    setContent("");
  }

  return (
    <ReportDraftContext.Provider
      value={{
        title,
        content,
        setTitle,
        setContent,
        clearDraft,
      }}
    >
      {children}
    </ReportDraftContext.Provider>
  );
}

export function useReportDraft() {
  const context = useContext(ReportDraftContext);

  if (context === null) {
    throw new Error("useReportDraft must be used inside ReportDraftProvider.");
  }

  return context;
}
