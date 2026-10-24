export type chatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ReportConversation = {
  archivedMsgs?: chatMsg[];
  msgs: chatMsg[];
  draft: string;
  errorMsg: string;
  replyStatus: "idle" | "loading" | "failed";
  failedMsg: chatMsg | null;
  pendingMsgId: string | null;
};

export type Conversations = Partial<Record<string, ReportConversation>>;
