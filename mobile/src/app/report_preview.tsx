import { Redirect, router, useLocalSearchParams } from "expo-router";
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
import { pickDoc } from "@/features/reports/pick_document";

type SubmissionStatus = "idle" | "submitting" | "success" | "error";

export default function ReportPreviewScreen() {
  const { title, content, selectedDoc, setSelectedDoc } = useReportDraft();

  const { source } = useLocalSearchParams<{ source?: string }>();
  const isDoc = source === "document";

  const theme = useTheme();
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [pickerError, setPickerError] = useState("");

  const isSubmitting = status === "submitting";
  const submitDisabled = isSubmitting || status === "success";

  if (isDoc && !selectedDoc) {
    return <Redirect href="/" />;
  }

  if (!isDoc && !content.trim()) {
    return <Redirect href="/paste-text" />;
  }

  async function handleSubmit() {
    if (submitDisabled) {
      return;
    }

    setStatus("submitting");
    setErrorMsg("");

    try {
      if (isDoc) {
        if (!selectedDoc) {
          throw new Error("Select a document before submitting.");
        }

        await submitReportDemo({
          source: "document",
          document: selectedDoc,
        });
      } else {
        await submitReportDemo({
          source: "text",
          title,
          content,
        });
      }

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

  async function handleChangeDocument() {
    if (isSubmitting) {
      return;
    }

    setPickerError("");

    try {
      const document = await pickDoc();

      if (!document) {
        return;
      }

      setSelectedDoc(document);
      setStatus("idle");
      setErrorMsg("");
    } catch (error) {
      setPickerError(
        error instanceof Error
          ? error.message
          : "Could not open the document. Please try again.",
      );
    }
  }

  function handleEdit() {
    if (router.canGoBack()) {
      router.back();
    } else if (isDoc) {
      router.replace("/");
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
            accessibilityLabel={
              isDoc ? "Go back to Home" : "Go back to edit report"
            }
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

            {isDoc && selectedDoc ? (
              <>
                <ThemedText type="smallBold">{selectedDoc.name}</ThemedText>

                <ThemedText themeColor="textSecondary">
                  {selectedDoc.size !== undefined
                    ? `${(selectedDoc.size / 1024).toFixed(1)} KB`
                    : "File size unavailable"}
                </ThemedText>

                <ThemedText themeColor="textSecondary">
                  Text extraction will happen after backend submission.
                </ThemedText>
              </>
            ) : (
              <>
                <ThemedText>{title.trim() || "Untitled report"}</ThemedText>

                <ThemedText selectable>{content.trim()}</ThemedText>
              </>
            )}
            <ThemedText type="small" themeColor="textSecondary">
              Not Saved or sent for normalization
            </ThemedText>
          </ThemedView>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting }}
            disabled={isSubmitting}
            onPress={isDoc ? handleChangeDocument : handleEdit}
            style={({ pressed }) => [
              styles.editButton,
              { borderColor: theme.textSecondary },
              isSubmitting && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <ThemedText>{isDoc ? "Change document" : "Edit report"}</ThemedText>
          </Pressable>

          {pickerError !== "" && (
            <ThemedText accessibilityRole="alert">{pickerError}</ThemedText>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: submitDisabled,
              busy: isSubmitting,
            }}
            disabled={submitDisabled}
            onPress={handleSubmit}
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
              Demo completed successfully. Nothing was sent or saved.
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
