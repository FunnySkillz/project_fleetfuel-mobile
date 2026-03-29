import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { AppText, Button, Card, EmptyState, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { entriesRepo } from '@/data/repositories';
import type { EntryDetail, FuelType } from '@/data/types';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

function formatDateTime(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }

  return `${parsed.toISOString().slice(0, 10)} ${parsed.toISOString().slice(11, 16)} UTC`;
}

type FuelTypeTranslationKey =
  | 'common.notAvailable'
  | 'fuelForm.fuelType.petrol'
  | 'fuelForm.fuelType.diesel'
  | 'fuelForm.fuelType.electric'
  | 'fuelForm.fuelType.hybrid'
  | 'fuelForm.fuelType.lpg'
  | 'fuelForm.fuelType.cng'
  | 'fuelForm.fuelType.other';

function fuelTypeLabel(value: FuelType | null, translate: (key: FuelTypeTranslationKey) => string) {
  if (!value) {
    return translate('common.notAvailable');
  }

  const labels = {
    petrol: translate('fuelForm.fuelType.petrol'),
    diesel: translate('fuelForm.fuelType.diesel'),
    electric: translate('fuelForm.fuelType.electric'),
    hybrid: translate('fuelForm.fuelType.hybrid'),
    lpg: translate('fuelForm.fuelType.lpg'),
    cng: translate('fuelForm.fuelType.cng'),
    other: translate('fuelForm.fuelType.other'),
  } as const;

  return labels[value];
}

type DetailLineProps = {
  label: string;
  value: ReactNode;
};

function DetailLine({ label, value }: DetailLineProps) {
  return (
    <View className="gap-0.5">
      <AppText variant="caption" color="secondary">{label}</AppText>
      {typeof value === 'string' ? (
        <AppText variant="label">{value}</AppText>
      ) : (
        value
      )}
    </View>
  );
}

export default function EntryDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { t } = useI18n();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ entryId?: string }>();
  const entryId = (params.entryId ?? '').trim();

  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadEntry = useCallback(async () => {
    if (!entryId) {
      setStatus('error');
      setErrorMessage(t('entryDetail.errorMissingId'));
      setEntry(null);
      return;
    }

    setStatus((previous) => (previous === 'ready' ? 'ready' : 'loading'));
    setErrorMessage(null);

    try {
      const data = await entriesRepo.getById(entryId);
      if (!data) {
        setStatus('error');
        setErrorMessage(t('entryDetail.errorNotFound'));
        setEntry(null);
        return;
      }

      setEntry(data);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : t('entryDetail.errorLoadFailedFallback'));
      setEntry(null);
    }
  }, [entryId, t]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void loadEntry();
  }, [isFocused, loadEntry]);

  const confirmDelete = () => {
    if (!entry) {
      return;
    }

    Alert.alert(t('entryDetail.deleteTitle'), t('entryDetail.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('entryDetail.deleteAction'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setDeleting(true);
            try {
              await entriesRepo.delete(entry.id);
              router.back();
            } catch (error) {
              Alert.alert(t('entryDetail.deleteFailedTitle'), error instanceof Error ? error.message : t('common.unexpectedError'));
            } finally {
              setDeleting(false);
            }
          })();
        },
      },
    ]);
  };

  const openReceipt = async () => {
    if (!entry || entry.type !== 'fuel' || !entry.receiptUri) {
      return;
    }

    const supported = await Linking.canOpenURL(entry.receiptUri);
    if (!supported) {
      Alert.alert(t('entryDetail.receiptOpenFailedTitle'), t('entryDetail.receiptOpenFailedMessage'));
      return;
    }

    await Linking.openURL(entry.receiptUri);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}> 
          <SectionHeader title={t('entryDetail.title')} description={entry ? t('entryDetail.descriptionLoaded', { id: entry.id }) : t('entryDetail.descriptionLoading')} />

          {status === 'loading' ? (
            <Card className="gap-2">
              <ActivityIndicator color={theme.textSecondary} />
              <AppText variant="caption" color="secondary">{t('entryDetail.loading')}</AppText>
            </Card>
          ) : status === 'error' || !entry ? (
            <EmptyState
              tone="destructive"
              title={t('entryDetail.errorLoadTitle')}
              description={errorMessage ?? t('common.unexpectedError')}
              actionLabel={t('common.retry')}
              onAction={() => void loadEntry()}
            />
          ) : (
            <>
              <Card className="gap-2">
                <DetailLine label={t('entryDetail.field.type')} value={entry.type === 'trip' ? t('entryDetail.typeTrip') : t('entryDetail.typeFuel')} />
                <DetailLine label={t('entryDetail.field.vehicle')} value={entry.vehicleName} />
                <DetailLine label={t('entryDetail.field.date')} value={formatDateTime(entry.occurredAt)} />

                {entry.type === 'trip' ? (
                  <>
                    <DetailLine label={t('entryDetail.field.purpose')} value={entry.purpose} />
                    <DetailLine label={t('entryDetail.field.startKm')} value={String(entry.startOdometerKm)} />
                    <DetailLine label={t('entryDetail.field.currentKm')} value={String(entry.endOdometerKm)} />
                    <DetailLine label={t('entryDetail.field.distance')} value={`${entry.distanceKm} km`} />
                    <DetailLine label={t('entryDetail.field.time')} value={`${entry.startTime ?? '--:--'} - ${entry.endTime ?? '--:--'}`} />
                    <DetailLine label={t('entryDetail.field.route')} value={`${entry.startLocation ?? t('common.notAvailable')} -> ${entry.endLocation ?? t('common.notAvailable')}`} />
                    <DetailLine
                      label={t('entryDetail.field.tag')}
                      value={
                        entry.privateTag === null
                          ? t('entryDetail.unclassifiedLegacy')
                          : entry.privateTag === 'business'
                            ? t('common.vehicleWork')
                            : t('common.vehiclePrivate')
                      }
                    />
                  </>
                ) : (
                  <>
                    <DetailLine label={t('entryDetail.field.fuelType')} value={fuelTypeLabel(entry.fuelType, t)} />
                    <DetailLine label={t('entryDetail.field.liters')} value={`${entry.liters.toFixed(2)} L`} />
                    <DetailLine label={t('entryDetail.field.totalPrice')} value={`EUR ${entry.totalPrice.toFixed(2)}`} />
                    <DetailLine label={t('entryDetail.field.station')} value={entry.station} />
                    <DetailLine label={t('entryDetail.field.odometer')} value={entry.odometerKm !== null ? String(entry.odometerKm) : t('common.notAvailable')} />
                    <DetailLine
                      label={t('entryDetail.field.avgConsumption')}
                      value={
                        entry.avgConsumptionLPer100Km !== null
                          ? `${entry.avgConsumptionLPer100Km.toFixed(2)} L / 100 km`
                          : t('entryDetail.notEnoughData')
                      }
                    />
                    <DetailLine
                      label={t('entryDetail.field.receipt')}
                      value={
                        entry.receiptUri ? (
                          <Button
                            label={entry.receiptName ?? t('entryDetail.openReceipt')}
                            variant="ghost"
                            size="sm"
                            className="self-start"
                            onPress={() => void openReceipt()}
                          />
                        ) : (
                          t('entryDetail.noReceipt')
                        )
                      }
                    />
                  </>
                )}

                <DetailLine label={t('entryDetail.field.notes')} value={entry.notes ?? t('entryDetail.noNotes')} />
              </Card>

              <Button
                label={t('entryDetail.editAction')}
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/entries/[entryId]/edit',
                    params: { entryId: entry.id },
                  })
                }
              />

              <Button
                label={deleting ? t('entryDetail.deleting') : t('entryDetail.deleteAction')}
                variant="destructive"
                loading={deleting}
                disabled={deleting}
                onPress={confirmDelete}
              />
            </>
          )}
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
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
});
