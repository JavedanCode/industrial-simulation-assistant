import { randomUUID } from "expo-crypto";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { getDemoReply } from "./demo_chat_service";

const MAX_MSG_LENGTH = 10_000;
const MIN_INPUT_HEIGHT = 44;
const MAX_INPUT_HEIGHT = 132;
type ReplyStatus = "idle" | "loading" | "failed";

type ReportChatProps = {
  initialMsgs: chatMsg[];
};

export function ReportChat({ initialMsgs }: ReportChatProps) {
  const theme = useTheme();
  const [msgs, setMsgs] = useState<chatMsg[]>(() => [...initialMsgs]);
  const [draft, setDraft] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [replyStatus, setReplyStatus] = useState<ReplyStatus>("idle");
  const [failedMsg, setFailedMsg] = useState<chatMsg | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const listRef = useRef<FlatList<chatMsg>>(null);
  const scrollAfterSend = useRef(false);
  const canSend =
    replyStatus === "idle" &&
    draft.trim().length > 0 &&
    draft.length <= MAX_MSG_LENGTH;

  useEffect(() => {
    return () => {
      requestRef.current?.abort();
    };
  }, []);

  async function requestReply(message: chatMsg, retry = false) {
    // The ref locks immediately, before React renders the disabled button.
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setReplyStatus("loading");
    setFailedMsg(null);

    try {
      const content = await getDemoReply(message, {
        signal: controller.signal,
        retry,
      });
      if (controller.signal.aborted) return;
      const reply: chatMsg = {
        id: randomUUID(),
        role: "assistant",
        content,
        createdAt: new Date().toISOString(),
      };
      setMsgs((previous) => [...previous, reply]);
      setReplyStatus("idle");
    } catch {
      if (controller.signal.aborted) return;
      setFailedMsg(message);
      setReplyStatus("failed");
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }

  function handleSend() {
    if (requestRef.current || replyStatus !== "idle") return;
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

      scrollAfterSend.current = true;
      setMsgs((previous) => [...previous, message]);
      setDraft("");
      setInputHeight(MIN_INPUT_HEIGHT);
      setErrorMsg("");
      void requestReply(message);
    } catch {
      setErrorMsg("Could not add your message. Please try again.");
    }
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        ref={listRef}
        style={styles.container}
        contentContainerStyle={styles.messages}
        data={msgs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MsgBubble message={item} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        onContentSizeChange={() => {
          if (scrollAfterSend.current) {
            scrollAfterSend.current = false;
            listRef.current?.scrollToEnd({ animated: true });
          }
        }}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary">No messages yet.</ThemedText>
        }
      />

      <ThemedView style={styles.composer}>
        {replyStatus === "loading" && (
          <ThemedView style={styles.replyStatus}>
            <ActivityIndicator size="small" color={theme.textSecondary} />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              accessibilityLiveRegion="polite"
            >
              Analyzing… (demo)
            </ThemedText>
          </ThemedView>
        )}
        {replyStatus === "failed" && failedMsg && (
          <ThemedView style={styles.replyError}>
            <ThemedText type="small" accessibilityRole="alert">
              Couldn’t get a reply. Your message is still here. Retry to
              continue.
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry failed message"
              onPress={() => {
                void requestReply(failedMsg, true);
              }}
              style={({ pressed }) => [
                styles.retryButton,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}
            >
              <ThemedText type="smallBold">Retry</ThemedText>
            </Pressable>
          </ThemedView>
        )}
        <ThemedView type="backgroundElement" style={styles.inputRow}>
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
            enterKeyHint="send"
            submitBehavior={Platform.OS === "web" ? undefined : "submit"}
            onSubmitEditing={() => {
              if (canSend) handleSend();
            }}
            onKeyPress={
              Platform.OS === "web"
                ? (event) => {
                    // React Native Web exposes browser modifier/composition data.
                    const keyEvent =
                      event.nativeEvent as typeof event.nativeEvent & {
                        shiftKey?: boolean;
                        isComposing?: boolean;
                        keyCode?: number;
                        repeat?: boolean;
                      };
                    if (
                      keyEvent.key === "Enter" &&
                      !keyEvent.shiftKey &&
                      !keyEvent.isComposing &&
                      keyEvent.keyCode !== 229
                    ) {
                      event.preventDefault();
                      if (canSend && !keyEvent.repeat) handleSend();
                    }
                  }
                : undefined
            }
            scrollEnabled
            onContentSizeChange={({ nativeEvent }) => {
              setInputHeight(
                Math.min(
                  MAX_INPUT_HEIGHT,
                  Math.max(MIN_INPUT_HEIGHT, nativeEvent.contentSize.height),
                ),
              );
            }}
            maxLength={MAX_MSG_LENGTH}
            textAlignVertical="top"
            style={[
              styles.input,
              {
                color: theme.text,
                height: inputHeight,
              },
            ]}
          />

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
            <SymbolView
              name={{
                ios: "arrow.up",
                android: "arrow_upward",
                web: "arrow_upward",
              }}
              size={22}
              tintColor="#FFFFFF"
            />
          </Pressable>
        </ThemedView>

        {draft.length >= MAX_MSG_LENGTH * 0.9 && (
          <ThemedText type="small" themeColor="textSecondary">
            {draft.length.toLocaleString()} / 10,000
            {draft.length === MAX_MSG_LENGTH ? " · Message limit reached." : ""}
          </ThemedText>
        )}

        {errorMsg !== "" && (
          <ThemedText accessibilityRole="alert">{errorMsg}</ThemedText>
        )}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
  },
  messages: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 24,
  },
  composer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  replyStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  replyError: {
    paddingHorizontal: 12,
    gap: 8,
  },
  retryButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 24,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 6,
    borderRadius: 28,
    gap: 4,
  },
  sendButton: {
    width: 44,
    height: 44,
    backgroundColor: "#2563EB",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
