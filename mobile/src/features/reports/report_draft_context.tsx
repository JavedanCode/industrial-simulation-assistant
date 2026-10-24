import { createContext, useContext, useState, type ReactNode } from "react";
import type { DocumentPickerAsset } from "expo-document-picker";

type ReportDraftContextValue = {
  selectedDoc: DocumentPickerAsset | null;
  setSelectedDoc: (value: DocumentPickerAsset | null) => void;
  clearDraft: () => void;
};

const ReportDraftContext = createContext<ReportDraftContextValue | null>(null);

export function ReportDraftProvider({ children }: { children: ReactNode }) {
  const [selectedDoc, setSelectedDoc] = useState<DocumentPickerAsset | null>(
    null,
  );

  function clearDraft() {
    setSelectedDoc(null);
  }

  return (
    <ReportDraftContext.Provider
      value={{
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
