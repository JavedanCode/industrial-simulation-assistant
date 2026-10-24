import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { loadAppearance, saveAppearance } from "./settings_storage";

export type AppearanceChoice = "system" | "light" | "dark";
const SettingsContext = createContext<{
  appearance: AppearanceChoice;
  colorScheme: "light" | "dark";
  ready: boolean;
  saving: boolean;
  error: string;
  setAppearance: (value: AppearanceChoice) => Promise<void>;
} | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [appearance, setChoice] = useState<AppearanceChoice>("system");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

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

  const colorScheme =
    appearance === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : appearance;
  return (
    <SettingsContext.Provider
      value={{ appearance, colorScheme, ready, saving, error, setAppearance }}
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
