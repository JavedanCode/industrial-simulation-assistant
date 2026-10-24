import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { AnalysisPresentation } from "@/api/contracts";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { AnalysisContent } from "./analysis_content";

export function AnalysisSummary({
  analysis,
}: {
  analysis: AnalysisPresentation;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);
  const [copyStatus, setCopyStatus] = useState("");
  async function copy() {
    try {
      setCopyStatus(
        (await Clipboard.setStringAsync(analysis.markdown))
          ? "Copied"
          : "Couldn’t copy. Select the text instead.",
      );
    } catch {
      setCopyStatus("Couldn’t copy. Select the text instead.");
    }
  }
  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.button}
      >
        <ThemedText type="smallBold">
          {expanded ? "Hide analysis ▴" : "Show analysis ▾"}
        </ThemedText>
      </Pressable>
      {expanded && (
        <>
          <AnalysisContent content={analysis.markdown} />
          {analysis.utilization.length > 0 && (
            <View style={styles.chart}>
              <ThemedText type="smallBold">Resource utilization</ThemedText>
              {analysis.utilization.map((metric, index) => (
                <View key={index} style={styles.metric}>
                  <ThemedText>
                    {metric.name} · {metric.kind}:{" "}
                    {(metric.value * 100).toFixed(1)}%
                  </ThemedText>
                  {/* Only the display scale is calculated; the metric itself comes from the API. */}
                  {metric.value >= 0 && metric.value <= 1 ? (
                    <View
                      accessibilityLabel={`${metric.name}: ${(metric.value * 100).toFixed(1)} percent`}
                      style={[
                        styles.track,
                        { backgroundColor: theme.backgroundElement },
                      ]}
                    >
                      <View
                        style={[
                          styles.bar,
                          { width: `${metric.value * 100}%` },
                        ]}
                      />
                    </View>
                  ) : (
                    <ThemedText type="small">
                      Outside the 0–100% chart range; showing the supplied
                      value.
                    </ThemedText>
                  )}
                </View>
              ))}
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => void copy()}
            style={styles.button}
          >
            <ThemedText type="small">Copy analysis</ThemedText>
          </Pressable>
          {!!copyStatus && (
            <ThemedText type="small" accessibilityLiveRegion="polite">
              {copyStatus}
            </ThemedText>
          )}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 12, marginBottom: 24 },
  button: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  chart: { gap: 16 },
  metric: { gap: 8 },
  track: { height: 12, borderRadius: 6, overflow: "hidden" },
  bar: { height: 12, backgroundColor: "#2563EB" },
});
