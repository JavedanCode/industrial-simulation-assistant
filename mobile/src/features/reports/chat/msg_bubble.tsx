import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import type { chatMsg } from "./chat_types";

type MsgBubbleProps = {
  message: chatMsg;
};

export function MsgBubble({ message }: MsgBubbleProps) {
  const isUser = message.role === "user";

  return (
    <ThemedView
      type={isUser ? "backgroundElement" : "background"}
      style={isUser ? styles.userBubble : styles.assistantBubble}
    >
      <ThemedText
        selectable
        accessibilityLabel={`${isUser ? "You" : "Assistant"}: ${message.content}`}
      >
        {message.content}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
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
