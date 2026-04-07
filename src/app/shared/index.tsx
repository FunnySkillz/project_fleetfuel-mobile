import { type Href, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { ActionRow, AppText, Button, Card, FormField, Input, SectionHeader, SelectField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAppPreferences } from '@/hooks/use-app-preferences';
import { SharedFleetError } from '@/shared-fleet/errors';
import { useSharedFleet } from '@/shared-fleet/hooks/use-shared-fleet';
import {
  countFleetUnreadNotifications,
  createFleet,
  loadFleetAssignmentMetrics,
} from '@/shared-fleet/services';
import type { FleetAssignmentMetrics } from '@/shared-fleet/types';

const EMPTY_METRICS: FleetAssignmentMetrics = {
  activeDrivers: 0,
  vehiclesInUse: 0,
  availableVehicles: 0,
  blockedVehicles: 0,
  pendingRequests: 0,
};

export default function SharedHomeScreen() {
  const router = useRouter();
  const { setAppMode } = useAppPreferences();
  const {
    activeFleet,
    activeFleetId,
    dataBusy,
    fleets,
    refreshFleets,
    setActiveFleetId,
    signOut,
    authBusy,
  } = useSharedFleet();

  const [newFleetName, setNewFleetName] = useState('');
  const [creatingFleet, setCreatingFleet] = useState(false);
  const [fleetError, setFleetError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<FleetAssignmentMetrics>(EMPTY_METRICS);
  const [metricsBusy, setMetricsBusy] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const fleetOptions = useMemo(
    () => fleets.map((membership) => ({ value: membership.fleetId, label: membership.fleet.name })),
    [fleets],
  );

  useEffect(() => {
    if (!activeFleetId) {
      setMetrics(EMPTY_METRICS);
      setUnreadNotifications(0);
      return;
    }

    void (async () => {
      setMetricsBusy(true);
      try {
        const [loadedMetrics, unreadCount] = await Promise.all([
          loadFleetAssignmentMetrics({ fleetId: activeFleetId }),
          countFleetUnreadNotifications({ fleetId: activeFleetId }),
        ]);
        setMetrics(loadedMetrics);
        setUnreadNotifications(unreadCount);
      } catch {
        setMetrics(EMPTY_METRICS);
        setUnreadNotifications(0);
      } finally {
        setMetricsBusy(false);
      }
    })();
  }, [activeFleetId]);

  const handleCreateFleet = async () => {
    setCreatingFleet(true);
    setFleetError(null);

    try {
      const createdFleet = await createFleet({ name: newFleetName });
      setNewFleetName('');
      await refreshFleets();
      await setActiveFleetId(createdFleet.id);
    } catch (error) {
      if (error instanceof SharedFleetError) {
        setFleetError(error.message);
      } else {
        setFleetError(error instanceof Error ? error.message : 'Could not create fleet.');
      }
    } finally {
      setCreatingFleet(false);
    }
  };

  const metricLabel = (value: number) => (metricsBusy ? '...' : String(value));
  const isManager = activeFleet?.role === 'owner' || activeFleet?.role === 'admin';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SectionHeader
            title="Shared Fleet"
            description="Cloud-backed fleet workspace with assignment truth and role-aware controls."
          />

          {dataBusy ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <AppText variant="caption" color="secondary">Loading fleet workspace...</AppText>
            </View>
          ) : null}

          {fleets.length === 0 ? (
            <Card className="gap-3">
              <AppText variant="subtitle">Create your first fleet</AppText>
              <AppText variant="caption" color="secondary">
                You are not a member of any fleet yet. Create one to bootstrap your shared workspace.
              </AppText>

              <FormField label="Fleet name" required>
                <Input
                  value={newFleetName}
                  onChangeText={setNewFleetName}
                  placeholder="Acme Rentals Berlin"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </FormField>

              {fleetError ? (
                <AppText variant="caption" color="destructive">
                  {fleetError}
                </AppText>
              ) : null}

              <Button
                label="Create Fleet"
                loading={creatingFleet}
                loadingLabel="Creating Fleet..."
                onPress={() => {
                  void handleCreateFleet();
                }}
              />
            </Card>
          ) : (
            <>
              <Card className="gap-3">
                <FormField label="Active fleet" hint="Switch between your fleet memberships.">
                  <SelectField
                    options={fleetOptions}
                    value={activeFleetId}
                    onChange={(value) => {
                      void setActiveFleetId(value);
                    }}
                  />
                </FormField>

                <View style={styles.metricGrid}>
                  <Card className="gap-1" variant="outline">
                    <AppText variant="caption" color="secondary">Active drivers</AppText>
                    <AppText variant="title" className="text-xl">{metricLabel(metrics.activeDrivers)}</AppText>
                  </Card>
                  <Card className="gap-1" variant="outline">
                    <AppText variant="caption" color="secondary">Vehicles in use</AppText>
                    <AppText variant="title" className="text-xl">{metricLabel(metrics.vehiclesInUse)}</AppText>
                  </Card>
                  <Card className="gap-1" variant="outline">
                    <AppText variant="caption" color="secondary">Available vehicles</AppText>
                    <AppText variant="title" className="text-xl">{metricLabel(metrics.availableVehicles)}</AppText>
                  </Card>
                  <Card className="gap-1" variant="outline">
                    <AppText variant="caption" color="secondary">Blocked vehicles</AppText>
                    <AppText variant="title" className="text-xl">{metricLabel(metrics.blockedVehicles)}</AppText>
                  </Card>
                </View>

                <Card className="gap-1" variant="outline">
                  <AppText variant="caption" color="secondary">Pending assignment requests</AppText>
                  <AppText variant="title" className="text-2xl">{metricLabel(metrics.pendingRequests)}</AppText>
                  <AppText variant="caption" color="secondary">
                    {activeFleet ? `Fleet: ${activeFleet.fleet.name}` : 'No fleet selected'}
                  </AppText>
                </Card>
              </Card>

              <Card className="gap-2">
                <ActionRow
                  label="Vehicles"
                  description="Open vehicle access, statuses, and assignment controls."
                  onPress={() => {
                    router.push('/shared/vehicles' as Href);
                  }}
                />
                <ActionRow
                  label="Pending Requests"
                  description="Approve or reject assignment requests for your active fleet."
                  onPress={() => {
                    router.push('/shared/pending-requests' as Href);
                  }}
                />
                <ActionRow
                  label="Assignment History"
                  description="Review assignment timeline records across this fleet."
                  onPress={() => {
                    router.push('/shared/history' as Href);
                  }}
                />
                <ActionRow
                  label="Members"
                  description="View current fleet members and role assignments."
                  onPress={() => {
                    router.push('/shared/members' as Href);
                  }}
                />
                <ActionRow
                  label="Invitations"
                  description="Create and manage pending fleet invitations."
                  onPress={() => {
                    router.push('/shared/invitations' as Href);
                  }}
                />
                <ActionRow
                  label="Notifications"
                  description={
                    metricsBusy
                      ? 'Loading notification state...'
                      : unreadNotifications > 0
                        ? `${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}`
                        : 'No unread notifications'
                  }
                  onPress={() => {
                    router.push('/shared/notifications' as Href);
                  }}
                />
                {isManager ? (
                  <>
                    <ActionRow
                      label="Operations"
                      description="Fleet operations report, blocked normalization, and admin overview."
                      onPress={() => {
                        router.push('/shared/operations' as Href);
                      }}
                    />
                    <ActionRow
                      label="Audit Log"
                      description="Review secure fleet audit events and change history."
                      onPress={() => {
                        router.push('/shared/audit-log' as Href);
                      }}
                    />
                  </>
                ) : null}
                <ActionRow
                  label="Sign out"
                  description="End this shared session on the current device."
                  tone="warning"
                  disabled={authBusy}
                  onPress={() => {
                    void signOut();
                  }}
                />
                <ActionRow
                  label="Switch To Local Mode"
                  description="Return to local-only SQLite workflows."
                  onPress={() => {
                    void setAppMode('local');
                  }}
                />
              </Card>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
