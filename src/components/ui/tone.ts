import { Colors } from '@/constants/theme';

export type SemanticTone = 'neutral' | 'success' | 'warning' | 'destructive';

type AppThemeColorKey = keyof (typeof Colors)['light'];
export type AppThemeColors = Record<AppThemeColorKey, string>;

export function toneTextColor(theme: AppThemeColors, tone: SemanticTone): string {
  if (tone === 'success') {
    return theme.success;
  }
  if (tone === 'warning') {
    return theme.warning;
  }
  if (tone === 'destructive') {
    return theme.destructive;
  }
  return theme.text;
}

export function toneMutedTextColor(theme: AppThemeColors, tone: SemanticTone): string {
  if (tone === 'neutral') {
    return theme.textSecondary;
  }
  return toneTextColor(theme, tone);
}

export function toneBorderColor(theme: AppThemeColors, tone: SemanticTone): string {
  if (tone === 'neutral') {
    return theme.backgroundSelected;
  }
  return toneTextColor(theme, tone);
}
