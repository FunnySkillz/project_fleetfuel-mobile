import { type Href, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { AppText, Button, Card, EmptyState, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useSharedFleet } from '@/shared-fleet/hooks/use-shared-fleet';
import { getFleetAssignmentHistory } from '@/shared-fleet/services';
import type { VehicleAssignmentWithContext } from '@/shared-fleet/types';

function timelineLine(assignment: VehicleAssignmentWithContext) {
  const start = assignment.startedAt ? new Date(assignment.startedAt).toLocaleString() : 'not started';
  const end = assignment.endedAt ? new Date(assignment.endedAt).toLocaleString() : 'ongoing';
  return `${assignment.status} | ${start} -> ${end}`;
}

export default function SharedAssignmentHistoryScreen() {
  const router = useRouter();
  const { activeFleet, activeFleetId } = useSharedFleet();
  const [history, setHistory] = useState<VehicleAssignmentWithContext[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!activeFleetId) {
      setHistory([]);
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const loaded = await getFleetAssignmentHistory({ fleetId: activeFleetId, limit: 300 });
      setHistory(loaded);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Could not load assignment history.');
    }
  }, [activeFleetId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <SectionHeader
                title="Assignment History"
                description={activeFleet ? `Timeline records for ${activeFleet.fleet.name}.` : 'Select an active fleet first.'}
              />
            </View>
          }
          ListEmptyComponent={
            status === 'loading' ? (
              <Card>
                <AppText variant="caption" color="secondary">Loading assignment history...</AppText>
              </Card>
            ) : status === 'error' ? (
              <EmptyState
                tone="destructive"
                title="Could not load history"
                description={errorMessage ?? 'Unexpected error while loading assignment history.'}
              />
            ) : (
              <EmptyState
                title="No assignment history"
                description="Timeline entries will appear once assignment workflows are used."
              />
            )
          }
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <Card className="gap-2" variant="outline">
                <AppText variant="label">{item.vehicle?.name ?? item.vehicleId}</AppText>
                <AppText variant="caption" color="secondary">
                  Plate: {item.vehicle?.plate ?? 'n/a'} | Driver: {item.driverProfile?.email ?? item.driverUserId}
                </AppText>
                <AppText variant="caption" color="secondary">{timelineLine(item)}</AppText>
                {item.endReason ? (
                  <AppText variant="caption" color="secondary">End reason: {item.endReason}</AppText>
                ) : null}
                {item.rejectedReason ? (
                  <AppText variant="caption" color="secondary">Rejected reason: {item.rejectedReason}</AppText>
                ) : null}
                {item.cancelledReason ? (
                  <AppText variant="caption" color="secondary">Cancelled reason: {item.cancelledReason}</AppText>
                ) : null}

                <Button
                  label="Open Vehicle"
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    router.push(`/shared/vehicles/${item.vehicleId}` as Href);
                  }}
                />
              </Card>
            </View>
          )}
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  headerSection: {
    gap: Spacing.three,
  },
  rowWrap: {
    marginTop: Spacing.two,
  },
});
