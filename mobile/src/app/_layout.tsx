import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";
import { ReportDraftProvider } from "@/features/reports/report_draft_context";

import { AnimatedSplashOverlay } from "@/components/animated-icon";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <ReportDraftProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          <Stack.Screen name="paste-text" options={{ headerShown: false }} />
        </Stack>
      </ReportDraftProvider>
    </ThemeProvider>
  );
}
