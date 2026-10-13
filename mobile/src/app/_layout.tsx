import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";
import { ReportDraftProvider } from "@/features/reports/report_draft_context";
import { ReportChatProvider } from "@/features/reports/chat/report_chat_context";

import { AnimatedSplashOverlay } from "@/components/animated-icon";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <ReportDraftProvider>
        <ReportChatProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

            <Stack.Screen name="paste-text" options={{ headerShown: false }} />

            <Stack.Screen
              name="report_preview"
              options={{ headerShown: false }}
            />

            <Stack.Screen name="report/[id]" options={{ headerShown: false }} />
          </Stack>
        </ReportChatProvider>
      </ReportDraftProvider>
    </ThemeProvider>
  );
}
