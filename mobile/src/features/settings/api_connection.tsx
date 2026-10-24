import { useRef, useState } from "react";
import { Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { checkHealth } from "@/api/client";

export function ApiConnection() {
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  async function check() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setResult("");
    try {
      await checkHealth();
      setResult("Backend is reachable.");
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Couldn’t connect.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <ThemedView
      type="backgroundElement"
      style={{ borderRadius: 16, padding: 20, gap: 12 }}
    >
      <ThemedText type="smallBold">Backend connection</ThemedText>
      <ThemedText selectable type="small">
        {process.env.EXPO_PUBLIC_API_URL ?? "No API address configured"}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void check()}
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <ThemedText>{busy ? "Checking…" : "Test connection"}</ThemedText>
      </Pressable>
      {!!result && (
        <ThemedText accessibilityLiveRegion="polite">{result}</ThemedText>
      )}
    </ThemedView>
  );
}
