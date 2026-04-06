export type ThemeMode = 'system' | 'light' | 'dark';
export type AppLanguage = 'en' | 'de';
export type AppMode = 'local' | 'shared';

export type AppPreferences = {
  themeMode: ThemeMode;
  language: AppLanguage;
  appLockEnabled: boolean;
  appMode: AppMode;
};
