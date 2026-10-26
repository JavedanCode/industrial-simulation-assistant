import { ApiError } from "./errors";

// Addresses are baked into the bundle from EXPO_PUBLIC_API_URL at build time.
// A phone install would therefore be welded to one laptop address, so the app
// also stores an address chosen in Settings. That override wins when present.
let savedOverride: string | null = null;

const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Normalizes what people actually have available: a full URL, or the bare
 * `192.168.1.16:3000` they copy from `ipconfig`. Returns a base URL without a
 * trailing slash, under `/api` when no path was given.
 */
export function normalizeApiUrl(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/\/+$/, "");
  if (!trimmed)
    throw new ApiError(
      "Set the backend address in Settings, for example http://192.168.1.16:3000/api.",
    );

  let url: URL;
  try {
    url = new URL(SCHEME.test(trimmed) ? trimmed : `http://${trimmed}`);
  } catch {
    throw new ApiError(
      "That is not a valid web address. Include the port, for example http://192.168.1.16:3000/api.",
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new ApiError("The backend address must start with http:// or https://.");
  if (url.username || url.password)
    throw new ApiError(
      "Remove the username and password from the backend address.",
    );
  if (url.search || url.hash)
    throw new ApiError(
      "Remove the query string and fragment from the backend address.",
    );

  // The API is mounted at /api. A bare host is the common case when the address
  // was copied from ipconfig, so complete it instead of failing later with 404.
  if (url.pathname.replace(/\/+$/, "") === "") url.pathname = "/api";

  return url.toString().replace(/\/+$/, "");
}

/** Called once at startup with the address saved on this device, if any. */
export function setApiUrlOverride(value: string | null): void {
  savedOverride = value;
}

/** The address in effect, exactly as configured. Never throws; for display. */
export function getApiUrlPreview(): string {
  return savedOverride ?? (ENV_API_URL?.trim() ?? "");
}

export function hasApiUrlOverride(): boolean {
  return savedOverride !== null;
}

/** The address the app will call. Throws ApiError when it is missing or bad. */
export function getApiUrl(): string {
  return normalizeApiUrl(getApiUrlPreview());
}
