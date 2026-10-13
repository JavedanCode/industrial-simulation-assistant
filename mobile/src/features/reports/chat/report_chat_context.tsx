import { randomUUID } from "expo-crypto";
import { AppState } from "react-native";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { demoMessagesByReport as demoMsgsByReport } from "../demo-msgs";
import type { chatMsg, Conversations, ReportConversation } from "./chat_types";
import { getDemoReply } from "./demo_chat_service";
import { loadConversations, saveConversation } from "./chat_storage";

export const MAX_MSG_LENGTH = 10_000;

type StorageStatus = "loading" | "ready" | "failed";
type ReportChatValue = {
  storageStatus: StorageStatus;
  saveErrors: Partial<Record<string, boolean>>;
  retryLoad: () => void;
  retrySave: (reportId: string) => void;
  getConversation: (reportId: string) => ReportConversation;
  setDraft: (reportId: string, text: string) => void;
  sendMsg: (reportId: string) => boolean;
  retryMsg: (reportId: string) => void;
};

const ReportChatContext = createContext<ReportChatValue | null>(null);

function initialConversation(reportId: string): ReportConversation {
  return {
    msgs: [...(demoMsgsByReport[reportId] ?? [])],
    draft: "",
    errorMsg: "",
    replyStatus: "idle",
    failedMsg: null,
    pendingMsgId: null,
  };
}

export function ReportChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversations>({});
  // Event handlers use the latest state even before React renders again.
  const conversationsRef = useRef<Conversations>({});
  const requestsRef = useRef(new Map<string, AbortController>());
  const [storageStatus, setStorageStatus] = useState<StorageStatus>("loading");
  const readyRef = useRef(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveErrors, setSaveErrors] = useState<
    Partial<Record<string, boolean>>
  >({});
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const activeRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    loadConversations()
      .then((saved) => {
        if (cancelled) return;
        conversationsRef.current = saved;
        setConversations(saved);
        readyRef.current = true;
        setStorageStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStorageStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  function retryLoad() {
    if (readyRef.current || storageStatus === "loading") return;
    setStorageStatus("loading");
    setLoadAttempt((previous) => previous + 1);
  }

  function persist(reportId: string, snapshot: ReportConversation) {
    return saveConversation(reportId, snapshot)
      .then(() => {
        if (
          activeRef.current &&
          conversationsRef.current[reportId] === snapshot
        ) {
          setSaveErrors((previous) => ({ ...previous, [reportId]: false }));
        }
      })
      .catch(() => {
        if (activeRef.current)
          setSaveErrors((previous) => ({ ...previous, [reportId]: true }));
      });
  }

  function retrySave(reportId: string) {
    const snapshot = conversationsRef.current[reportId];
    if (!readyRef.current || !snapshot) return;
    clearTimeout(timersRef.current.get(reportId));
    timersRef.current.delete(reportId);
    void persist(reportId, snapshot);
  }

  useEffect(() => {
    activeRef.current = true;
    const requests = requestsRef.current;
    const timers = timersRef.current;
    const flushDrafts = () => {
      timers.forEach((timer, reportId) => {
        clearTimeout(timer);
        const snapshot = conversationsRef.current[reportId];
        if (snapshot) {
          void saveConversation(reportId, snapshot)
            .then(() => {
              if (
                activeRef.current &&
                conversationsRef.current[reportId] === snapshot
              ) {
                setSaveErrors((previous) => ({
                  ...previous,
                  [reportId]: false,
                }));
              }
            })
            .catch(() => {
              if (activeRef.current)
                setSaveErrors((previous) => ({
                  ...previous,
                  [reportId]: true,
                }));
            });
        }
      });
      timers.clear();
    };
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") flushDrafts();
    });
    return () => {
      activeRef.current = false;
      subscription.remove();
      flushDrafts();
      requests.forEach((controller) => controller.abort());
      requests.clear();
    };
  }, []);

  function updateConversation(
    reportId: string,
    update: Partial<ReportConversation>,
    debounce = false,
  ) {
    if (!readyRef.current) return;
    const current =
      conversationsRef.current[reportId] ?? initialConversation(reportId);
    const snapshot = { ...current, ...update };
    const next = {
      ...conversationsRef.current,
      [reportId]: snapshot,
    };
    conversationsRef.current = next;
    setConversations(next);
    clearTimeout(timersRef.current.get(reportId));
    timersRef.current.delete(reportId);
    if (debounce) {
      timersRef.current.set(
        reportId,
        setTimeout(() => {
          timersRef.current.delete(reportId);
          void persist(reportId, snapshot);
        }, 400),
      );
    } else {
      void persist(reportId, snapshot);
    }
  }

  function setDraft(reportId: string, text: string) {
    updateConversation(reportId, { draft: text, errorMsg: "" }, true);
  }

  async function requestReply(reportId: string, msg: chatMsg, retry = false) {
    if (requestsRef.current.has(reportId)) return;
    const controller = new AbortController();
    requestsRef.current.set(reportId, controller);
    updateConversation(reportId, {
      replyStatus: "loading",
      failedMsg: null,
      pendingMsgId: msg.id,
    });

    try {
      const content = await getDemoReply(msg, {
        signal: controller.signal,
        retry,
      });
      if (controller.signal.aborted) return;
      const reply: chatMsg = {
        id: randomUUID(),
        role: "assistant",
        content,
        createdAt: new Date().toISOString(),
      };
      const current = conversationsRef.current[reportId]!;
      updateConversation(reportId, {
        msgs: [...current.msgs, reply],
        replyStatus: "idle",
        pendingMsgId: null,
      });
    } catch {
      if (controller.signal.aborted) return;
      updateConversation(reportId, {
        failedMsg: msg,
        replyStatus: "failed",
        pendingMsgId: null,
      });
    } finally {
      if (requestsRef.current.get(reportId) === controller)
        requestsRef.current.delete(reportId);
    }
  }

  function sendMsg(reportId: string) {
    if (!readyRef.current) return false;
    const current =
      conversationsRef.current[reportId] ?? initialConversation(reportId);
    if (requestsRef.current.has(reportId) || current.replyStatus !== "idle")
      return false;
    const content = current.draft.trim();
    if (!content || current.draft.length > MAX_MSG_LENGTH) {
      updateConversation(reportId, {
        errorMsg: !content
          ? "Enter a message first."
          : "Your message cannot exceed 10,000 characters.",
      });
      return false;
    }
    try {
      const msg: chatMsg = {
        id: randomUUID(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      updateConversation(reportId, {
        msgs: [...current.msgs, msg],
        draft: "",
        errorMsg: "",
        replyStatus: "loading",
        pendingMsgId: msg.id,
      });
      void requestReply(reportId, msg);
      return true;
    } catch {
      updateConversation(reportId, {
        errorMsg: "Could not add your message. Please try again.",
      });
      return false;
    }
  }

  function retryMsg(reportId: string) {
    if (!readyRef.current) return;
    const current = conversationsRef.current[reportId];
    if (current?.replyStatus === "failed" && current.failedMsg) {
      void requestReply(reportId, current.failedMsg, true);
    }
  }

  function getConversation(reportId: string) {
    return conversations[reportId] ?? initialConversation(reportId);
  }

  return (
    <ReportChatContext.Provider
      value={{
        getConversation,
        setDraft,
        sendMsg,
        retryMsg,
        storageStatus,
        saveErrors,
        retryLoad,
        retrySave,
      }}
    >
      {children}
    </ReportChatContext.Provider>
  );
}

export function useReportChat() {
  const context = useContext(ReportChatContext);
  if (!context)
    throw new Error("useReportChat must be used inside ReportChatProvider.");
  return context;
}
