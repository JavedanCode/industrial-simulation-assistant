import { FlatList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth } from "@/constants/theme";
import { demoReports } from "@/features/reports/demo_reports";
import { ReportSummery } from "@/features/reports/report_types";

const statusLabels: Record<ReportSummery["status"], string> = {
  processing: "Processing",
  ready: "Anaylsis Ready",
  failed: "Analysis Failed",
};

//Copy the demo reports and sort them by creation date, newest first
const reports = [...demoReports].sort(
  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
);

//Format date using the device's Locale, with a short month name
function formatReportDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ReportsScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content} edges={["top", "left", "right"]}>
        <FlatList
          style={styles.container}
          contentContainerStyle={styles.content}
          data={reports}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <ThemedView style={styles.header}>
              <ThemedText type="subtitle">Reports</ThemedText>

              <ThemedText themeColor="textSecondary">
                Demo report - sample data for now.
              </ThemedText>
            </ThemedView>
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.reportCard}>
              <ThemedText type="smallBold">{item.title}</ThemedText>

              <ThemedText type="small" themeColor="textSecondary">
                {formatReportDate(item.createdAt)}
              </ThemedText>

              <ThemedText type="small" themeColor="textSecondary">
                {item.source === "document" ? "Document" : "Pasted text"}
              </ThemedText>

              <ThemedText type="smallBold">
                {statusLabels[item.status]}
              </ThemedText>
            </ThemedView>
          )}
          ListFooterComponent={
            <ThemedView style={styles.emptyState}>
              <ThemedText>No Reports Yet.</ThemedText>

              <ThemedText themeColor="textSecondary">
                Your saved reports and their analysis will appear here.
              </ThemedText>
            </ThemedView>
          }
        />
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
  reportCard: {
    padding: 20,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  emptyState: {
    gap: 8,
  },
});
