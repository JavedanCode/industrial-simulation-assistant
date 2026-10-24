import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { useReports } from "./reports_context";
import { useReportChat } from "./chat/report_chat_context";
import {
  MAX_REPORT_TITLE_LENGTH,
  validateReportTitle,
} from "./report_management";
import type { SavedReport } from "./report_types";

type Props = { report: SavedReport; onClose: () => void };

// Keep menu/form state outside the route so the report list stays easy to read.
// The parent mounts this only for the selected report, resetting it on each open.
export function ReportActions({ report, onClose }: Props) {
  const theme = useTheme();
  const { renameReport, deleteReport } = useReports();
  const { deleteConversation, storageStatus, retryLoad } = useReportChat();
  const [mode, setMode] = useState<"menu" | "rename" | "delete">("menu");
  const [title, setTitle] = useState(report.title);
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);
  // A ref blocks a second tap immediately, before React updates the button.
  const busyRef = useRef(false);

  function close() {
    if (!busyRef.current) onClose();
  }

  async function confirm() {
    if (busyRef.current || mode === "menu") return;
    busyRef.current = true;
    setBusy(true);
    setErrorMsg("");
    try {
      if (mode === "rename") {
        await renameReport(report.id, validateReportTitle(title));
      } else {
        await deleteReport(report.id, () => deleteConversation(report.id));
      }
      onClose();
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Please try again.";
      // Cleanup spans files and two databases, so a retry may finish a partial
      // deletion. Never promise that already-deleted data has been restored.
      setErrorMsg(
        mode === "delete"
          ? `Could not finish deleting. Some local data may already be removed. Retry to finish. ${reason}`
          : reason,
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={close}>
      <SafeAreaView style={styles.backdrop}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.center}
            keyboardShouldPersistTaps="handled"
          >
            <ThemedView
              type="backgroundElement"
              style={styles.dialog}
              accessibilityViewIsModal
            >
              <ThemedText type="subtitle">
                {mode === "menu"
                  ? "Report options"
                  : mode === "rename"
                    ? "Rename report"
                    : "Delete report?"}
              </ThemedText>
              <ThemedText numberOfLines={3}>{report.title}</ThemedText>
              {mode === "menu" ? (
                <>
                  <ActionButton
                    label="Rename"
                    onPress={() => setMode("rename")}
                  />
                  <ActionButton
                    label="Delete"
                    onPress={() => setMode("delete")}
                    danger
                  />
                </>
              ) : mode === "rename" ? (
                <>
                  <TextInput
                    accessibilityLabel="Report name"
                    autoFocus
                    value={title}
                    onChangeText={(value) => {
                      setTitle(value);
                      setErrorMsg("");
                    }}
                    editable={!busy}
                    maxLength={MAX_REPORT_TITLE_LENGTH}
                    returnKeyType="done"
                    onSubmitEditing={() => void confirm()}
                    style={[
                      styles.input,
                      { color: theme.text, borderColor: theme.textSecondary },
                    ]}
                  />
                  <ThemedText type="small" themeColor="textSecondary">
                    Changes the display name only. The original filename stays
                    the same.
                  </ThemedText>
                </>
              ) : (
                <>
                  <ThemedText>
                    Delete this report, its saved document copy, and all its
                    chat messages from this device? This cannot be undone. The
                    original file is kept.
                  </ThemedText>
                  {storageStatus !== "ready" && (
                    <View style={styles.status}>
                      <ThemedText>
                        {storageStatus === "loading"
                          ? "Loading chat storage…"
                          : "Chat storage couldn’t load."}
                      </ThemedText>
                      {storageStatus === "failed" && (
                        <ActionButton
                          label="Retry loading chat storage"
                          onPress={retryLoad}
                          disabled={busy}
                        />
                      )}
                    </View>
                  )}
                </>
              )}
              {errorMsg !== "" && (
                <ThemedText accessibilityRole="alert">{errorMsg}</ThemedText>
              )}
              {busy && (
                <ActivityIndicator
                  accessibilityLabel={
                    mode === "delete" ? "Deleting report" : "Saving name"
                  }
                />
              )}
              {mode !== "menu" && (
                <ActionButton
                  label={
                    busy
                      ? mode === "delete"
                        ? "Deleting…"
                        : "Saving…"
                      : errorMsg
                        ? "Try again"
                        : mode === "delete"
                          ? "Delete report"
                          : "Save name"
                  }
                  onPress={() => void confirm()}
                  disabled={
                    busy || (mode === "delete" && storageStatus !== "ready")
                  }
                  danger={mode === "delete"}
                />
              )}
              <ActionButton
                label={mode === "menu" ? "Close" : "Cancel"}
                onPress={close}
                disabled={busy}
              />
            </ThemedView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function ActionButton({
  label,
  onPress,
  disabled = false,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { borderColor: theme.textSecondary },
        danger && styles.danger,
        (pressed || disabled) && styles.dim,
      ]}
    >
      <ThemedText style={danger ? styles.dangerText : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  container: { flex: 1 },
  center: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 440,
    padding: 24,
    borderRadius: 20,
    gap: 16,
  },
  button: {
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 16,
  },
  status: { gap: 8 },
  danger: { backgroundColor: "#B91C1C", borderColor: "#B91C1C" },
  dangerText: { color: "#FFFFFF" },
  dim: { opacity: 0.6 },
});
