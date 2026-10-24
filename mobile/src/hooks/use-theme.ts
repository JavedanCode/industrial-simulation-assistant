/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from "@/constants/theme";
import { useSettings } from "@/features/settings/settings_context";

export function useTheme() {
  return Colors[useSettings().colorScheme];
}
