import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Button, Card, EmptyState, SectionHeader } from '@/components/ui';
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

type DetailLineProps = {
  label: string;
  value: ReactNode;
};

function DetailLine({ label, value }: DetailLineProps) {
  return (
    <View className="gap-0.5">
      <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">{label}</Text>
      {typeof value === 'string' ? (
        <Text className="text-sm font-semibold text-text dark:text-dark-text">{value}</Text>
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
          <SectionHeader title="Entry Detail" description={entry ? `Entry ID: ${entry.id}` : 'Loading selected entry.'} />

          {status === 'loading' ? (
            <Card className="gap-2">
              <ActivityIndicator color={theme.textSecondary} />
              <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">Loading entry...</Text>
            </Card>
          ) : status === 'error' || !entry ? (
            <EmptyState
              tone="destructive"
              title="Could not load entry"
              description={errorMessage ?? 'Unexpected error.'}
              actionLabel="Retry"
              onAction={() => void loadEntry()}
            />
          ) : (
            <>
              <Card className="gap-2">
                <DetailLine label="Type" value={entry.type === 'trip' ? 'Trip' : 'Fuel'} />
                <DetailLine label="Vehicle" value={entry.vehicleName} />
                <DetailLine label="Date" value={formatDateTime(entry.occurredAt)} />

                {entry.type === 'trip' ? (
                  <>
                    <DetailLine label="Purpose" value={entry.purpose} />
                    <DetailLine label="Start Km" value={String(entry.startOdometerKm)} />
                    <DetailLine label="Current Km" value={String(entry.endOdometerKm)} />
                    <DetailLine label="Distance" value={`${entry.distanceKm} km`} />
                    <DetailLine label="Time" value={`${entry.startTime ?? '--:--'} - ${entry.endTime ?? '--:--'}`} />
                    <DetailLine label="Route" value={`${entry.startLocation ?? 'N/A'} -> ${entry.endLocation ?? 'N/A'}`} />
                    <DetailLine
                      label="Tag"
                      value={entry.privateTag === null ? 'unclassified (legacy)' : entry.privateTag}
                    />
                  </>
                ) : (
                  <>
                    <DetailLine label="Liters" value={`${entry.liters.toFixed(2)} L`} />
                    <DetailLine label="Total Price" value={`EUR ${entry.totalPrice.toFixed(2)}`} />
                    <DetailLine label="Station" value={entry.station} />
                    <DetailLine label="Odometer" value={entry.odometerKm !== null ? String(entry.odometerKm) : 'N/A'} />
                    <DetailLine
                      label="Avg Consumption"
                      value={
                        entry.avgConsumptionLPer100Km !== null
                          ? `${entry.avgConsumptionLPer100Km.toFixed(2)} L / 100 km`
                          : 'Not enough data'
                      }
                    />
                    <DetailLine
                      label="Receipt"
                      value={
                        entry.receiptUri ? (
                          <Button
                            label={entry.receiptName ?? 'Open receipt'}
                            variant="ghost"
                            size="sm"
                            className="self-start"
                            onPress={() => void openReceipt()}
                          />
                        ) : (
                          'No receipt attached'
                        )
                      }
                    />
                  </>
                )}

                <DetailLine label="Notes" value={entry.notes ?? 'No notes.'} />
              </Card>

              <Button
                label="Edit Entry"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/entries/[entryId]/edit',
                    params: { entryId: entry.id },
                  })
                }
              />

              <Button
                label={deleting ? 'Deleting...' : 'Delete Entry'}
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
