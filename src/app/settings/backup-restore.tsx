import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Button, Card, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAppPreferences } from '@/hooks/use-app-preferences';
import { useI18n } from '@/hooks/use-i18n';
import { createBackupZip, preflightRestore, restoreBackup } from '@/services/backup/backup-restore';
import { cleanupOrphanReceipts, scanReceiptCleanupReport } from '@/services/receipts/receipt-maintenance';
import type { ReceiptCleanupReport } from '@/services/receipts/receipt-maintenance-core';

export default function BackupRestoreScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { reloadPreferences } = useAppPreferences();

  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState<{ fileName: string; uri: string } | null>(null);
  const [cleanupReport, setCleanupReport] = useState<ReceiptCleanupReport | null>(null);

  const pickBackupUri = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (picked.canceled || picked.assets.length === 0) {
      return null;
    }

    return picked.assets[0].uri;
  };

  const confirm = (title: string, message: string, destructiveLabel: string) =>
    new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        {
          text: t('common.cancel'),
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: destructiveLabel,
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ]);
    });

  const handleCreateBackup = async () => {
    if (backupBusy) {
      return;
    }

    setBackupBusy(true);
    try {
      const result = await createBackupZip();
      setLastBackup({ fileName: result.fileName, uri: result.uri });
      Alert.alert(
        t('backup.createSuccessTitle'),
        t('backup.createSuccessMessage', {
          fileName: result.fileName,
          uri: result.uri,
        }),
      );
    } catch (error) {
      Alert.alert(t('backup.createFailedTitle'), error instanceof Error ? error.message : t('common.unexpectedError'));
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (restoreBusy) {
      return;
    }

    try {
      const backupUri = await pickBackupUri();
      if (!backupUri) {
        return;
      }

      setRestoreBusy(true);
      const preflight = await preflightRestore(backupUri);
      if (!preflight.ok) {
        Alert.alert(
          t('backup.preflightFailedTitle'),
          preflight.errors.join('\n') || t('backup.preflightFailedFallback'),
        );
        return;
      }

      const warningMessage = preflight.warnings.length > 0 ? `\n\n${preflight.warnings.join('\n')}` : '';
      const confirmed = await confirm(
        t('backup.restoreConfirmTitle'),
        `${t('backup.restoreConfirmMessage')}${warningMessage}`,
        t('backup.restoreConfirmAction'),
      );
      if (!confirmed) {
        return;
      }

      await restoreBackup(backupUri);
      await reloadPreferences();
      Alert.alert(t('backup.restoreSuccessTitle'), t('backup.restoreSuccessMessage'));
      router.replace('/');
    } catch (error) {
      Alert.alert(t('backup.restoreFailedTitle'), error instanceof Error ? error.message : t('common.unexpectedError'));
    } finally {
      setRestoreBusy(false);
    }
  };

  const handleScanOrphans = async () => {
    if (scanBusy) {
      return;
    }

    setScanBusy(true);
    try {
      const report = await scanReceiptCleanupReport();
      setCleanupReport(report);
    } catch (error) {
      Alert.alert(t('backup.scanFailedTitle'), error instanceof Error ? error.message : t('common.unexpectedError'));
    } finally {
      setScanBusy(false);
    }
  };

  const handleCleanupOrphans = async () => {
    if (cleanupBusy || !cleanupReport || cleanupReport.orphanCount === 0) {
      return;
    }

    const confirmed = await confirm(
      t('backup.cleanupConfirmTitle'),
      t('backup.cleanupConfirmMessage', { count: cleanupReport.orphanCount }),
      t('backup.cleanupConfirmAction'),
    );

    if (!confirmed) {
      return;
    }

    setCleanupBusy(true);
    try {
      const result = await cleanupOrphanReceipts(cleanupReport.orphanFiles);
      const refreshed = await scanReceiptCleanupReport();
      setCleanupReport(refreshed);

      Alert.alert(
        t('backup.cleanupSuccessTitle'),
        t('backup.cleanupSuccessMessage', {
          deleted: result.deletedCount,
          failed: result.failed.length,
        }),
      );
    } catch (error) {
      Alert.alert(t('backup.cleanupFailedTitle'), error instanceof Error ? error.message : t('common.unexpectedError'));
    } finally {
      setCleanupBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <SectionHeader title={t('backup.title')} description={t('backup.description')} />

          <Card className="gap-2">
            <Button
              label={backupBusy ? t('backup.creating') : t('backup.createAction')}
              variant="primary"
              loading={backupBusy}
              onPress={() => {
                void handleCreateBackup();
              }}
            />
            <Button
              label={restoreBusy ? t('backup.restoring') : t('backup.restoreAction')}
              variant="destructive"
              loading={restoreBusy}
              onPress={() => {
                void handleRestoreBackup();
              }}
            />

            {lastBackup ? (
              <Card variant="subtle" className="gap-1">
                <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">{t('backup.lastCreatedLabel')}</Text>
                <Text className="text-sm font-semibold text-text dark:text-dark-text">{lastBackup.fileName}</Text>
                <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">{lastBackup.uri}</Text>
              </Card>
            ) : null}
          </Card>

          <Card className="gap-2">
            <Button
              label={scanBusy ? t('backup.scanning') : t('backup.scanAction')}
              variant="secondary"
              loading={scanBusy}
              onPress={() => {
                void handleScanOrphans();
              }}
            />
            <Button
              label={cleanupBusy ? t('backup.cleaning') : t('backup.cleanupAction')}
              variant="ghost"
              tone="warning"
              loading={cleanupBusy}
              disabled={!cleanupReport || cleanupReport.orphanCount === 0}
              onPress={() => {
                void handleCleanupOrphans();
              }}
            />

            {cleanupReport ? (
              <Card variant="subtle" className="gap-1.5">
                <View style={styles.kpiRow}>
                  <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">{t('backup.scanReferenced')}</Text>
                  <Text className="text-xs font-semibold text-text dark:text-dark-text">{cleanupReport.referencedCount}</Text>
                </View>
                <View style={styles.kpiRow}>
                  <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">{t('backup.scanOrphans')}</Text>
                  <Text className="text-xs font-semibold text-text dark:text-dark-text">{cleanupReport.orphanCount}</Text>
                </View>
                <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">{cleanupReport.scanTimestamp}</Text>

                {cleanupReport.orphanFiles.length > 0 ? (
                  <View style={styles.listWrap}>
                    {cleanupReport.orphanFiles.slice(0, 20).map((file) => (
                      <Text key={file} className="text-[11px] text-textSecondary dark:text-dark-textSecondary">
                        {file}
                      </Text>
                    ))}
                    {cleanupReport.orphanFiles.length > 20 ? (
                      <Text className="text-[11px] text-textSecondary dark:text-dark-textSecondary">
                        {t('backup.moreFilesHint', { count: cleanupReport.orphanFiles.length - 20 })}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </Card>
            ) : null}
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
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listWrap: {
    gap: 2,
  },
});
