import { randomUUID } from "expo-crypto";
import { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import type { chatMsg } from "./chat_types";
import { MsgBubble } from "./msg_bubble";

const MAX_MSG_LENGTH = 10_000;

type ReportChatProps = {
  initialMsgs: chatMsg[];
};

export function ReportChat({ initialMsgs }: ReportChatProps) {
  const theme = useTheme();
  const [msgs, setMsgs] = useState<chatMsg[]>(() => [...initialMsgs]);
  const [draft, setDraft] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const listRef = useRef<FlatList<chatMsg>>(null);
  const canSend = draft.trim().length > 0 && draft.length <= MAX_MSG_LENGTH;

  function handleSend() {
    const content = draft.trim();

    if (!content) {
      setErrorMsg("Enter a message first.");
      return;
    }

    if (draft.length > MAX_MSG_LENGTH) {
      setErrorMsg("Your message cannot exceed 10,000 characters.");
      return;
    }

    try {
      const message: chatMsg = {
        id: randomUUID(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };

      setMsgs((previous) => [...previous, message]);
      setDraft("");
      setErrorMsg("");
    } catch {
      setErrorMsg("Could not add your message. Please try again.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : Platform.OS === "android"
            ? "height"
            : undefined
      }
    >
      <ThemedText type="small" themeColor="textSecondary">
        Demo chat. Messages are not sent or saved.
      </ThemedText>

      <FlatList
        ref={listRef}
        style={styles.container}
        contentContainerStyle={styles.messages}
        data={msgs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MsgBubble message={item} />}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary">No messages yet.</ThemedText>
        }
      />

      <ThemedView style={styles.composer}>
        <TextInput
          accessibilityLabel="Message about this report"
          placeholder="Ask about this report..."
          placeholderTextColor={theme.textSecondary}
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            setErrorMsg("");
          }}
          multiline
          scrollEnabled
          maxLength={MAX_MSG_LENGTH}
          textAlignVertical="top"
          style={[
            styles.input,
            {
              color: theme.text,
              borderColor: theme.textSecondary,
              backgroundColor: theme.backgroundElement,
            },
          ]}
        />

        <ThemedView style={styles.composerFooter}>
          <ThemedText type="small" themeColor="textSecondary">
            {draft.length.toLocaleString()} / 10,000
          </ThemedText>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={handleSend}
            style={({ pressed }) => [
              styles.sendButton,
              !canSend && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <ThemedText style={styles.sendText}>Send</ThemedText>
          </Pressable>
        </ThemedView>

        {draft.length === MAX_MSG_LENGTH && (
          <ThemedText type="small" themeColor="textSecondary">
            Message limit reached.
          </ThemedText>
        )}

        {errorMsg !== "" && (
          <ThemedText accessibilityRole="alert">{errorMsg}</ThemedText>
        )}
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messages: {
    paddingVertical: 16,
    gap: 12,
  },
  composer: {
    paddingTop: 12,
    gap: 8,
  },
  input: {
    height: 96,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  composerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sendButton: {
    minHeight: 48,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
