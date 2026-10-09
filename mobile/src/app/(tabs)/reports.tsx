import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function ReportsScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content} edges={["top", "left", "right"]}>
        <ThemedText type="subtitle">Reports</ThemedText>

        <ThemedText>No reports yet.</ThemedText>

        <ThemedText themeColor="textSecondary">
          Your saved reports and their analysis will appear here.
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
});
