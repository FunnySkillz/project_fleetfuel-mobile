import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { ActionRow, Card, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';

export default function SettingsScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <SectionHeader
            title="Settings"
            description="App preferences, privacy, and backup controls live here. Export is intentionally under Logs in MVP."
          />

          <Card className="gap-2">
            <ActionRow label="Appearance" description="Theme mode controls are planned for MVP settings stack." disabled />
            <ActionRow
              label="Backup and Restore"
              description="Local backup and restore flow remains part of MVP readiness gate."
              disabled
            />
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
