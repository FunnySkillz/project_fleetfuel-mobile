import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { ActionRow, Card, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/use-i18n';
import { useNavigationPressGuard } from '@/hooks/use-navigation-press-guard';

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { runGuarded } = useNavigationPressGuard();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <SectionHeader
            title={t('settings.title')}
            description={t('settings.description')}
          />

          <Card className="gap-2">
            <ActionRow
              label={t('settings.appearance.label')}
              description={t('settings.appearance.description')}
              onPress={() =>
                runGuarded(() => {
                  router.push('/settings/appearance');
                })
              }
            />
            <ActionRow
              label={t('settings.security.label')}
              description={t('settings.security.rowDescription')}
              onPress={() =>
                runGuarded(() => {
                  router.push('/settings/security');
                })
              }
            />
            <ActionRow
              label={t('settings.backup.label')}
              description={t('settings.backup.description')}
              onPress={() =>
                runGuarded(() => {
                  router.push('/settings/backup-restore');
                })
              }
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
