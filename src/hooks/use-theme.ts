/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useAppPreferences } from '@/hooks/use-app-preferences';

export function useTheme() {
  const { resolvedTheme } = useAppPreferences();
  return Colors[resolvedTheme];
}
