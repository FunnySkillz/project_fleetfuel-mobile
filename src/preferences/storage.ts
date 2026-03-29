import AsyncStorage from '@react-native-async-storage/async-storage';

import { createDefaultPreferences } from './defaults';
import type { AppLanguage, AppPreferences, ThemeMode } from './types';

const STORAGE_KEY = 'fleetfuel.preferences.v1';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'en' || value === 'de';
}

function normalizeStoredPreferences(value: unknown): AppPreferences {
  const fallback = createDefaultPreferences();

  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const record = value as { themeMode?: unknown; language?: unknown };

  return {
    themeMode: isThemeMode(record.themeMode) ? record.themeMode : fallback.themeMode,
    language: isAppLanguage(record.language) ? record.language : fallback.language,
  };
}

export async function loadPreferences(): Promise<AppPreferences> {
  const fallback = createDefaultPreferences();

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    return normalizeStoredPreferences(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

export async function savePreferences(preferences: AppPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Persistence failures should never block the app.
  }
}
