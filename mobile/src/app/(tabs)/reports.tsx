import {
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useState } from "react";
import { ReportActions } from "@/features/reports/report_actions";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth } from "@/constants/theme";
import { useReports } from "@/features/reports/reports_context";
import { reportStatusLabels } from "@/features/reports/report_types";
import { useTheme } from "@/hooks/use-theme";

//Format date using the device's Locale, with a short month name
function formatReportDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ReportsScreen() {
  const { reports, status, retryLoad } = useReports();
  const theme = useTheme();
  const [search, setSearch] = useState("");
  // Derive results from saved reports so renaming/deleting updates the search
  // immediately. Trimming and lowercasing allow forgiving partial-name matches.
  const query = search.trim().toLowerCase();
  const filteredReports = reports.filter((report) =>
    report.title.toLowerCase().includes(query),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedReport = reports.find((report) => report.id === selectedId);
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <FlatList
          style={styles.container}
          contentContainerStyle={styles.content}
          data={filteredReports}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <ThemedView style={styles.header}>
              <ThemedText type="subtitle">Reports</ThemedText>

              <ThemedText themeColor="textSecondary">
                {Platform.OS === "web"
                  ? "Browser demo: reports reset on refresh."
                  : "Reports saved on this device."}
              </ThemedText>
              <ThemedView style={styles.searchRow}>
                <TextInput
                  accessibilityLabel="Search reports by name"
                  placeholder="Search reports by name…"
                  placeholderTextColor={theme.textSecondary}
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  style={[
                    styles.searchInput,
                    {
                      color: theme.text,
                      borderColor: theme.textSecondary,
                    },
                  ]}
                />
                {search.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    onPress={() => setSearch("")}
                    style={styles.clearSearch}
                  >
                    <ThemedText>Clear</ThemedText>
                  </Pressable>
                )}
              </ThemedView>
              {query !== "" && status === "ready" && (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  accessibilityLiveRegion="polite"
                >
                  {filteredReports.length}{" "}
                  {filteredReports.length === 1 ? "report" : "reports"} found
                </ThemedText>
              )}
            </ThemedView>
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.cardRow}>
              {/* Sibling buttons prevent tapping the menu from opening the chat. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.title}`}
                onPress={() =>
                  router.push({
                    pathname: "/report/[id]",
                    params: { id: item.id },
                  })
                }
                style={({ pressed }) => [
                  styles.openReport,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedView type="backgroundElement" style={styles.reportCard}>
                  <ThemedText type="smallBold">{item.title}</ThemedText>

                  <ThemedText type="small" themeColor="textSecondary">
                    {formatReportDate(item.createdAt)}
                  </ThemedText>

                  <ThemedText type="small" themeColor="textSecondary">
                    {item.source === "document" ? "Document" : "Pasted text"}
                  </ThemedText>

                  <ThemedText type="smallBold">
                    {reportStatusLabels[item.status]}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Options for ${item.title}`}
                onPress={() => setSelectedId(item.id)}
                style={styles.menuButton}
              >
                <ThemedText style={styles.menuIcon}>⋮</ThemedText>
              </Pressable>
            </ThemedView>
          )}
          ListEmptyComponent={
            <ThemedView style={styles.emptyState}>
              {status === "loading" && <ActivityIndicator />}
              <ThemedText>
                {status === "loading"
                  ? "Loading reports…"
                  : status === "failed"
                    ? "Couldn’t load saved reports."
                    : reports.length > 0
                      ? "No matching reports."
                      : "No reports yet."}
              </ThemedText>
              {status === "failed" && (
                <Pressable
                  accessibilityRole="button"
                  onPress={retryLoad}
                  style={styles.reportCard}
                >
                  <ThemedText>Retry</ThemedText>
                </Pressable>
              )}

              <ThemedText themeColor="textSecondary">
                {status === "ready"
                  ? reports.length > 0
                    ? "Try a different name or clear your search."
                    : "Save a report from Home to see it here."
                  : ""}
              </ThemedText>
            </ThemedView>
          }
        />
        {selectedReport && (
          <ReportActions
            key={selectedReport.id}
            report={selectedReport}
            onClose={() => setSelectedId(null)}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    padding: 24,
    paddingBottom: BottomTabInset + 24,
  },
  header: {
    gap: 8,
    marginBottom: 24,
  },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  clearSearch: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  reportCard: {
    padding: 20,
    borderRadius: 12,
    gap: 8,
  },
  cardRow: { flexDirection: "row", borderRadius: 12, marginBottom: 12 },
  openReport: { flex: 1, minWidth: 0 },
  menuButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIcon: { fontSize: 28 },
  emptyState: {
    gap: 8,
  },
  pressed: {
    opacity: 0.7,
  },
});
