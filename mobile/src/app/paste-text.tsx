import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { SymbolView } from "expo-symbols";
import { useReportDraft } from "@/features/reports/report_draft_context";

const Max_Report_Length = 10_000;
const Max_Title_Length = 120;

export default function PasteTextScreen() {
  const { title, content, setTitle, setContent } = useReportDraft();
  const [error, setError] = useState("");

  const theme = useTheme();

  function handlePreview() {
    setError("");

    if (!content.trim()) {
      setError("Enter some report text first.");
      return;
    }

    if (title.length > Max_Title_Length) {
      setError(`Keep the title within ${Max_Title_Length} characters.`);
      return;
    }

    if (content.length > Max_Report_Length) {
      setError(`Keep the report within ${Max_Report_Length} characters.`);
      return;
    }

    router.push("/report_preview");
  }
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView
        style={styles.container}
        edges={["top", "bottom", "left", "right"]}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back to Home"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/");
              }
            }}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
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

          <ThemedText>Report title (Optional)</ThemedText>

          <TextInput
            accessibilityLabel="Report title"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              setError("");
            }}
            maxLength={Max_Title_Length}
            placeholder="Example: Weekly production report"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.textSecondary,
              },
            ]}
          />

          <ThemedText>Report text</ThemedText>

          <TextInput
            accessibilityLabel="Report text"
            value={content}
            onChangeText={(text) => {
              setContent(text);
              setError("");
            }}
            placeholder="Type or paste your reports here..."
            placeholderTextColor={theme.textSecondary}
            multiline
            scrollEnabled
            maxLength={Max_Report_Length}
            textAlignVertical="top"
            style={[
              styles.input,
              styles.textArea,
              {
                color: theme.text,
                borderColor: theme.textSecondary,
              },
            ]}
          />

          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.charaCount}
          >
            {content.length.toLocaleString()} /{" "}
            {Max_Report_Length.toLocaleString()}
          </ThemedText>

          {content.length >= Max_Report_Length && (
            <ThemedText type="small">
              Character limit reached. Shorten the text to add more.
            </ThemedText>
          )}
          {error ? (
            <ThemedText accessibilityRole="alert">{error}</ThemedText>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={handlePreview}
            style={({ pressed }) => [
              styles.previewButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <ThemedText style={styles.previewButtonText}>
              Preview Report
            </ThemedText>
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
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  textArea: {
    height: 239.5,
  },
  backButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  charaCount: {
    textAlign: "right",
  },
  previewButton: {
    minHeight: 48,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  previewButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
