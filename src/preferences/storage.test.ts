import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPreferences, savePreferences } from '@/preferences/storage';

const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  },
}));

const STORAGE_KEY = 'fleetfuel.preferences.v1';

describe('preferences storage normalization', () => {
  beforeEach(() => {
    store.clear();
  });

  it('defaults appLockEnabled to false for legacy payloads', async () => {
    store.set(
      STORAGE_KEY,
      JSON.stringify({
        themeMode: 'dark',
        language: 'de',
      }),
    );

    const preferences = await loadPreferences();

    expect(preferences.themeMode).toBe('dark');
    expect(preferences.language).toBe('de');
    expect(preferences.appLockEnabled).toBe(false);
  });

  it('persists and reloads appLockEnabled', async () => {
    await savePreferences({
      themeMode: 'light',
      language: 'en',
      appLockEnabled: true,
    });

    const loaded = await loadPreferences();

    expect(loaded.themeMode).toBe('light');
    expect(loaded.language).toBe('en');
    expect(loaded.appLockEnabled).toBe(true);
  });
});
