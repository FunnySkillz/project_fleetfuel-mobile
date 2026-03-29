import type { AppLanguage, AppPreferences } from './types';

export const DEFAULT_THEME_MODE = 'system';

export function detectDefaultLanguage(): AppLanguage {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  return locale.startsWith('de') ? 'de' : 'en';
}

export function createDefaultPreferences(): AppPreferences {
  return {
    themeMode: DEFAULT_THEME_MODE,
    language: detectDefaultLanguage(),
  };
}
