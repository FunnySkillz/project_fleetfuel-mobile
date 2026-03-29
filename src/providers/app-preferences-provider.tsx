import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { createDefaultPreferences } from '@/preferences/defaults';
import { loadPreferences, savePreferences } from '@/preferences/storage';
import type { AppLanguage, AppPreferences, ThemeMode } from '@/preferences/types';

type ResolvedTheme = 'light' | 'dark';

type AppPreferencesContextValue = {
  preferences: AppPreferences;
  isHydrated: boolean;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setLanguage: (language: AppLanguage) => Promise<void>;
  reloadPreferences: () => Promise<void>;
};

const defaultPreferences = createDefaultPreferences();

const AppPreferencesContext = createContext<AppPreferencesContextValue>({
  preferences: defaultPreferences,
  isHydrated: false,
  resolvedTheme: 'light',
  setThemeMode: async () => {},
  setLanguage: async () => {},
  reloadPreferences: async () => {},
});

function resolveTheme(mode: ThemeMode, systemScheme: string | null | undefined): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }

  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function AppPreferencesProvider({ children }: React.PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [isHydrated, setIsHydrated] = useState(false);
  const preferencesRef = useRef<AppPreferences>(defaultPreferences);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await loadPreferences();
      if (!cancelled) {
        preferencesRef.current = stored;
        setPreferences(stored);
        setIsHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  const updatePreferences = useCallback(
    async (updater: (current: AppPreferences) => AppPreferences) => {
      const next = updater(preferencesRef.current);
      if (next === preferencesRef.current) {
        return;
      }

      preferencesRef.current = next;
      setPreferences(next);
      await savePreferences(next);
    },
    [],
  );

  const reloadPreferences = useCallback(async () => {
    const stored = await loadPreferences();
    preferencesRef.current = stored;
    setPreferences(stored);
    setIsHydrated(true);
  }, []);

  const setThemeMode = useCallback(
    async (mode: ThemeMode) => {
      await updatePreferences((current) => {
        if (current.themeMode === mode) {
          return current;
        }

        return { ...current, themeMode: mode };
      });
    },
    [updatePreferences],
  );

  const setLanguage = useCallback(
    async (language: AppLanguage) => {
      await updatePreferences((current) => {
        if (current.language === language) {
          return current;
        }

        return { ...current, language };
      });
    },
    [updatePreferences],
  );

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      preferences,
      isHydrated,
      resolvedTheme: resolveTheme(preferences.themeMode, systemScheme),
      setThemeMode,
      setLanguage,
      reloadPreferences,
    }),
    [isHydrated, preferences, reloadPreferences, setLanguage, setThemeMode, systemScheme],
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences() {
  return useContext(AppPreferencesContext);
}
