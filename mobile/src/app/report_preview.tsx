import { Redirect, router } from "expo-router";
import { SymbolView } from "expo-symbols";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRef, useState } from "react";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useReportDraft } from "@/features/reports/report_draft_context";
import { useTheme } from "@/hooks/use-theme";
import { useReports } from "@/features/reports/reports_context";
import { pickDoc } from "@/features/reports/pick_document";

type SubmissionStatus = "idle" | "submitting" | "success" | "error";

export default function ReportPreviewScreen() {
  const { selectedDoc, setSelectedDoc, clearDraft } =
    useReportDraft();

  const { createReport, status: storageStatus, retryLoad } = useReports();
  const savingRef = useRef(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const theme = useTheme();
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [pickerError, setPickerError] = useState("");

  const isSubmitting = status === "submitting";
  const submitDisabled =
    isSubmitting || status === "success" || storageStatus !== "ready";

  if (savedId)
    return (
      <Redirect href={{ pathname: "/report/[id]", params: { id: savedId } }} />
    );

  if (!selectedDoc) {
    return <Redirect href="/" />;
  }

  async function handleSubmit() {
    if (submitDisabled || savingRef.current) {
      return;
    }

    savingRef.current = true;
    setStatus("submitting");
    setErrorMsg("");

    try {
      if (!selectedDoc) throw new Error("Select a document first.");
      const saved = await createReport({
        source: "document",
        document: selectedDoc,
      });
      setSavedId(saved.id);
      clearDraft();
      setStatus("success");
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );

      setStatus("error");
    } finally {
      savingRef.current = false;
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

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back to Home"
            disabled={isSubmitting}
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

          <ThemedView type="backgroundElement" style={styles.previewCard}>
            <ThemedText type="smallBold">Report Preview</ThemedText>

            <ThemedText type="smallBold">{selectedDoc.name}</ThemedText>

            <ThemedText themeColor="textSecondary">
              {selectedDoc.size !== undefined
                ? `${(selectedDoc.size / 1024).toFixed(1)} KB`
                : "File size unavailable"}
            </ThemedText>

            <ThemedText themeColor="textSecondary">
              Document will be saved locally. Extraction requires the
              backend.
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {Platform.OS === "web"
                ? "Browser demo: this report will be kept only until refresh."
                : "Not saved yet. Saving does not upload or analyze this report."}
            </ThemedText>
          </ThemedView>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting }}
            disabled={isSubmitting}
            onPress={handleChangeDocument}
            style={({ pressed }) => [
              styles.editButton,
              { borderColor: theme.textSecondary },
              isSubmitting && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <ThemedText>Change document</ThemedText>
          </Pressable>

          {pickerError !== "" && (
            <ThemedText accessibilityRole="alert">{pickerError}</ThemedText>
          )}

          {storageStatus !== "ready" && (
            <ThemedView style={styles.previewCard}>
              <ThemedText>
                {storageStatus === "loading"
                  ? "Opening report storage…"
                  : "Couldn’t load report storage."}
              </ThemedText>
              {storageStatus === "failed" && (
                <Pressable
                  accessibilityRole="button"
                  onPress={retryLoad}
                  style={styles.editButton}
                >
                  <ThemedText>Retry</ThemedText>
                </Pressable>
              )}
            </ThemedView>
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
                ? "Saving..."
                : status === "error"
                  ? "Try again"
                  : status === "success"
                    ? "Saved"
                    : "Save report"}
            </ThemedText>
          </Pressable>

          {status === "error" && (
            <ThemedText accessibilityRole="alert">{errorMsg}</ThemedText>
          )}

          {status === "success" && (
            <ThemedText accessibilityLiveRegion="polite">
              Report saved. No backend request was sent.
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
