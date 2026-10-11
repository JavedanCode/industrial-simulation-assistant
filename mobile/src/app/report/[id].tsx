import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth } from "@/constants/theme";
import { demoReports } from "@/features/reports/demo_reports";
import { useTheme } from "@/hooks/use-theme";
import { ReportChat } from "@/features/reports/chat/report_chat";
import { demoMessagesByReport } from "@/features/reports/demo-msgs";

export default function ReportDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [showDetails, setShowDetails] = useState(false);

  const report = demoReports.find((item) => item.id === id);

  const msgs = report ? (demoMessagesByReport[report.id] ?? []) : [];

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/reports");
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: "padding", android: "padding" })}
      >
        <SafeAreaView style={styles.container}>
          <ThemedView style={styles.content}>
            <ThemedView style={styles.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to reports"
                onPress={handleBack}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.pressed,
                ]}
              >
                <SymbolView
                  name={{
                    ios: "chevron.left",
                    android: "arrow_back_ios_new",
                    web: "arrow_back_ios_new",
                  }}
                  size={24}
                  tintColor={theme.text}
                />
              </Pressable>
              <ThemedText
                type="smallBold"
                numberOfLines={1}
                style={styles.title}
              >
                {report?.title ?? "Report"}
              </ThemedText>
              {report && (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    Demo
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Report details"
                    accessibilityState={{ expanded: showDetails }}
                    onPress={() => setShowDetails((previous) => !previous)}
                    style={({ pressed }) => [
                      styles.backButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <SymbolView
                      name={{
                        ios: "info.circle",
                        android: "info",
                        web: "info",
                      }}
                      size={22}
                      tintColor={theme.textSecondary}
                    />
                  </Pressable>
                </>
              )}
            </ThemedView>

            {report ? (
              <>
                {showDetails && (
                  <ThemedView type="backgroundElement" style={styles.card}>
                    <ThemedText type="smallBold">{report.title}</ThemedText>

                    <ThemedText themeColor="textSecondary">
                      {new Date(report.createdAt).toLocaleDateString(
                        undefined,
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </ThemedText>

                    <ThemedText themeColor="textSecondary">
                      {report.source === "document"
                        ? "Document"
                        : "Pasted text"}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Demo report and chat. Messages are not sent or saved.
                    </ThemedText>
                  </ThemedView>
                )}

                {report.status === "ready" ? (
                  <ReportChat key={report.id} initialMsgs={msgs} />
                ) : (
                  <ThemedView type="backgroundElement" style={styles.card}>
                    <ThemedText type="smallBold">
                      {report.status === "processing"
                        ? "Processing"
                        : "Analysis failed"}
                    </ThemedText>

                    <ThemedText>
                      {report.status === "processing"
                        ? "This example represents a report waiting for analysis."
                        : "This example represents a report whose analysis failed."}
                    </ThemedText>

                    <ThemedText type="small" themeColor="textSecondary">
                      Demo status. No backend request is running.
                    </ThemedText>
                  </ThemedView>
                )}
              </>
            ) : (
              <ThemedView style={styles.card}>
                <ThemedText type="smallBold">Report not found</ThemedText>

                <ThemedText>
                  This report is unavailable. Go back to the reports list.
                </ThemedText>
              </ThemedView>
            )}
          </ThemedView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 4,
  },
  title: {
    flex: 1,
    minWidth: 0,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  card: {
    marginHorizontal: 20,
    marginVertical: 12,
    padding: 20,
    borderRadius: 12,
    gap: 12,
  },
  pressed: {
    opacity: 0.7,
  },
});
