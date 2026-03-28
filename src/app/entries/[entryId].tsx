import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { entriesRepo } from '@/data/repositories';
import type { EntryDetail } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

function formatDateTime(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }

  return `${parsed.toISOString().slice(0, 10)} ${parsed.toISOString().slice(11, 16)} UTC`;
}

export default function EntryDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
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
      setErrorMessage('Missing entry id.');
      setEntry(null);
      return;
    }

    setStatus((previous) => (previous === 'ready' ? 'ready' : 'loading'));
    setErrorMessage(null);

    try {
      const data = await entriesRepo.getById(entryId);
      if (!data) {
        setStatus('error');
        setErrorMessage('Entry not found. It may have been deleted.');
        setEntry(null);
        return;
      }

      setEntry(data);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load entry.');
      setEntry(null);
    }
  }, [entryId]);

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

    Alert.alert('Delete entry?', 'This removes the entry from local history and export results.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setDeleting(true);
            try {
              await entriesRepo.delete(entry.id);
              router.back();
            } catch (error) {
              Alert.alert('Could not delete entry', error instanceof Error ? error.message : 'Unexpected error.');
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
      Alert.alert('Cannot open receipt', 'No app can open this file on your device.');
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
          {status === 'loading' ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ActivityIndicator color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                Loading entry...
              </ThemedText>
            </ThemedView>
          ) : status === 'error' || !entry ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">Could not load entry</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {errorMessage ?? 'Unexpected error.'}
              </ThemedText>
              <Pressable onPress={() => void loadEntry()}>
                <ThemedText type="link">Retry</ThemedText>
              </Pressable>
            </ThemedView>
          ) : (
            <>
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="small" themeColor="textSecondary">
                  Entry ID
                </ThemedText>
                <ThemedText type="smallBold">{entry.id}</ThemedText>

                <ThemedText type="small" themeColor="textSecondary">
                  Type
                </ThemedText>
                <ThemedText type="smallBold">{entry.type === 'trip' ? 'Trip' : 'Fuel'}</ThemedText>

                <ThemedText type="small" themeColor="textSecondary">
                  Vehicle
                </ThemedText>
                <ThemedText type="smallBold">{entry.vehicleName}</ThemedText>

                <ThemedText type="small" themeColor="textSecondary">
                  Date
                </ThemedText>
                <ThemedText type="smallBold">{formatDateTime(entry.occurredAt)}</ThemedText>

                {entry.type === 'trip' ? (
                  <>
                    <ThemedText type="small" themeColor="textSecondary">
                      Purpose
                    </ThemedText>
                    <ThemedText type="smallBold">{entry.purpose}</ThemedText>

                    <ThemedText type="small" themeColor="textSecondary">
                      Start Km
                    </ThemedText>
                    <ThemedText type="smallBold">{entry.startOdometerKm}</ThemedText>

                    <ThemedText type="small" themeColor="textSecondary">
                      Current Km
                    </ThemedText>
                    <ThemedText type="smallBold">{entry.endOdometerKm}</ThemedText>

                    <ThemedText type="small" themeColor="textSecondary">
                      Distance
                    </ThemedText>
                    <ThemedText type="smallBold">{entry.distanceKm} km</ThemedText>

                    <ThemedText type="small" themeColor="textSecondary">
                      Time
                    </ThemedText>
                    <ThemedText type="smallBold">
                      {entry.startTime ?? '--:--'} - {entry.endTime ?? '--:--'}
                    </ThemedText>

                    <ThemedText type="small" themeColor="textSecondary">
                      Route
                    </ThemedText>
                    <ThemedText type="smallBold">
                      {entry.startLocation ?? 'N/A'} {'->'} {entry.endLocation ?? 'N/A'}
                    </ThemedText>

                    <ThemedText type="small" themeColor="textSecondary">
                      Tag
                    </ThemedText>
                    <ThemedText type="smallBold">{entry.privateTag ?? 'none'}</ThemedText>
                  </>
                ) : (
                  <>
                    <ThemedText type="small" themeColor="textSecondary">
                      Liters
                    </ThemedText>
                    <ThemedText type="smallBold">{entry.liters.toFixed(2)} L</ThemedText>

                    <ThemedText type="small" themeColor="textSecondary">
                      Total Price
                    </ThemedText>
                    <ThemedText type="smallBold">EUR {entry.totalPrice.toFixed(2)}</ThemedText>

                    <ThemedText type="small" themeColor="textSecondary">
                      Station
                    </ThemedText>
                    <ThemedText type="smallBold">{entry.station}</ThemedText>

                    <ThemedText type="small" themeColor="textSecondary">
                      Odometer
                    </ThemedText>
                    <ThemedText type="smallBold">{entry.odometerKm ?? 'N/A'}</ThemedText>

                    <ThemedText type="small" themeColor="textSecondary">
                      Avg Consumption
                    </ThemedText>
                    <ThemedText type="smallBold">
                      {entry.avgConsumptionLPer100Km !== null
                        ? `${entry.avgConsumptionLPer100Km.toFixed(2)} L / 100 km`
                        : 'Not enough data'}
                    </ThemedText>

                    <ThemedText type="small" themeColor="textSecondary">
                      Receipt
                    </ThemedText>
                    {entry.receiptUri ? (
                      <Pressable onPress={() => void openReceipt()}>
                        <ThemedText type="link">{entry.receiptName ?? 'Open receipt'}</ThemedText>
                      </Pressable>
                    ) : (
                      <ThemedText type="smallBold">No receipt attached</ThemedText>
                    )}
                  </>
                )}

                <ThemedText type="small" themeColor="textSecondary">
                  Notes
                </ThemedText>
                <ThemedText>{entry.notes ?? 'No notes.'}</ThemedText>
              </ThemedView>

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/entries/[entryId]/edit',
                    params: { entryId: entry.id },
                  })
                }>
                <ThemedView type="backgroundElement" style={styles.actionCard}>
                  <ThemedText type="smallBold">Edit Entry</ThemedText>
                </ThemedView>
              </Pressable>

              <Pressable onPress={confirmDelete} disabled={deleting} accessibilityState={{ disabled: deleting }}>
                <ThemedView type="backgroundElement" style={[styles.actionCard, deleting && styles.disabledAction]}>
                  <ThemedText type="smallBold" style={{ color: theme.destructive }}>
                    {deleting ? 'Deleting...' : 'Delete Entry'}
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
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  actionCard: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  disabledAction: {
    opacity: 0.45,
  },
});
