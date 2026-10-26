import { normalizeApiUrl, setApiUrlOverride } from "@/api/api_url";

const KEY = "industrial-assistant-api-url-v1";

// Browser preferences can persist without enabling the native SQLite bridge.
// Private modes and server-side prerendering may not provide localStorage.
function localStore() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function restoreSavedApiUrl(): string | null {
  const store = localStore();
  if (!store) return null;

  let stored: string | null;
  try {
    stored = store.getItem(KEY);
  } catch {
    return null;
  }
  if (!stored) return null;

  try {
    const value = normalizeApiUrl(stored);
    setApiUrlOverride(value);
    return value;
  } catch {
    try {
      store.removeItem(KEY);
    } catch {
      // The baked address still works, so nothing else to recover.
    }
    return null;
  }
}

export async function persistApiUrl(address: string): Promise<string> {
  const value = normalizeApiUrl(address);
  const store = localStore();
  if (!store)
    throw new Error(
      "This browser blocked local storage, so the address can’t be saved.",
    );
  store.setItem(KEY, value);
  setApiUrlOverride(value);
  return value;
}

export async function clearSavedApiUrl(): Promise<void> {
  const store = localStore();
  try {
    store?.removeItem(KEY);
  } catch {
    // Clearing a preference that is already gone is not a failure.
  }
  setApiUrlOverride(null);
}
