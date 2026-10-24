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
import { reconcileHistory } from "./reconcile_history";
import type { chatMsg, Conversations, ReportConversation } from "./chat_types";
import { loadHistory, sendApiMsg } from "@/api/reports";
import { getApiUrl } from "@/api/client";
import { useReports } from "../reports_context";
import {
  loadConversations,
  saveConversation,
  deleteConversation as deleteStoredConversation,
} from "./chat_storage";

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
  deleteConversation: (reportId: string) => Promise<void>;
  refreshChat: (reportId: string) => Promise<void>;
  refreshing: Partial<Record<string, boolean>>;
};

const ReportChatContext = createContext<ReportChatValue | null>(null);

function initialConversation(_reportId: string): ReportConversation {
  return {
    msgs: [],
    draft: "",
    errorMsg: "",
    replyStatus: "idle",
    failedMsg: null,
    pendingMsgId: null,
  };
}

export function ReportChatProvider({ children }: { children: ReactNode }) {
  const { reports } = useReports();
  const [refreshing, setRefreshing] = useState<
    Partial<Record<string, boolean>>
  >({});
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
  const deletingRef = useRef(new Set<string>());

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
    if (deletingRef.current.has(reportId)) return Promise.resolve();
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
        if (
          activeRef.current &&
          conversationsRef.current[reportId] === snapshot
        )
          setSaveErrors((previous) => ({ ...previous, [reportId]: true }));
      });
  }

  function retrySave(reportId: string) {
    const snapshot = conversationsRef.current[reportId];
    if (!readyRef.current || !snapshot || deletingRef.current.has(reportId))
      return;
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
    if (!readyRef.current || deletingRef.current.has(reportId)) return;
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

  function serverConversationId(reportId: string) {
    const report = reports.find((item) => item.id === reportId);
    if (!report?.sync?.conversationId)
      throw new Error(
        "Submit this report for analysis before starting its chat.",
      );
    if (report.sync.apiUrl !== getApiUrl())
      throw new Error(
        "This report belongs to a different API address. Restore the original address in mobile/.env.local.",
      );
    return report.sync.conversationId;
  }

  async function refreshChat(reportId: string) {
    if (
      !readyRef.current ||
      requestsRef.current.has(reportId) ||
      deletingRef.current.has(reportId)
    )
      return;
    const controller = new AbortController();
    requestsRef.current.set(reportId, controller);
    setRefreshing((previous) => ({ ...previous, [reportId]: true }));
    try {
      const msgs = await loadHistory(
        serverConversationId(reportId),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const current =
        conversationsRef.current[reportId] ?? initialConversation(reportId);
      updateConversation(reportId, reconcileHistory(current, msgs));
    } catch (error) {
      if (!controller.signal.aborted)
        updateConversation(reportId, {
          errorMsg:
            error instanceof Error
              ? error.message
              : "Couldn’t refresh conversation. Saved messages are still available.",
        });
    } finally {
      if (requestsRef.current.get(reportId) === controller)
        requestsRef.current.delete(reportId);
      if (activeRef.current)
        setRefreshing((previous) => ({ ...previous, [reportId]: false }));
    }
  }

  async function requestReply(reportId: string, msg: chatMsg) {
    if (requestsRef.current.has(reportId) || deletingRef.current.has(reportId))
      return;
    const controller = new AbortController();
    requestsRef.current.set(reportId, controller);
    updateConversation(reportId, {
      replyStatus: "loading",
      failedMsg: null,
      pendingMsgId: msg.id,
    });

    try {
      // Persist the client ID before sending, so restart/retry reuses the same request.
      await saveConversation(reportId, conversationsRef.current[reportId]!);
      const result = await sendApiMsg(
        serverConversationId(reportId),
        msg,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const current = conversationsRef.current[reportId]!;
      updateConversation(reportId, {
        msgs: [
          ...current.msgs
            .filter((item) => item.id !== result.assistant.id)
            .map((item) => (item.id === msg.id ? result.user : item)),
          result.assistant,
        ],
        replyStatus: "idle",
        pendingMsgId: null,
        errorMsg: "",
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      updateConversation(reportId, {
        failedMsg: msg,
        replyStatus: "failed",
        pendingMsgId: null,
        errorMsg:
          error instanceof Error
            ? error.message
            : "Couldn’t get a reply. Retry to continue.",
      });
    } finally {
      if (requestsRef.current.get(reportId) === controller)
        requestsRef.current.delete(reportId);
    }
  }

  function sendMsg(reportId: string) {
    if (!readyRef.current || deletingRef.current.has(reportId)) return false;
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
      void requestReply(reportId, current.failedMsg);
    }
  }

  function getConversation(reportId: string) {
    return conversations[reportId] ?? initialConversation(reportId);
  }

  async function deleteConversation(reportId: string) {
    if (!readyRef.current)
      throw new Error(
        "Chat storage is not ready. Please retry after it loads.",
      );
    if (deletingRef.current.has(reportId))
      throw new Error("This chat is already being deleted.");
    deletingRef.current.add(reportId);
    // Cancel producers first: neither a delayed draft save nor a late AI reply
    // should recreate a chat after the user deletes it.
    requestsRef.current.get(reportId)?.abort();
    requestsRef.current.delete(reportId);
    clearTimeout(timersRef.current.get(reportId));
    timersRef.current.delete(reportId);
    try {
      await deleteStoredConversation(reportId);
      const next = { ...conversationsRef.current };
      delete next[reportId];
      conversationsRef.current = next;
      setConversations(next);
      setSaveErrors((previous) => {
        const nextErrors = { ...previous };
        delete nextErrors[reportId];
        return nextErrors;
      });
    } catch (error) {
      // If storage fails, preserve the chat and turn the cancelled request into
      // a retryable failure instead of leaving an endless loading indicator.
      deletingRef.current.delete(reportId);
      const current = conversationsRef.current[reportId];
      if (current) {
        const pending = current.msgs.find(
          (msg) => msg.id === current.pendingMsgId,
        );
        updateConversation(
          reportId,
          pending
            ? {
                replyStatus: "failed",
                failedMsg: pending,
                pendingMsgId: null,
              }
            : {},
        );
      }
      throw error;
    } finally {
      deletingRef.current.delete(reportId);
    }
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
        deleteConversation,
        refreshChat,
        refreshing,
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
