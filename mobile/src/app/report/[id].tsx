import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth } from "@/constants/theme";
import { demoReports } from "@/features/reports/demo_reports";
import { useTheme } from "@/hooks/use-theme";
import { MsgBubble } from "@/features/reports/chat/msg_bubble";
import { demoMessagesByReport } from "@/features/reports/demo-msgs";

export default function ReportDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();

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
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
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

          {report ? (
            <>
              <ThemedText type="subtitle">{report.title}</ThemedText>

              <ThemedText themeColor="textSecondary">
                {new Date(report.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </ThemedText>

              <ThemedText themeColor="textSecondary">
                {report.source === "document" ? "Document" : "Pasted text"}
              </ThemedText>

              {report.status === "ready" ? (
                <ThemedView style={styles.conversation}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Demo conversation — fictional analysis and messages.
                  </ThemedText>

                  {msgs.length > 0 ? (
                    msgs.map((message) => (
                      <MsgBubble key={message.id} message={message} />
                    ))
                  ) : (
                    <ThemedText themeColor="textSecondary">
                      No conversation is available for this report yet.
                    </ThemedText>
                  )}
                </ThemedView>
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
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    padding: 24,
    gap: 16,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  card: {
    padding: 20,
    borderRadius: 12,
    gap: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  conversation: {
    gap: 16,
  },
});
