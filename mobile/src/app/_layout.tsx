import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  SettingsProvider,
  useSettings,
} from "@/features/settings/settings_context";
import { ReportDraftProvider } from "@/features/reports/report_draft_context";
import { ReportChatProvider } from "@/features/reports/chat/report_chat_context";

import { ReportsProvider } from "@/features/reports/reports_context";

import { AnimatedSplashOverlay } from "@/components/animated-icon";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SettingsProvider>
      <AppLayout />
    </SettingsProvider>
  );
}

function AppLayout() {
  const { colorScheme } = useSettings();
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <AnimatedSplashOverlay />
      <ReportDraftProvider>
        <ReportsProvider>
          <ReportChatProvider>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

              <Stack.Screen
                name="report_preview"
                options={{ headerShown: false }}
              />

              <Stack.Screen
                name="report/[id]"
                options={{ headerShown: false }}
              />
            </Stack>
          </ReportChatProvider>
        </ReportsProvider>
      </ReportDraftProvider>
    </ThemeProvider>
  );
}
