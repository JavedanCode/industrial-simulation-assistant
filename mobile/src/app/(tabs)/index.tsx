import { router } from "expo-router";
import { ScrollView, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import * as DocumentPicker from "expo-document-picker";

import { AnimatedIcon } from "@/components/animated-icon";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useReportDraft } from "@/features/reports/report_draft_context";
import { prefetch } from "expo-router/build/global-state/router";

const Doc_Types = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/rtf",
  "text/rtf",
];

const Doc_Extension = /\.(pdf|docx?|txt|md|csv|rtf)$/i;

export default function HomeScreen() {
  const { selectedDoc: selectedDoc, setSelectedDoc: setSelectedDoc } =
    useReportDraft();

  const [docError, setDocError] = useState("");

  async function handlePickDoc() {
    setDocError("");

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: Doc_Types,
        multiple: false,
        copyToCacheDirectory: true,
        base64: false,
      });

      if (result.canceled) {
        return;
      }

      const document = result.assets[0];

      if (!document) {
        setDocError("No Document was selected.");
        return;
      }

      if (!Doc_Extension.test(document.name)) {
        setDocError("Not an allowed document type.");
        return;
      }

      setSelectedDoc(document);
    } catch {
      setDocError("Could not open the document. Please try again.");
    }
  }
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.heroSection}>
            <AnimatedIcon />

            <ThemedText type="subtitle" style={styles.centerText}>
              Report Assistant
            </ThemedText>

            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              Start with a document or paste your reports text
            </ThemedText>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.actions}>
            <ThemedText type="smallBold">Add a report</ThemedText>

            <Pressable
              accessibilityRole="button"
              onPress={handlePickDoc}
              style={({ pressed }) => [
                styles.pasteButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <ThemedText style={styles.pasteButtontext}>
                {selectedDoc ? "Replace document" : "Upload document"}
              </ThemedText>
            </Pressable>

            {docError !== "" && (
              <ThemedText accessibilityRole="alert">{docError}</ThemedText>
            )}

            {selectedDoc && (
              <ThemedView type="backgroundElement" style={{ gap: Spacing.two }}>
                <ThemedText type="smallBold">{selectedDoc.name}</ThemedText>

                <ThemedText themeColor="textSecondary">
                  {selectedDoc.size !== undefined
                    ? `${(selectedDoc.size / 1024).toFixed(1)} KB`
                    : "File size unavailable"}
                </ThemedText>

                <ThemedText type="small" themeColor="textSecondary">
                  Selected on this device. Not uploaded yet.
                </ThemedText>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setSelectedDoc(null);
                    setDocError("");
                  }}
                  style={({ pressed }) => [
                    styles.pasteButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <ThemedText style={styles.pasteButtontext}>
                    Remove document
                  </ThemedText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/report_preview",
                      params: { source: "document" },
                    })
                  }
                  style={({ pressed }) => [
                    styles.pasteButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <ThemedText style={styles.pasteButtontext}>
                    Preview document
                  </ThemedText>
                </Pressable>
              </ThemedView>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/paste-text")}
              style={({ pressed }) => [
                styles.pasteButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <ThemedText style={styles.pasteButtontext}>
                Paste text here
              </ThemedText>
            </Pressable>
          </ThemedView>
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
    flexGrow: 1,
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.five,
  },
  heroSection: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.four,
  },
  centerText: {
    textAlign: "center",
  },
  actions: {
    padding: Spacing.four,
    gap: Spacing.three,
    borderRadius: Spacing.four,
  },
  pasteButton: {
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  pasteButtontext: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
