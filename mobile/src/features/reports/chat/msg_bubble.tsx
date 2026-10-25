import { Pressable, StyleSheet } from "react-native";
import { memo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { AnalysisContent } from "./analysis_content";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import type { chatMsg } from "./chat_types";

type MsgBubbleProps = {
  message: chatMsg;
};

// Existing message objects stay stable when a new message is appended.
export const MsgBubble = memo(function MsgBubble({ message }: MsgBubbleProps) {
  const isUser = message.role === "user";
  const [copyStatus, setCopyStatus] = useState("");
  async function copyMsg() {
    try {
      // Copy the original reply, including tables, rather than the rendered pieces.
      const copied = await Clipboard.setStringAsync(message.content);
      setCopyStatus(
        copied ? "Copied" : "Couldn’t copy. Select the text to copy manually.",
      );
    } catch {
      setCopyStatus("Couldn’t copy. Select the text to copy manually.");
    }
  }

  return (
    <ThemedView
      type={isUser ? "backgroundElement" : "background"}
      style={isUser ? styles.userBubble : styles.assistantBubble}
    >
      {isUser ? (
        <ThemedText
          selectable
          accessibilityLabel={`${isUser ? "You" : "Assistant"}: ${message.content}`}
        >
          {message.content}
        </ThemedText>
      ) : (
        <>
          <AnalysisContent content={message.content} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy assistant reply"
            onPress={copyMsg}
            style={styles.copyButton}
          >
            <ThemedText type="small" themeColor="textSecondary">
              Copy reply
            </ThemedText>
          </Pressable>
          {copyStatus !== "" && (
            <ThemedText type="small" accessibilityLiveRegion="polite">
              {copyStatus}
            </ThemedText>
          )}
        </>
      )}
    </ThemedView>
  );
});

const styles = StyleSheet.create({
  copyButton: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    width: "100%",
  },
});
