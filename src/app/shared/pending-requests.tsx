import { type Href, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { AppText, Button, Card, EmptyState, FormField, SectionHeader, TextArea } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { SharedFleetError } from '@/shared-fleet/errors';
import { useSharedFleet } from '@/shared-fleet/hooks/use-shared-fleet';
import { approveAssignment, cancelAssignment, getFleetPendingAssignmentRequests, rejectAssignment } from '@/shared-fleet/services';
import type { VehicleAssignmentWithContext } from '@/shared-fleet/types';

export default function SharedPendingRequestsScreen() {
  const router = useRouter();
  const { activeFleet, activeFleetId, user } = useSharedFleet();
  const [requests, setRequests] = useState<VehicleAssignmentWithContext[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decisionReason, setDecisionReason] = useState('');

  const isManager = useMemo(() => activeFleet?.role === 'owner' || activeFleet?.role === 'admin', [activeFleet?.role]);
  const userId = user?.id ?? null;

  const loadRequests = useCallback(async () => {
    if (!activeFleetId) {
      setRequests([]);
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const loaded = await getFleetPendingAssignmentRequests({ fleetId: activeFleetId });
      setRequests(loaded);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Could not load pending requests.');
    }
  }, [activeFleetId]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const runAction = async (operation: () => Promise<void>) => {
    setBusy(true);
    setErrorMessage(null);

    try {
      await operation();
      await loadRequests();
    } catch (error) {
      if (error instanceof SharedFleetError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Operation failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <SectionHeader
                title="Pending Requests"
                description={activeFleet ? `Assignment queue for ${activeFleet.fleet.name}.` : 'Select an active fleet first.'}
              />
              <Card className="gap-3">
                <FormField label="Decision reason (optional)">
                  <TextArea
                    value={decisionReason}
                    onChangeText={setDecisionReason}
                    placeholder="Reason used for reject/cancel actions."
                  />
                </FormField>
              </Card>
              {errorMessage ? (
                <Card tone="destructive">
                  <AppText variant="caption" color="destructive">{errorMessage}</AppText>
                </Card>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            status === 'loading' ? (
              <Card>
                <AppText variant="caption" color="secondary">Loading pending requests...</AppText>
              </Card>
            ) : status === 'error' ? (
              <EmptyState
                tone="destructive"
                title="Could not load requests"
                description={errorMessage ?? 'Unexpected error while loading pending requests.'}
              />
            ) : (
              <EmptyState title="No pending requests" description="Request queue is currently empty." />
            )
          }
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <Card className="gap-2" variant="outline">
                <AppText variant="label">{item.driverProfile?.email ?? item.driverUserId}</AppText>
                <AppText variant="caption" color="secondary">
                  Vehicle: {item.vehicle?.name ?? item.vehicleId} ({item.vehicle?.plate ?? 'n/a'})
                </AppText>
                <AppText variant="caption" color="secondary">
                  Requested: {new Date(item.requestedAt).toLocaleString()}
                </AppText>

                <Button
                  label="Open Vehicle"
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    router.push(`/shared/vehicles/${item.vehicleId}` as Href);
                  }}
                />

                {isManager ? (
                  <View style={styles.actions}>
                    <Button
                      label="Approve"
                      size="sm"
                      loading={busy}
                      loadingLabel="Approving..."
                      onPress={() => {
                        void runAction(async () => {
                          await approveAssignment({ assignmentId: item.id });
                        });
                      }}
                    />
                    <Button
                      label="Reject"
                      size="sm"
                      variant="destructive"
                      loading={busy}
                      loadingLabel="Rejecting..."
                      onPress={() => {
                        void runAction(async () => {
                          await rejectAssignment({ assignmentId: item.id, reason: decisionReason || undefined });
                        });
                      }}
                    />
                  </View>
                ) : null}

                {!isManager && item.driverUserId === userId ? (
                  <Button
                    label="Cancel Request"
                    variant="secondary"
                    size="sm"
                    loading={busy}
                    loadingLabel="Cancelling..."
                    onPress={() => {
                      void runAction(async () => {
                        await cancelAssignment({ assignmentId: item.id, reason: decisionReason || undefined });
                      });
                    }}
                  />
                ) : null}
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
