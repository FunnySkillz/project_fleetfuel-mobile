import { useIsFocused } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReasonRequiredModal } from '@/components/reason-required-modal';
import { ThemedView } from '@/components/themed-view';
import { ActionIcon, AppText, Button, Card, EmptyState, ListRow, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { vehiclesRepo } from '@/data/repositories';
import type { VehicleInsightSummary, VehicleUsageSplitPoint } from '@/data/types';
import { useI18n } from '@/hooks/use-i18n';
import { useNavigationPressGuard } from '@/hooks/use-navigation-press-guard';
import { useTheme } from '@/hooks/use-theme';

function formatDate(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }

  return parsed.toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return `EUR ${value.toFixed(2)}`;
}

function tripTagLabel(value: 'private' | 'business' | null, labels: { work: string; private: string; unclassified: string }) {
  if (value === 'business') {
    return labels.work;
  }
  if (value === 'private') {
    return labels.private;
  }

  return labels.unclassified;
}

function usageColor(point: VehicleUsageSplitPoint, accent: string, text: string, textSecondary: string) {
  if (point.key === 'business') {
    return accent;
  }
  if (point.key === 'private') {
    return text;
  }

  return textSecondary;
}

type KpiCardProps = {
  label: string;
  value: string;
  helper?: string;
};

function KpiCard({ label, value, helper }: KpiCardProps) {
  return (
    <Card className="w-[48%] gap-1 p-3">
      <AppText variant="caption" color="secondary">{label}</AppText>
      <AppText variant="subtitle" className="text-xl">{value}</AppText>
      {helper ? <AppText variant="caption" color="secondary">{helper}</AppText> : null}
    </Card>
  );
}

export default function VehicleDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { t } = useI18n();
  const { runGuarded } = useNavigationPressGuard();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ vehicleId?: string | string[] }>();
  const vehicleId = useMemo(() => {
    if (typeof params.vehicleId === 'string') {
      return params.vehicleId.trim();
    }
    if (Array.isArray(params.vehicleId)) {
      return params.vehicleId.map((entry) => entry.trim()).find((entry) => entry.length > 0) ?? '';
    }
    return '';
  }, [params.vehicleId]);

  const [summary, setSummary] = useState<VehicleInsightSummary | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reasonModalVisible, setReasonModalVisible] = useState(false);

  const loadVehicleInsight = useCallback(async () => {
    if (!vehicleId) {
      setStatus('error');
      setErrorMessage(t('vehicleDetail.errorMissingId'));
      setSummary(null);
      return;
    }

    setStatus((previous) => (previous === 'ready' ? 'ready' : 'loading'));
    setErrorMessage(null);

    try {
      const data = await vehiclesRepo.getInsightSummary(vehicleId, { monthCount: 6, recentTripLimit: 6 });

      if (!data) {
        setStatus('error');
        setErrorMessage(t('vehicleDetail.errorNotFound'));
        setSummary(null);
        return;
      }

      setSummary(data);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : t('vehicleDetail.errorLoadFailedFallback'));
      setSummary(null);
    }
  }, [t, vehicleId]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void loadVehicleInsight();
  }, [isFocused, loadVehicleInsight]);

  const monthlyMax = useMemo(() => {
    if (!summary) {
      return 1;
    }

    const max = Math.max(...summary.monthlyDistance.map((point) => point.distanceKm));
    return max > 0 ? max : 1;
  }, [summary]);

  const confirmDeleteVehicle = () => {
    if (!summary) {
      return;
    }

    Alert.alert(
      t('vehicleDetail.deleteTitle'),
      t('vehicleDetail.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('vehicleDetail.deleteAction'),
          style: 'destructive',
          onPress: () => {
            setReasonModalVisible(true);
          },
        },
      ],
    );
  };

  const openEditVehicle = useCallback(() => {
    if (!summary) {
      return;
    }

    router.push({
      pathname: '/vehicles/[vehicleId]/edit',
      params: { vehicleId: summary.vehicle.id },
    });
  }, [router, summary]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: t('root.vehicleDetail'),
          headerRight: summary
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('vehicleDetail.editAction')}
                  style={styles.headerIconButton}
                  onPress={openEditVehicle}>
                  <ActionIcon name="edit" color={theme.text} size={20} />
                </Pressable>
              )
            : undefined,
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}> 
          {status === 'loading' ? (
            <Card className="gap-2">
              <ActivityIndicator color={theme.textSecondary} />
              <AppText variant="caption" color="secondary">{t('vehicleDetail.loading')}</AppText>
            </Card>
          ) : status === 'error' || !summary ? (
            <EmptyState
              tone="destructive"
              title={t('vehicleDetail.errorLoadTitle')}
              description={errorMessage ?? t('common.unexpectedError')}
              actionLabel={t('common.retry')}
              onAction={() => void loadVehicleInsight()}
            />
          ) : (
            <>
              <SectionHeader
                title={summary.vehicle.name}
                description={`${summary.vehicle.plate} | ${summary.vehicle.make ?? '-'} ${summary.vehicle.model ?? ''} ${summary.vehicle.year ?? ''}`}
              />

              <Card className="gap-1.5">
                <AppText variant="label">{t('vehicleDetail.identityTitle')}</AppText>
                <AppText variant="caption" color="secondary">{t('vehicleDetail.vinLabel', { value: summary.vehicle.vin ?? '-' })}</AppText>
                <AppText variant="caption" color="secondary">{t('vehicleDetail.engineCodeLabel', { value: summary.vehicle.engineTypeCode ?? '-' })}</AppText>
                <AppText variant="caption" color="secondary">
                  {t('vehicleDetail.powerLabel', { ps: summary.vehicle.ps ?? '-', kw: summary.vehicle.kw ?? '-' })}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {t('vehicleDetail.displacementLabel', { value: summary.vehicle.engineDisplacementCc ?? '-' })}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {t('vehicleDetail.currentKmLabel', { value: summary.vehicle.currentOdometerKm })}
                </AppText>
              </Card>

              <View style={styles.kpiGrid}>
                <KpiCard label={t('vehicleDetail.kpi.totalTrips')} value={String(summary.kpis.totalTrips)} />
                <KpiCard label={t('vehicleDetail.kpi.totalDistance')} value={`${summary.kpis.totalDistanceKm} km`} />
                <KpiCard label={t('vehicleDetail.kpi.workDistance')} value={`${summary.kpis.businessDistanceKm} km`} />
                <KpiCard label={t('vehicleDetail.kpi.privateDistance')} value={`${summary.kpis.privateDistanceKm} km`} />
                <KpiCard label={t('vehicleDetail.kpi.fuelSpend')} value={formatCurrency(summary.kpis.fuelSpendTotal)} />
                <KpiCard
                  label={t('vehicleDetail.kpi.avgConsumption')}
                  value={
                    summary.kpis.avgConsumptionLPer100Km !== null
                      ? `${summary.kpis.avgConsumptionLPer100Km.toFixed(2)} L/100km`
                      : t('vehicleDetail.notEnoughData')
                  }
                />
              </View>

              <Card className="gap-2">
                <AppText variant="label">{t('vehicleDetail.monthlyDistanceTitle')}</AppText>
                <View style={styles.chartRows}>
                  {summary.monthlyDistance.map((point) => {
                    const widthPercent = Math.max(4, Math.round((point.distanceKm / monthlyMax) * 100));
                    return (
                      <View key={point.monthKey} style={styles.chartRow}>
                        <AppText className="w-16" variant="caption" color="secondary">{point.monthLabel}</AppText>
                        <View style={[styles.chartTrack, { backgroundColor: theme.backgroundSelected }]}>
                          <View
                            style={[
                              styles.chartBar,
                              {
                                width: `${widthPercent}%`,
                                backgroundColor: theme.accent,
                              },
                            ]}
                          />
                        </View>
                        <AppText className="w-20 text-right" variant="caption" color="secondary">
                          {point.distanceKm} km
                        </AppText>
                      </View>
                    );
                  })}
                </View>
              </Card>

              <Card className="gap-2">
                <AppText variant="label">{t('vehicleDetail.usageSplitTitle')}</AppText>
                <View style={styles.chartRows}>
                  {summary.usageSplit.map((item) => {
                    const widthPercent = Math.max(4, Math.round(item.ratio * 100));
                    return (
                      <View key={item.key} style={styles.chartRow}>
                        <AppText className="w-16" variant="caption" color="secondary">{item.label}</AppText>
                        <View style={[styles.chartTrack, { backgroundColor: theme.backgroundSelected }]}>
                          <View
                            style={[
                              styles.chartBar,
                              {
                                width: `${widthPercent}%`,
                                backgroundColor: usageColor(item, theme.accent, theme.text, theme.textSecondary),
                              },
                            ]}
                          />
                        </View>
                        <AppText className="w-20 text-right" variant="caption" color="secondary">
                          {item.distanceKm} km
                        </AppText>
                      </View>
                    );
                  })}
                </View>
              </Card>

              <Card className="gap-2">
                <Button
                  label={t('vehicleDetail.editAction')}
                  variant="secondary"
                  leftIcon={({ color, size }) => <ActionIcon name="edit" color={color} size={size} />}
                  onPress={openEditVehicle}
                />
                <Button
                  label={t('vehicleDetail.addTrip')}
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/trips/new',
                      params: { vehicleId: summary.vehicle.id },
                    })
                  }
                />
                <Button
                  label={t('vehicleDetail.addFuel')}
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/fuel/new',
                      params: { vehicleId: summary.vehicle.id },
                    })
                  }
                />
                <Button
                  label={t('vehicleDetail.historyAction')}
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/vehicles/[vehicleId]/history',
                      params: { vehicleId: summary.vehicle.id },
                    })
                  }
                />
              </Card>

              <Card className="gap-2">
                <SectionHeader title={t('vehicleDetail.recentTripsTitle')} actionLabel={t('vehicleDetail.openLogs')} onAction={() => router.push('/logs')} />

                {summary.recentTrips.length === 0 ? (
                  <EmptyState title={t('vehicleDetail.emptyTripsTitle')} description={t('vehicleDetail.emptyTripsDescription')} />
                ) : (
                  summary.recentTrips.map((trip) => (
                    <ListRow
                      key={trip.id}
                      title={trip.purpose}
                      subtitle={`${tripTagLabel(trip.privateTag, {
                        work: t('common.vehicleWork'),
                        private: t('common.vehiclePrivate'),
                        unclassified: t('common.unclassified'),
                      })} | ${trip.distanceKm} km | ${trip.startLocation ?? t('common.notAvailable')} -> ${trip.endLocation ?? t('common.notAvailable')}`}
                      meta={formatDate(trip.occurredAt)}
                      onPress={() =>
                        runGuarded(() => {
                          router.push({
                            pathname: '/entries/[entryId]',
                            params: { entryId: trip.id },
                          });
                        })
                      }
                    />
                  ))
                )}
              </Card>

              <Button
                label={deleting ? t('vehicleDetail.deleting') : t('vehicleDetail.deleteAction')}
                variant="destructive"
                leftIcon={({ color, size }) => <ActionIcon name="delete" color={color} size={size} />}
                loading={deleting}
                disabled={deleting}
                onPress={confirmDeleteVehicle}
              />
            </>
          )}
        </ScrollView>
        <ReasonRequiredModal
          visible={reasonModalVisible}
          title={t('audit.reason.vehicleDeleteTitle')}
          description={t('audit.reason.vehicleDeleteDescription')}
          confirmLabel={t('audit.reason.deleteAction')}
          submitting={deleting}
          onCancel={() => {
            if (deleting) {
              return;
            }
            setReasonModalVisible(false);
          }}
          onConfirm={(reason) => {
            if (!summary || deleting) {
              return;
            }

            void (async () => {
              setDeleting(true);
              try {
                await vehiclesRepo.delete(summary.vehicle.id, { reason });
                setReasonModalVisible(false);
                router.replace('/vehicles');
              } catch (error) {
                Alert.alert(t('vehicleDetail.deleteFailedTitle'), error instanceof Error ? error.message : t('common.unexpectedError'));
              } finally {
                setDeleting(false);
              }
            })();
          }}
        />
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
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chartRows: {
    gap: Spacing.one,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  chartTrack: {
    flex: 1,
    height: 10,
    borderRadius: Spacing.one,
    overflow: 'hidden',
  },
  chartBar: {
    height: '100%',
    borderRadius: Spacing.one,
  },
  headerIconButton: {
    padding: 6,
  },
});

