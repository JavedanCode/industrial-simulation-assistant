import { Redirect, router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useReportDraft } from "@/features/reports/report_draft_context";
import { useTheme } from "@/hooks/use-theme";
import { submitReportDemo } from "@/features/reports/report_submission";

export default function ReportPreviewScreen() {
  const { title, content } = useReportDraft();
  const theme = useTheme();

  if (!content.trim()) {
    return <Redirect href="/paste-text" />;
  }

  async function handlSubmit() {
    console.log("Submitting Report...");

    try {
      await submitReportDemo({ title, content });

      console.log("Demo succeeded. Nothing was sent or saved.");
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : "Something went wrong",
      );
    }
  }

  function handleEdit() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/paste-text");
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back to edit report"
            onPress={handleEdit}
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

          <ThemedView type="backgroundElement" style={styles.previewCard}>
            <ThemedText type="smallBold">Report Preview</ThemedText>

            <ThemedText>{title.trim() || "Untitled report"}</ThemedText>

            <ThemedText selectable>{content.trim()}</ThemedText>

            <ThemedText type="small" themeColor="textSecondary">
              Not Saved or sent for normalization
            </ThemedText>
          </ThemedView>

          <Pressable
            accessibilityRole="button"
            onPress={handleEdit}
            style={({ pressed }) => [
              styles.editButton,
              { borderColor: theme.textSecondary },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText>Edit report</ThemedText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={handlSubmit}
            style={styles.submitButton}
          >
            <ThemedText style={styles.submitText}>Submit report</ThemedText>
          </Pressable>
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
  previewCard: {
    padding: 20,
    gap: 12,
    borderRadius: 12,
  },
  editButton: {
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    minHeight: 48,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.7,
  },
});
