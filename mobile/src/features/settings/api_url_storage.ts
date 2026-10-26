import Storage from "expo-sqlite/kv-store";
import { normalizeApiUrl, setApiUrlOverride } from "@/api/api_url";

const KEY = "api-url-v1";

/**
 * Restores the address saved on this device. Called at module load, before the
 * first screen renders, so the very first API call already uses it.
 *
 * A value written by an older build (or a corrupted row) must never brick
 * startup: it is dropped and the address baked into the app is used instead.
 */
export function restoreSavedApiUrl(): string | null {
  let stored: string | null;
  try {
    stored = Storage.getItemSync(KEY);
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
      Storage.removeItemSync(KEY);
    } catch {
      // The baked address still works, so nothing else to recover.
    }
    return null;
  }
}

export async function persistApiUrl(address: string): Promise<string> {
  const value = normalizeApiUrl(address);
  await Storage.setItemAsync(KEY, value);
  setApiUrlOverride(value);
  return value;
}

export async function clearSavedApiUrl(): Promise<void> {
  await Storage.removeItemAsync(KEY);
  setApiUrlOverride(null);
}
