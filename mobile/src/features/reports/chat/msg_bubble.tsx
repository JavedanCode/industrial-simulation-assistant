import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { chatMsg } from "./chat_types";

type MsgBubbleProps = {
  message: chatMsg;
};

export function MsgBubble({ message }: MsgBubbleProps) {
  const isUser = message.role === "user";

  return (
    <ThemedView
      type="backgroundElement"
      style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.assistantBubble,
      ]}
    >
      <ThemedText type="smallBold" style={isUser ? styles.userText : undefined}>
        {isUser ? "You" : "Assistant"}
      </ThemedText>

      <ThemedText selectable style={isUser ? styles.userText : undefined}>
        {message.content}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: "90%",
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#2563EB",
  },
  assistantBubble: {
    alignSelf: "flex-start",
  },
  userText: {
    color: "#FFFFFF",
  },
});
