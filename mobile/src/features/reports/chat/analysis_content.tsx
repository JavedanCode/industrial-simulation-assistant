import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { parseAnalysis } from "./analysis_format";

function InlineText({ text }: { text: string }) {
  // Nested Text preserves selection without introducing a web/HTML renderer.
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) =>
    /^\*\*[^*]+\*\*$/.test(part) ? (
      <Text key={index} style={styles.bold}>
        {part.slice(2, -2)}
      </Text>
    ) : /^`[^`]+`$/.test(part) ? (
      <ThemedText key={index} type="code">
        {part.slice(1, -1)}
      </ThemedText>
    ) : (
      part
    ),
  );
}

export function AnalysisContent({ content }: { content: string }) {
  const theme = useTheme();
  return (
    <View style={styles.content}>
      {parseAnalysis(content).map((block, index) => {
        if (block.type === "table")
          return (
            <View key={index} style={styles.content}>
              <ThemedText type="small" themeColor="textSecondary">
                Table · swipe sideways if needed
              </ThemedText>
              <ScrollView
                horizontal
                accessibilityLabel="Analysis table"
                showsHorizontalScrollIndicator
              >
                <View>
                  {[block.headers, ...block.rows].map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.row}>
                      {row.map((cell, columnIndex) => (
                        <View
                          key={columnIndex}
                          style={[
                            styles.cell,
                            {
                              borderColor: theme.textSecondary,
                              backgroundColor:
                                rowIndex === 0
                                  ? theme.backgroundElement
                                  : theme.background,
                            },
                          ]}
                        >
                          <ThemedText
                            selectable
                            style={rowIndex === 0 && styles.bold}
                          >
                            <InlineText text={cell} />
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          );
        if (block.type === "code")
          return (
            <ThemedText
              key={index}
              selectable
              type="code"
              style={[
                styles.code,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              {block.text}
            </ThemedText>
          );
        return (
          <ThemedText
            key={index}
            selectable
            accessibilityRole={block.type === "heading" ? "header" : undefined}
            style={block.type === "heading" ? styles.heading : undefined}
          >
            {block.type === "list" ? `${block.marker} ` : ""}
            <InlineText text={block.text} />
          </ThemedText>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10 },
  bold: { fontWeight: "700" },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: "700", marginTop: 8 },
  code: { padding: 12, borderRadius: 8, lineHeight: 20 },
  row: { flexDirection: "row" },
  cell: { width: 180, padding: 12, borderWidth: 0.5 },
});
