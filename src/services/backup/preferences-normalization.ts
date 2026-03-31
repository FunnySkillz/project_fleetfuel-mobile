import type { AppPreferences } from '@/preferences/types';

export function normalizeBackupPreferences(value: unknown): AppPreferences {
  const fallback: AppPreferences = { themeMode: 'system', language: 'en', appLockEnabled: false };

  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const record = value as { themeMode?: unknown; language?: unknown; appLockEnabled?: unknown };

  return {
    themeMode:
      record.themeMode === 'system' || record.themeMode === 'light' || record.themeMode === 'dark'
        ? record.themeMode
        : fallback.themeMode,
    language: record.language === 'de' || record.language === 'en' ? record.language : fallback.language,
    appLockEnabled:
      typeof record.appLockEnabled === 'boolean' ? record.appLockEnabled : fallback.appLockEnabled,
  };
}
