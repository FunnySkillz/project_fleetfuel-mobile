import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Button, Card, EmptyState, ListRow, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { vehiclesRepo } from '@/data/repositories';
import type { VehicleInsightSummary, VehicleUsageSplitPoint } from '@/data/types';
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

function tripTagLabel(value: 'private' | 'business' | null) {
  if (value === 'business') {
    return 'Work';
  }
  if (value === 'private') {
    return 'Private';
  }

  return 'Unclassified';
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
      <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">{label}</Text>
      <Text className="text-xl font-semibold text-text dark:text-dark-text">{value}</Text>
      {helper ? <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">{helper}</Text> : null}
    </Card>
  );
}

export default function VehicleDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ vehicleId?: string }>();
  const vehicleId = (params.vehicleId ?? '').trim();

  const [summary, setSummary] = useState<VehicleInsightSummary | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadVehicleInsight = useCallback(async () => {
    if (!vehicleId) {
      setStatus('error');
      setErrorMessage('Missing vehicle id.');
      setSummary(null);
      return;
    }

    setStatus((previous) => (previous === 'ready' ? 'ready' : 'loading'));
    setErrorMessage(null);

    try {
      const data = await vehiclesRepo.getInsightSummary(vehicleId, { monthCount: 6, recentTripLimit: 6 });

      if (!data) {
        setStatus('error');
        setErrorMessage('Vehicle not found. It may have been deleted.');
        setSummary(null);
        return;
      }

      setSummary(data);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load vehicle insight.');
      setSummary(null);
    }
  }, [vehicleId]);

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
      'Delete vehicle?',
      'This will also delete all related trips and fuel entries on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeleting(true);
              try {
                await vehiclesRepo.delete(summary.vehicle.id);
                router.replace('/vehicles');
              } catch (error) {
                Alert.alert('Could not delete vehicle', error instanceof Error ? error.message : 'Unexpected error.');
              } finally {
                setDeleting(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}> 
          {status === 'loading' ? (
            <Card className="gap-2">
              <ActivityIndicator color={theme.textSecondary} />
              <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">Loading vehicle insight...</Text>
            </Card>
          ) : status === 'error' || !summary ? (
            <EmptyState
              tone="destructive"
              title="Could not load vehicle insight"
              description={errorMessage ?? 'Unexpected error.'}
              actionLabel="Retry"
              onAction={() => void loadVehicleInsight()}
            />
          ) : (
            <>
              <SectionHeader
                title={summary.vehicle.name}
                description={`${summary.vehicle.plate} | ${summary.vehicle.make ?? '-'} ${summary.vehicle.model ?? ''} ${summary.vehicle.year ?? ''}`}
              />

              <Card className="gap-1.5">
                <Text className="text-sm font-semibold text-text dark:text-dark-text">Vehicle Identity & Specs</Text>
                <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">VIN / FIN: {summary.vehicle.vin ?? '-'}</Text>
                <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">Engine code: {summary.vehicle.engineTypeCode ?? '-'}</Text>
                <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">
                  Power: {summary.vehicle.ps ?? '-'} PS / {summary.vehicle.kw ?? '-'} kW
                </Text>
                <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">
                  Displacement: {summary.vehicle.engineDisplacementCc ?? '-'} ccm
                </Text>
              </Card>

              <View style={styles.kpiGrid}>
                <KpiCard label="Total trips" value={String(summary.kpis.totalTrips)} />
                <KpiCard label="Total distance" value={`${summary.kpis.totalDistanceKm} km`} />
                <KpiCard label="Work distance" value={`${summary.kpis.businessDistanceKm} km`} />
                <KpiCard label="Private distance" value={`${summary.kpis.privateDistanceKm} km`} />
                <KpiCard label="Fuel spend" value={formatCurrency(summary.kpis.fuelSpendTotal)} />
                <KpiCard
                  label="Avg consumption"
                  value={
                    summary.kpis.avgConsumptionLPer100Km !== null
                      ? `${summary.kpis.avgConsumptionLPer100Km.toFixed(2)} L/100km`
                      : 'Not enough data'
                  }
                />
              </View>

              <Card className="gap-2">
                <Text className="text-sm font-semibold text-text dark:text-dark-text">Monthly Distance (last 6 months)</Text>
                <View style={styles.chartRows}>
                  {summary.monthlyDistance.map((point) => {
                    const widthPercent = Math.max(4, Math.round((point.distanceKm / monthlyMax) * 100));
                    return (
                      <View key={point.monthKey} style={styles.chartRow}>
                        <Text className="w-16 text-xs text-textSecondary dark:text-dark-textSecondary">{point.monthLabel}</Text>
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
                        <Text className="w-20 text-right text-xs text-textSecondary dark:text-dark-textSecondary">
                          {point.distanceKm} km
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Card>

              <Card className="gap-2">
                <Text className="text-sm font-semibold text-text dark:text-dark-text">Work / Private Split</Text>
                <View style={styles.chartRows}>
                  {summary.usageSplit.map((item) => {
                    const widthPercent = Math.max(4, Math.round(item.ratio * 100));
                    return (
                      <View key={item.key} style={styles.chartRow}>
                        <Text className="w-16 text-xs text-textSecondary dark:text-dark-textSecondary">{item.label}</Text>
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
                        <Text className="w-20 text-right text-xs text-textSecondary dark:text-dark-textSecondary">
                          {item.distanceKm} km
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Card>

              <Card className="gap-2">
                <Button
                  label="Add Trip"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/trips/new',
                      params: { vehicleId: summary.vehicle.id },
                    })
                  }
                />
                <Button
                  label="Add Fuel Entry"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: '/fuel/new',
                      params: { vehicleId: summary.vehicle.id },
                    })
                  }
                />
              </Card>

              <Card className="gap-2">
                <SectionHeader title="Recent Trips" actionLabel="Open Logs" onAction={() => router.push('/logs')} />

                {summary.recentTrips.length === 0 ? (
                  <EmptyState title="No trips recorded" description="Add your first trip for this vehicle." />
                ) : (
                  summary.recentTrips.map((trip) => (
                    <ListRow
                      key={trip.id}
                      title={trip.purpose}
                      subtitle={`${tripTagLabel(trip.privateTag)} | ${trip.distanceKm} km | ${trip.startLocation ?? 'N/A'} -> ${trip.endLocation ?? 'N/A'}`}
                      meta={formatDate(trip.occurredAt)}
                      onPress={() =>
                        router.push({
                          pathname: '/entries/[entryId]',
                          params: { entryId: trip.id },
                        })
                      }
                    />
                  ))
                )}
              </Card>

              <Button
                label={deleting ? 'Deleting...' : 'Delete Vehicle'}
                variant="destructive"
                loading={deleting}
                disabled={deleting}
                onPress={confirmDeleteVehicle}
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
});

