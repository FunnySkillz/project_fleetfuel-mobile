import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { AppText, Card, FormField, SectionHeader, SelectField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAppPreferences } from '@/hooks/use-app-preferences';

export default function AppModeScreen() {
  const { preferences, setAppMode } = useAppPreferences();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <SectionHeader
            title="App Mode"
            description="Choose whether FleetFuel should run in local-only mode or Shared Fleet cloud mode."
          />

          <Card className="gap-3">
            <FormField label="Mode" hint="Local keeps SQLite-only workflows; Shared Fleet uses Supabase-authenticated cloud data.">
              <SelectField
                options={[
                  { value: 'local', label: 'Local mode' },
                  { value: 'shared', label: 'Shared Fleet mode' },
                ]}
                value={preferences.appMode}
                onChange={(value) => {
                  if (value === 'local' || value === 'shared') {
                    void setAppMode(value);
                  }
                }}
              />
            </FormField>

            <AppText variant="caption" color="secondary">
              Switching mode does not migrate data. Local and Shared Fleet are intentionally isolated in Sprint 1.
            </AppText>
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
