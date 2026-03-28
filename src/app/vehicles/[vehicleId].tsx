import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { logsRepo, vehiclesRepo } from '@/data/repositories';
import type { EntrySummary, VehicleRecord } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

function formatDate(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }

  return parsed.toISOString().slice(0, 10);
}

export default function VehicleDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ vehicleId?: string; name?: string; plate?: string }>();
  const vehicleId = (params.vehicleId ?? '').trim();

  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [recentEntries, setRecentEntries] = useState<EntrySummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadVehicle = useCallback(async () => {
    if (!vehicleId) {
      setStatus('error');
      setErrorMessage('Missing vehicle id.');
      setVehicle(null);
      setRecentEntries([]);
      return;
    }

    setStatus((previous) => (previous === 'ready' ? 'ready' : 'loading'));
    setErrorMessage(null);

    try {
      const [vehicleData, entries] = await Promise.all([
        vehiclesRepo.getById(vehicleId),
        logsRepo.list({ vehicleId, limit: 6 }),
      ]);

      if (!vehicleData) {
        setStatus('error');
        setErrorMessage('Vehicle not found. It may have been deleted.');
        setVehicle(null);
        setRecentEntries([]);
        return;
      }

      setVehicle(vehicleData);
      setRecentEntries(entries);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load vehicle.');
      setVehicle(null);
      setRecentEntries([]);
    }
  }, [vehicleId]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void loadVehicle();
  }, [isFocused, loadVehicle]);

  const confirmDeleteVehicle = () => {
    if (!vehicle) {
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
                await vehiclesRepo.delete(vehicle.id);
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
            <ThemedView type="backgroundElement" style={styles.hero}>
              <ActivityIndicator color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                Loading vehicle...
              </ThemedText>
            </ThemedView>
          ) : status === 'error' || !vehicle ? (
            <ThemedView type="backgroundElement" style={styles.hero}>
              <ThemedText type="smallBold">Could not load vehicle</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {errorMessage ?? 'Unexpected error.'}
              </ThemedText>
              <Pressable onPress={() => void loadVehicle()}>
                <ThemedText type="link">Retry</ThemedText>
              </Pressable>
            </ThemedView>
          ) : (
            <>
              <ThemedView type="backgroundElement" style={styles.hero}>
                <ThemedText type="subtitle">{vehicle.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {vehicle.plate}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Vehicle ID: {vehicle.id}
                </ThemedText>
              </ThemedView>

              <ThemedView type="backgroundElement" style={styles.specsCard}>
                <ThemedText type="smallBold">Vehicle Specs</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Make/Model: {vehicle.make ?? '-'} {vehicle.model ?? ''}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Year: {vehicle.year ?? '-'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Power: {vehicle.ps ?? '-'} PS / {vehicle.kw ?? '-'} kW
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Hubraum: {vehicle.engineDisplacementCc ?? '-'} ccm
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  VIN/FIN: {vehicle.vin ?? '-'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Engine code: {vehicle.engineTypeCode ?? '-'}
                </ThemedText>
              </ThemedView>

              <View style={styles.actions}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/trips/new',
                      params: { vehicleId: vehicle.id },
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
                      params: { vehicleId: vehicle.id },
                    })
                  }>
                  <ThemedView type="backgroundElement" style={styles.actionCard}>
                    <ThemedText type="smallBold">Add Fuel Entry</ThemedText>
                  </ThemedView>
                </Pressable>
              </View>

              <ThemedView type="backgroundElement" style={styles.infoCard}>
                <View style={styles.infoHeader}>
                  <ThemedText type="smallBold">Recent Activity</ThemedText>
                  <Pressable onPress={() => router.push('/logs')}>
                    <ThemedText type="link">Open Logs</ThemedText>
                  </Pressable>
                </View>

                {recentEntries.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    No trip or fuel entries for this vehicle yet.
                  </ThemedText>
                ) : (
                  recentEntries.map((entry) => (
                    <Pressable
                      key={entry.id}
                      onPress={() =>
                        router.push({
                          pathname: '/entries/[entryId]',
                          params: { entryId: entry.id },
                        })
                      }>
                      <View style={styles.entryRow}>
                        <View style={styles.entryRowLeft}>
                          <ThemedText type="smallBold">{entry.type === 'trip' ? 'Trip' : 'Fuel'}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {entry.summary}
                          </ThemedText>
                        </View>
                        <ThemedText type="small" themeColor="textSecondary">
                          {formatDate(entry.date)}
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
  hero: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  specsCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  actions: {
    gap: Spacing.two,
  },
  actionCard: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  infoCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  entryRowLeft: {
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
