import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Card, FormField, SectionHeader, SelectField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/use-i18n';
import { useAppPreferences } from '@/hooks/use-app-preferences';
import type { AppLanguage, ThemeMode } from '@/preferences/types';

export default function AppearanceScreen() {
  const { preferences, setLanguage, setThemeMode } = useAppPreferences();
  const { t } = useI18n();
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);

  const handleThemeModeChange = async (value: string) => {
    const mode = value as ThemeMode;
    if (mode === preferences.themeMode || isSavingTheme) {
      return;
    }

    setIsSavingTheme(true);
    await setThemeMode(mode);
    setIsSavingTheme(false);
  };

  const handleLanguageChange = async (value: string) => {
    const language = value as AppLanguage;
    if (language === preferences.language || isSavingLanguage) {
      return;
    }

    setIsSavingLanguage(true);
    await setLanguage(language);
    setIsSavingLanguage(false);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <SectionHeader title={t('appearance.title')} description={t('appearance.description')} />

          <Card className="gap-3">
            <FormField label={t('appearance.theme.label')} hint={t('appearance.theme.hint')}>
              <SelectField
                value={preferences.themeMode}
                onChange={(value) => void handleThemeModeChange(value)}
                loading={isSavingTheme}
                options={[
                  { value: 'system', label: t('appearance.theme.system') },
                  { value: 'light', label: t('appearance.theme.light') },
                  { value: 'dark', label: t('appearance.theme.dark') },
                ]}
              />
            </FormField>

            <FormField label={t('appearance.language.label')} hint={t('appearance.language.hint')}>
              <SelectField
                value={preferences.language}
                onChange={(value) => void handleLanguageChange(value)}
                loading={isSavingLanguage}
                options={[
                  { value: 'en', label: t('appearance.language.en') },
                  { value: 'de', label: t('appearance.language.de') },
                ]}
              />
            </FormField>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
});
