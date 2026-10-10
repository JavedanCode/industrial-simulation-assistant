import { Redirect, router } from "expo-router";
import { SymbolView } from "expo-symbols";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useReportDraft } from "@/features/reports/report_draft_context";
import { useTheme } from "@/hooks/use-theme";
import { submitReportDemo } from "@/features/reports/report_submission";

type SubmissionStatus = "idle" | "submitting" | "success" | "error";

export default function ReportPreviewScreen() {
  const { title, content } = useReportDraft();
  const theme = useTheme();
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const isSubmitting = status === "submitting";
  const submitDisabled = isSubmitting || status === "success";

  if (!content.trim()) {
    return <Redirect href="/paste-text" />;
  }

  async function handlSubmit() {
    if (submitDisabled) {
      return;
    }

    setStatus("submitting");
    setErrorMsg("");

    try {
      await submitReportDemo({ title, content });

      setStatus("success");
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );

      setStatus("error");
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
            accessibilityState={{
              disabled: submitDisabled,
              busy: isSubmitting,
            }}
            disabled={submitDisabled}
            onPress={handlSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              submitDisabled && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {isSubmitting && <ActivityIndicator color="#FFFFFF" />}
            <ThemedText style={styles.submitText}>
              {isSubmitting
                ? "Submitting..."
                : status === "error"
                  ? "Try again"
                  : status === "success"
                    ? "Demo Completed"
                    : "Submit report"}
            </ThemedText>
          </Pressable>

          {status === "error" && (
            <ThemedText accessibilityRole="alert">{errorMsg}</ThemedText>
          )}

          {status === "success" && (
            <ThemedText accessibilityLiveRegion="polite">
              Demo completed successfuly. Nothing was sent or saved.
            </ThemedText>
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
    flexDirection: "row",
    gap: 8,
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
  disabled: {
    opacity: 0.6,
  },
});
