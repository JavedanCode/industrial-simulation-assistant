export type chatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};
