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
import { MAX_MSG_LENGTH, useReportChat } from "./report_chat_context";
import { useReports } from "../reports_context";
import { AnalysisSummary } from "./analysis_summary";

const MIN_INPUT_HEIGHT = 44;
const MAX_INPUT_HEIGHT = 132;

type ReportChatProps = {
  reportId: string;
};

export function ReportChat({ reportId }: ReportChatProps) {
  const theme = useTheme();
  const {
    getConversation,
    setDraft,
    sendMsg,
    retryMsg,
    storageStatus,
    saveErrors,
    retryLoad,
    retrySave,
    refreshChat,
    refreshing,
  } = useReportChat();
  const { reports } = useReports();
  const report = reports.find((item) => item.id === reportId);
  const openedRef = useRef(false);
  useEffect(() => {
    if (
      storageStatus === "ready" &&
      !openedRef.current &&
      report?.sync?.conversationId
    ) {
      openedRef.current = true;
      void refreshChat(reportId);
    }
  }, [storageStatus, report?.sync?.conversationId, refreshChat, reportId]);
  const {
    msgs,
    archivedMsgs,
    draft,
    errorMsg,
    replyStatus,
    failedMsg,
    pendingMsgId,
  } = getConversation(reportId);
  const [showArchive, setShowArchive] = useState(false);
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const listRef = useRef<FlatList<chatMsg>>(null);
  const scrollAfterSend = useRef(false);
  const canSend =
    !refreshing[reportId] &&
    !!report?.sync?.conversationId &&
    replyStatus === "idle" &&
    draft.trim().length > 0 &&
    draft.length <= MAX_MSG_LENGTH;

  function handleSend() {
    if (sendMsg(reportId)) {
      scrollAfterSend.current = true;
      setInputHeight(MIN_INPUT_HEIGHT);
    }
  }

  if (storageStatus !== "ready") {
    return (
      <ThemedView style={styles.storageState}>
        {storageStatus === "loading" ? (
          <>
            <ActivityIndicator color={theme.textSecondary} />
            <ThemedText>Loading conversation…</ThemedText>
          </>
        ) : (
          <>
            <ThemedText accessibilityRole="alert">
              {Platform.OS === "web"
                ? "Chat storage is available on Android and iOS. Open this app on your phone to use saved chats."
                : "Couldn’t load saved chats."}
            </ThemedText>
            {Platform.OS !== "web" && (
              <Pressable
                accessibilityRole="button"
                onPress={retryLoad}
                style={styles.retryButton}
              >
                <ThemedText type="smallBold">Retry</ThemedText>
              </Pressable>
            )}
          </>
        )}
      </ThemedView>
    );
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
        ListHeaderComponent={
          <ThemedView>
            {report?.sync?.analysis && (
              <AnalysisSummary analysis={report.sync.analysis} />
            )}
            {!!archivedMsgs?.length && (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showArchive }}
                  onPress={() => setShowArchive((value) => !value)}
                  style={styles.retryButton}
                >
                  <ThemedText type="small">
                    {showArchive ? "Hide" : "Show"} earlier local messages (
                    {archivedMsgs.length})
                  </ThemedText>
                </Pressable>
                {showArchive && (
                  <ThemedView style={{ gap: 16, paddingVertical: 16 }}>
                    <ThemedText themeColor="textSecondary">
                      Earlier local/demo messages. These are not part of the
                      backend conversation.
                    </ThemedText>
                    {archivedMsgs.map((msg) => (
                      <MsgBubble key={msg.id} message={msg} />
                    ))}
                  </ThemedView>
                )}
              </>
            )}
          </ThemedView>
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        onContentSizeChange={() => {
          if (scrollAfterSend.current) {
            scrollAfterSend.current = false;
            listRef.current?.scrollToEnd({ animated: true });
          }
        }}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary">
            Ask a question about the analysis above.
          </ThemedText>
        }
      />

      <ThemedView style={styles.composer}>
        <Pressable
          accessibilityRole="button"
          disabled={replyStatus === "loading" || !!refreshing[reportId]}
          onPress={() => void refreshChat(reportId)}
          style={styles.retryButton}
        >
          <ThemedText type="small" themeColor="textSecondary">
            {refreshing[reportId]
              ? "Refreshing conversation…"
              : "Refresh conversation"}
          </ThemedText>
        </Pressable>
        {Platform.OS === "web" && (
          <ThemedText type="small" themeColor="textSecondary">
            Local browser history resets on refresh. Submitted messages are also
            stored by the backend.
          </ThemedText>
        )}
        {saveErrors[reportId] && (
          <ThemedView style={styles.replyError}>
            <ThemedText type="small" accessibilityRole="alert">
              Changes haven’t been saved on this device.
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => retrySave(reportId)}
              style={styles.retryButton}
            >
              <ThemedText type="smallBold">Retry save</ThemedText>
            </Pressable>
          </ThemedView>
        )}
        {replyStatus === "loading" && (
          <ThemedView style={styles.replyStatus}>
            <ActivityIndicator size="small" color={theme.textSecondary} />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              accessibilityLiveRegion="polite"
            >
              Waiting for reply…
            </ThemedText>
          </ThemedView>
        )}
        {replyStatus === "failed" && failedMsg && (
          <ThemedView style={styles.replyError}>
            <ThemedText type="small" accessibilityRole="alert">
              {pendingMsgId
                ? "The previous reply was interrupted. Retry to continue."
                : "Couldn’t get a reply. Your message is still here. Retry to continue."}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry failed message"
              onPress={() => {
                retryMsg(reportId);
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
              setDraft(reportId, text);
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
  storageState: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
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
