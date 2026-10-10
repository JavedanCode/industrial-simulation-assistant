import { createContext, useContext, useState, type ReactNode } from "react";
import type { DocumentPickerAsset } from "expo-document-picker";

type ReportDraftContextValue = {
  title: string;
  content: string;
  setTitle: (value: string) => void;
  setContent: (value: string) => void;
  selectedDoc: DocumentPickerAsset | null;
  setSelectedDoc: (value: DocumentPickerAsset | null) => void;
  clearDraft: () => void;
};

const ReportDraftContext = createContext<ReportDraftContextValue | null>(null);

export function ReportDraftProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<DocumentPickerAsset | null>(
    null,
  );

  function clearDraft() {
    setTitle("");
    setContent("");
    setSelectedDoc(null);
  }

  return (
    <ReportDraftContext.Provider
      value={{
        title,
        content,
        setTitle,
        setContent,
        selectedDoc,
        setSelectedDoc,
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
