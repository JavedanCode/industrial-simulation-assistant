export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code?: string,
  ) {
    super(message);
  }
}

export function getApiUrl(): string {
  const value = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (!value)
    throw new ApiError(
      "Set EXPO_PUBLIC_API_URL in mobile/.env.local, then reload the app.",
    );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError("EXPO_PUBLIC_API_URL is not a valid URL.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new ApiError(
      "The API URL must be an HTTP(S) address without credentials, query, or fragment.",
    );
  return value;
}

type Options = {
  method?: string;
  body?: BodyInit;
  signal?: AbortSignal;
  requestId?: string;
  json?: boolean;
  timeoutMs?: number;
};

// No automatic POST retries: callers reuse a persisted request ID explicitly.
export async function apiRequest(
  path: string,
  options: Options = {},
): Promise<unknown> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 330_000);
  try {
    const response = await fetch(`${getApiUrl()}${path}`, {
      method: options.method ?? "GET",
      body: options.body,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.json ? { "Content-Type": "application/json" } : {}),
        ...(options.requestId ? { "Idempotency-Key": options.requestId } : {}),
      },
    });
    if (response.status === 204) return null;
    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      if (timedOut || options.signal?.aborted) throw error;
      throw new ApiError(
        "The server returned an unreadable response.",
        response.status,
      );
    }
    if (!response.ok) {
      const error = data as { error?: unknown; code?: unknown };
      throw new ApiError(
        typeof error?.error === "string"
          ? error.error
          : `Request failed (${response.status}).`,
        response.status,
        typeof error?.code === "string" ? error.code : undefined,
      );
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (options.signal?.aborted)
      throw new ApiError("Request cancelled.", 0, "CANCELLED");
    throw new ApiError(
      timedOut
        ? "The server took too long. Retry to check or resume the same request."
        : "Couldn’t reach the backend. Check its address, Wi-Fi connection, and whether the server is running.",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}

export async function checkHealth() {
  const data = await apiRequest("/health", { timeoutMs: 10_000 });
  if (
    !data ||
    typeof data !== "object" ||
    !("status" in data) ||
    data.status !== "ok"
  )
    throw new ApiError("Unexpected health response.");
}
