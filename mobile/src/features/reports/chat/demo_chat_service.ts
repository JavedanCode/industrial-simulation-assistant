import type { chatMsg } from "./chat_types";

// Local UI demo only. This does not analyze a report or contact a server.
export function getDemoReply(
  message: chatMsg,
  { signal, retry = false }: { signal: AbortSignal; retry?: boolean },
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("Demo request cancelled."));
      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      if (message.content.trim() === "/fail" && !retry) {
        reject(new Error("Demo reply failed."));
      } else {
        resolve(
          "Demo reply: Your message was received. Real report analysis will appear here once the backend is connected.",
        );
      }
    }, 2000);

    function cancel() {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      reject(new Error("Demo request cancelled."));
    }

    signal.addEventListener("abort", cancel, { once: true });
  });
}
