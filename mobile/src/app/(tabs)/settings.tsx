import Constants from "expo-constants";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth } from "@/constants/theme";
import {
  useSettings,
  type AppearanceChoice,
} from "@/features/settings/settings_context";
import { useReports } from "@/features/reports/reports_context";
import { useTheme } from "@/hooks/use-theme";
import { ApiConnection } from "@/features/settings/api_connection";

const choices: { value: AppearanceChoice; label: string }[] = [
  { value: "system", label: "Use device setting" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function SettingsScreen() {
  const { appearance, ready, saving, error, setAppearance } = useSettings();
  const { reports, status } = useReports();
  const theme = useTheme();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">Settings</ThemedText>
          <ApiConnection />
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Appearance</ThemedText>
            {choices.map(({ value, label }) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: appearance === value,
                  disabled: !ready || saving,
                }}
                disabled={!ready || saving}
                onPress={() => void setAppearance(value)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    borderColor:
                      appearance === value ? theme.text : theme.textSecondary,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText>{label}</ThemedText>
                <ThemedText>{appearance === value ? "✓" : ""}</ThemedText>
              </Pressable>
            ))}
            {(!ready || saving) && (
              <ActivityIndicator
                color={theme.textSecondary}
                accessibilityLabel="Saving or loading appearance"
              />
            )}
            {error !== "" && (
              <ThemedText accessibilityRole="alert">{error}</ThemedText>
            )}
          </ThemedView>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Reports and storage</ThemedText>
            <ThemedText>
              {status === "ready"
                ? `${reports.length} ${reports.length === 1 ? "report" : "reports"}`
                : status === "loading"
                  ? "Loading reports…"
                  : "Report storage unavailable"}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {Platform.OS === "web"
                ? "Local browser history resets when you refresh. Submitted reports and messages remain on the backend."
                : "Reports and chats are cached on this device. Submitted reports and messages are also stored by the backend. Local drafts and display names are not synced."}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              To rename or delete a report and its chat, open the report’s menu
              in Reports. Deletion removes this device’s copy only. Your
              original document and backend records are kept.
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate("/reports")}
              style={[styles.option, { borderColor: theme.textSecondary }]}
            >
              <ThemedText type="smallBold">Manage reports →</ThemedText>
            </Pressable>
          </ThemedView>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">About</ThemedText>
            <ThemedText>Industrial Report Assistant</ThemedText>
            <ThemedText themeColor="textSecondary">
              Version {Constants.expoConfig?.version ?? "Unknown"}
            </ThemedText>
            <ThemedText>
              Supported reports: Arena .xlsx and .xlsm, up to 10 MB
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Analysis and replies come from the configured backend. Chat may
              use a mock provider if the backend is configured for testing.
            </ThemedText>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 24,
    paddingBottom: BottomTabInset + 32,
    gap: 20,
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
  },
  card: { borderRadius: 16, padding: 20, gap: 12 },
  option: {
    minHeight: 48,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  pressed: { opacity: 0.7 },
});
