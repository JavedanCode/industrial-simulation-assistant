import { randomUUID } from "expo-crypto";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { demoMessagesByReport as demoMsgsByReport } from "../demo-msgs";
import type { chatMsg } from "./chat_types";
import { getDemoReply } from "./demo_chat_service";

export const MAX_MSG_LENGTH = 10_000;

type ReportConversation = {
  msgs: chatMsg[];
  draft: string;
  errorMsg: string;
  replyStatus: "idle" | "loading" | "failed";
  failedMsg: chatMsg | null;
};
type Conversations = Partial<Record<string, ReportConversation>>;
type ReportChatValue = {
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
  };
}

export function ReportChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversations>({});
  // Event handlers use the latest state even before React renders again.
  const conversationsRef = useRef<Conversations>({});
  const requestsRef = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const requests = requestsRef.current;
    return () => {
      requests.forEach((controller) => controller.abort());
      requests.clear();
    };
  }, []);

  function updateConversation(
    reportId: string,
    update: Partial<ReportConversation>,
  ) {
    const current =
      conversationsRef.current[reportId] ?? initialConversation(reportId);
    const next = {
      ...conversationsRef.current,
      [reportId]: { ...current, ...update },
    };
    conversationsRef.current = next;
    setConversations(next);
  }

  function setDraft(reportId: string, text: string) {
    updateConversation(reportId, { draft: text, errorMsg: "" });
  }

  async function requestReply(reportId: string, msg: chatMsg, retry = false) {
    if (requestsRef.current.has(reportId)) return;
    const controller = new AbortController();
    requestsRef.current.set(reportId, controller);
    updateConversation(reportId, { replyStatus: "loading", failedMsg: null });

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
      });
    } catch {
      if (controller.signal.aborted) return;
      updateConversation(reportId, { failedMsg: msg, replyStatus: "failed" });
    } finally {
      if (requestsRef.current.get(reportId) === controller)
        requestsRef.current.delete(reportId);
    }
  }

  function sendMsg(reportId: string) {
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
      value={{ getConversation, setDraft, sendMsg, retryMsg }}
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
