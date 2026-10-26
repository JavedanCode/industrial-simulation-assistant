import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
} from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { checkHealth } from "@/api/client";
import { useTheme } from "@/hooks/use-theme";
import { useSettings } from "./settings_context";

export function ApiConnection() {
  const theme = useTheme();
  const {
    apiUrl,
    apiUrlBuiltIn,
    apiUrlIsSaved,
    apiUrlBusy,
    apiUrlError,
    saveApiUrl,
    resetApiUrl,
  } = useSettings();
  const [draft, setDraft] = useState(apiUrl);
  const [result, setResult] = useState("");
  const [testing, setTesting] = useState(false);
  const busyRef = useRef(false);

  async function saveAndTest() {
    if (busyRef.current) return;
    busyRef.current = true;
    setTesting(true);
    setResult("");
    try {
      const saved = await saveApiUrl(draft);
      if (!saved) return;
      setDraft(saved);
      // The save can succeed while the server is down, so report them apart.
      try {
        await checkHealth();
        setResult("Saved. The backend is reachable.");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "it did not answer.";
        setResult(
          `Saved, but ${message.charAt(0).toLowerCase()}${message.slice(1)}`,
        );
      }
    } finally {
      busyRef.current = false;
      setTesting(false);
    }
  }

  async function restoreBuiltIn() {
    if (busyRef.current) return;
    busyRef.current = true;
    setTesting(true);
    setResult("");
    try {
      setDraft(await resetApiUrl());
    } finally {
      busyRef.current = false;
      setTesting(false);
    }
  }

  const busy = testing || apiUrlBusy;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Backend connection</ThemedText>

      <ThemedText themeColor="textSecondary" type="small">
        {apiUrlIsSaved
          ? "Using the address saved on this device."
          : apiUrlBuiltIn
            ? "Using the address built into this app."
            : "This build has no address. Enter your computer’s LAN address."}
      </ThemedText>

      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="http://192.168.1.16:3000/api"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        inputMode="url"
        keyboardType="url"
        editable={!busy}
        accessibilityLabel="Backend address"
        style={[
          styles.input,
          {
            color: theme.text,
            borderColor: theme.textSecondary,
            backgroundColor: theme.background,
          },
        ]}
      />

      <ThemedText themeColor="textSecondary" type="small">
        On a phone, use this computer’s LAN IPv4 address, not localhost. A bare
        address such as 192.168.1.16:3000 is completed to /api automatically.
      </ThemedText>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => void saveAndTest()}
        style={({ pressed }) => [
          styles.action,
          { borderColor: theme.text },
          pressed && styles.pressed,
        ]}
      >
        <ThemedText type="smallBold">
          {testing ? "Saving and checking…" : "Save and test"}
        </ThemedText>
      </Pressable>

      {apiUrlIsSaved && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => void restoreBuiltIn()}
          style={({ pressed }) => [
            styles.action,
            { borderColor: theme.textSecondary },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText type="small">Use the built-in address</ThemedText>
        </Pressable>
      )}

      {busy && (
        <ActivityIndicator
          color={theme.textSecondary}
          accessibilityLabel="Saving or checking the backend connection"
        />
      )}

      {apiUrlError !== "" && (
        <ThemedText accessibilityRole="alert">{apiUrlError}</ThemedText>
      )}
      {result !== "" && (
        <ThemedText accessibilityLiveRegion="polite">{result}</ThemedText>
      )}

      <ThemedText themeColor="textSecondary" type="small">
        Reports already submitted stay tied to the backend that analysed them.
        Changing this address makes them read-only until you restore it.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 20, gap: 12 },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  action: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  pressed: { opacity: 0.7 },
});
