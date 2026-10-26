import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { normalizeApiUrl } from "@/api/api_url";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { loadAppearance, saveAppearance } from "./settings_storage";
import {
  clearSavedApiUrl,
  persistApiUrl,
  restoreSavedApiUrl,
} from "./api_url_storage";

export type AppearanceChoice = "system" | "light" | "dark";

// Restored while modules load, before the first render, so no screen or request
// can read a stale address. Addresses baked in at build time cannot change
// afterwards, which is why a phone install needs the editable override.
const savedApiUrl = restoreSavedApiUrl();
const builtInApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";

type SettingsContextValue = {
  appearance: AppearanceChoice;
  colorScheme: "light" | "dark";
  ready: boolean;
  saving: boolean;
  error: string;
  setAppearance: (value: AppearanceChoice) => Promise<void>;

  /** Address in effect, or "" when none is configured. */
  apiUrl: string;
  /** Built-in (build-time) address, or "" when the build has none. */
  apiUrlBuiltIn: string;
  apiUrlIsSaved: boolean;
  apiUrlBusy: boolean;
  apiUrlError: string;
  /** Saves and applies an address. Returns the normalized value, or null. */
  saveApiUrl: (address: string) => Promise<string | null>;
  /** Drops the saved address and falls back to the built-in one. */
  resetApiUrl: () => Promise<string>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function normalizeOrNull(address: string): string | null {
  try {
    return address ? normalizeApiUrl(address) : null;
  } catch {
    return null;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [appearance, setChoice] = useState<AppearanceChoice>("system");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  const [apiUrl, setApiUrl] = useState(savedApiUrl ?? builtInApiUrl);
  const [apiUrlIsSaved, setApiUrlIsSaved] = useState(savedApiUrl !== null);
  const [apiUrlBusy, setApiUrlBusy] = useState(false);
  const [apiUrlError, setApiUrlError] = useState("");
  const apiUrlBusyRef = useRef(false);

  useEffect(() => {
    let active = true;
    loadAppearance()
      .then((value) => {
        if (
          active &&
          (value === "light" || value === "dark" || value === "system")
        )
          setChoice(value);
      })
      .catch(() => {
        if (active)
          setError(
            "Couldn’t load appearance. Choose an option to try saving again.",
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function setAppearance(value: AppearanceChoice) {
    if (!ready || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      // Update the whole app only after the preference has been saved successfully.
      await saveAppearance(value);
      setChoice(value);
    } catch {
      setError("Couldn’t save appearance. Please try selecting it again.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function saveApiUrl(address: string): Promise<string | null> {
    if (apiUrlBusyRef.current) return null;
    apiUrlBusyRef.current = true;
    setApiUrlBusy(true);
    setApiUrlError("");
    try {
      const value = normalizeApiUrl(address);
      // Choosing the built-in address again should not create a redundant
      // override that later survives an app upgrade with a different default.
      if (value === normalizeOrNull(builtInApiUrl)) {
        await clearSavedApiUrl();
        setApiUrl(builtInApiUrl);
        setApiUrlIsSaved(false);
      } else {
        await persistApiUrl(value);
        setApiUrl(value);
        setApiUrlIsSaved(true);
      }
      return value;
    } catch (saveError) {
      setApiUrlError(
        saveError instanceof Error
          ? saveError.message
          : "Couldn’t save the backend address.",
      );
      return null;
    } finally {
      apiUrlBusyRef.current = false;
      setApiUrlBusy(false);
    }
  }

  async function resetApiUrl(): Promise<string> {
    if (apiUrlBusyRef.current) return apiUrl;
    apiUrlBusyRef.current = true;
    setApiUrlBusy(true);
    setApiUrlError("");
    try {
      await clearSavedApiUrl();
      setApiUrl(builtInApiUrl);
      setApiUrlIsSaved(false);
      return builtInApiUrl;
    } catch {
      setApiUrlError("Couldn’t clear the saved backend address.");
      return apiUrl;
    } finally {
      apiUrlBusyRef.current = false;
      setApiUrlBusy(false);
    }
  }

  const colorScheme =
    appearance === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : appearance;

  return (
    <SettingsContext.Provider
      value={{
        appearance,
        colorScheme,
        ready,
        saving,
        error,
        setAppearance,
        apiUrl,
        apiUrlBuiltIn: builtInApiUrl,
        apiUrlIsSaved,
        apiUrlBusy,
        apiUrlError,
        saveApiUrl,
        resetApiUrl,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings requires SettingsProvider");
  return value;
}
