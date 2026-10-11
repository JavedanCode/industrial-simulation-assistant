import type { chatMsg } from "./chat/chat_types";

export const demoMessagesByReport: Partial<Record<string, chatMsg[]>> = {
  "demo-report-1": [
    {
      id: "a0c93c08-5df2-4bfd-91ee-13df106a53a1",
      role: "assistant",
      content:
        "Example analysis: Station B has the highest utilization and the longest queue in this fictional report. It may be limiting production. Check its processing times and available capacity before making changes.",
      createdAt: "2026-10-11T09:01:00+03:00",
    },
    {
      id: "fb467620-3589-4699-bdde-080ad37b48f8",
      role: "user",
      content: "Does that mean we should add another worker?",
      createdAt: "2026-10-11T09:02:00+03:00",
    },
    {
      id: "5bbfabda-4033-45bb-bfd3-957da0ddf632",
      role: "assistant",
      content:
        "Not necessarily. First check whether Station B is limited by staffing, equipment, or processing time. A what-if simulation could compare adding a worker with reducing the processing time.",
      createdAt: "2026-10-11T09:02:10+03:00",
    },
  ],
};
