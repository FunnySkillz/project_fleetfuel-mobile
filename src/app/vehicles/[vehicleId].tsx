import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
    <ThemedView type="backgroundElement" style={styles.kpiCard}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="subtitle" style={styles.kpiValue}>
        {value}
      </ThemedText>
      {helper ? (
        <ThemedText type="small" themeColor="textSecondary">
          {helper}
        </ThemedText>
      ) : null}
    </ThemedView>
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
            <ThemedView type="backgroundElement" style={styles.heroCard}>
              <ActivityIndicator color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                Loading vehicle insight...
              </ThemedText>
            </ThemedView>
          ) : status === 'error' || !summary ? (
            <ThemedView type="backgroundElement" style={styles.heroCard}>
              <ThemedText type="smallBold">Could not load vehicle insight</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {errorMessage ?? 'Unexpected error.'}
              </ThemedText>
              <Pressable onPress={() => void loadVehicleInsight()}>
                <ThemedText type="link">Retry</ThemedText>
              </Pressable>
            </ThemedView>
          ) : (
            <>
              <ThemedView type="backgroundElement" style={styles.heroCard}>
                <ThemedText type="subtitle">{summary.vehicle.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {summary.vehicle.plate}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {summary.vehicle.make ?? '-'} {summary.vehicle.model ?? ''} {summary.vehicle.year ?? ''}
                </ThemedText>
              </ThemedView>

              <ThemedView type="backgroundElement" style={styles.specsCard}>
                <ThemedText type="smallBold">Vehicle Identity & Specs</ThemedText>
                <View style={styles.specGrid}>
                  <ThemedText type="small" themeColor="textSecondary">
                    VIN / FIN: {summary.vehicle.vin ?? '-'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Engine code: {summary.vehicle.engineTypeCode ?? '-'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Power: {summary.vehicle.ps ?? '-'} PS / {summary.vehicle.kw ?? '-'} kW
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Displacement: {summary.vehicle.engineDisplacementCc ?? '-'} ccm
                  </ThemedText>
                </View>
              </ThemedView>

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

              <ThemedView type="backgroundElement" style={styles.chartCard}>
                <ThemedText type="smallBold">Monthly Distance (last 6 months)</ThemedText>
                <View style={styles.chartRows}>
                  {summary.monthlyDistance.map((point) => {
                    const widthPercent = Math.max(4, Math.round((point.distanceKm / monthlyMax) * 100));
                    return (
                      <View key={point.monthKey} style={styles.chartRow}>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.chartLabel}>
                          {point.monthLabel}
                        </ThemedText>
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
                        <ThemedText type="small" themeColor="textSecondary" style={styles.chartValue}>
                          {point.distanceKm} km
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>
              </ThemedView>

              <ThemedView type="backgroundElement" style={styles.chartCard}>
                <ThemedText type="smallBold">Work / Private Split</ThemedText>
                <View style={styles.chartRows}>
                  {summary.usageSplit.map((item) => {
                    const widthPercent = Math.max(4, Math.round(item.ratio * 100));
                    return (
                      <View key={item.key} style={styles.chartRow}>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.chartLabel}>
                          {item.label}
                        </ThemedText>
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
                        <ThemedText type="small" themeColor="textSecondary" style={styles.chartValue}>
                          {item.distanceKm} km
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>
              </ThemedView>

              <View style={styles.actions}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/trips/new',
                      params: { vehicleId: summary.vehicle.id },
                    })
                  }>
                  <ThemedView type="backgroundElement" style={styles.actionCard}>
                    <ThemedText type="smallBold">Add Trip</ThemedText>
                  </ThemedView>
                </Pressable>

                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/fuel/new',
                      params: { vehicleId: summary.vehicle.id },
                    })
                  }>
                  <ThemedView type="backgroundElement" style={styles.actionCard}>
                    <ThemedText type="smallBold">Add Fuel Entry</ThemedText>
                  </ThemedView>
                </Pressable>
              </View>

              <ThemedView type="backgroundElement" style={styles.recentCard}>
                <View style={styles.recentHeader}>
                  <ThemedText type="smallBold">Recent Trips</ThemedText>
                  <Pressable onPress={() => router.push('/logs')}>
                    <ThemedText type="link">Open Logs</ThemedText>
                  </Pressable>
                </View>

                {summary.recentTrips.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    No trips recorded for this vehicle yet.
                  </ThemedText>
                ) : (
                  summary.recentTrips.map((trip) => (
                    <Pressable
                      key={trip.id}
                      onPress={() =>
                        router.push({
                          pathname: '/entries/[entryId]',
                          params: { entryId: trip.id },
                        })
                      }>
                      <View style={styles.tripRow}>
                        <View style={styles.tripRowLeft}>
                          <ThemedText type="smallBold">{trip.purpose}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {tripTagLabel(trip.privateTag)} • {trip.distanceKm} km
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {trip.startLocation ?? 'N/A'} {'->'} {trip.endLocation ?? 'N/A'}
                          </ThemedText>
                        </View>
                        <ThemedText type="small" themeColor="textSecondary">
                          {formatDate(trip.occurredAt)}
                        </ThemedText>
                      </View>
                    </Pressable>
                  ))
                )}
              </ThemedView>

              <Pressable onPress={confirmDeleteVehicle} disabled={deleting} accessibilityState={{ disabled: deleting }}>
                <ThemedView type="backgroundElement" style={[styles.deleteCard, deleting && styles.disabledAction]}>
                  <ThemedText type="smallBold" style={{ color: theme.destructive }}>
                    {deleting ? 'Deleting...' : 'Delete Vehicle'}
                  </ThemedText>
                </ThemedView>
              </Pressable>
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
  heroCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  specsCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  specGrid: {
    gap: Spacing.half,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  kpiCard: {
    borderRadius: Spacing.three,
    padding: Spacing.two,
    gap: Spacing.half,
    width: '48%',
  },
  kpiValue: {
    fontSize: 24,
    lineHeight: 30,
  },
  chartCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
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
  chartLabel: {
    width: 62,
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
  chartValue: {
    width: 78,
    textAlign: 'right',
  },
  actions: {
    gap: Spacing.two,
  },
  actionCard: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  recentCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  tripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  tripRowLeft: {
    flex: 1,
    gap: Spacing.half,
  },
  deleteCard: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  disabledAction: {
    opacity: 0.45,
  },
});

