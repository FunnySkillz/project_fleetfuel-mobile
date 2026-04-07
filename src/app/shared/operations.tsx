import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { AppText, Button, Card, EmptyState, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useSharedFleet } from '@/shared-fleet/hooks/use-shared-fleet';
import { getFleetOperationalReport, runExpiredBlockNormalization } from '@/shared-fleet/services';
import type { FleetOperationalReport } from '@/shared-fleet/types';

const EMPTY_REPORT: FleetOperationalReport = {
  activeDrivers: 0,
  vehiclesInUse: 0,
  availableVehicles: 0,
  blockedVehicles: 0,
  pendingRequests: 0,
  archivedVehicles: 0,
  membershipCountsByRole: {},
  recentAuditActivity: [],
};

export default function SharedOperationsScreen() {
  const { activeFleet, activeFleetId } = useSharedFleet();
  const [report, setReport] = useState<FleetOperationalReport>(EMPTY_REPORT);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [normalizeBusy, setNormalizeBusy] = useState(false);
  const [normalizedCount, setNormalizedCount] = useState<number | null>(null);

  const isManager = useMemo(() => activeFleet?.role === 'owner' || activeFleet?.role === 'admin', [activeFleet?.role]);

  const loadReport = useCallback(async () => {
    if (!activeFleetId || !isManager) {
      setReport(EMPTY_REPORT);
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const loaded = await getFleetOperationalReport({ fleetId: activeFleetId });
      setReport(loaded);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Could not load operations report.');
    }
  }, [activeFleetId, isManager]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handleNormalizeBlocks = async () => {
    if (!activeFleetId) {
      return;
    }

    setNormalizeBusy(true);
    setErrorMessage(null);
    try {
      const normalized = await runExpiredBlockNormalization({ fleetId: activeFleetId, emitNotifications: true });
      setNormalizedCount(normalized);
      await loadReport();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not run block normalization.');
    } finally {
      setNormalizeBusy(false);
    }
  };

  if (!isManager) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <EmptyState title="Manager access required" description="Operations reporting is restricted to owner/admin roles." />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <SectionHeader
            title="Fleet Operations"
            description={activeFleet ? `Operational overview for ${activeFleet.fleet.name}.` : 'Select an active fleet first.'}
          />

          {status === 'loading' ? (
            <Card>
              <AppText variant="caption" color="secondary">Loading report...</AppText>
            </Card>
          ) : null}

          {status === 'error' ? (
            <Card tone="destructive">
              <AppText variant="caption" color="destructive">{errorMessage ?? 'Unexpected report error.'}</AppText>
            </Card>
          ) : null}

          <View style={styles.metricGrid}>
            <Card className="gap-1" variant="outline">
              <AppText variant="caption" color="secondary">Active drivers</AppText>
              <AppText variant="title" className="text-xl">{report.activeDrivers}</AppText>
            </Card>
            <Card className="gap-1" variant="outline">
              <AppText variant="caption" color="secondary">Vehicles in use</AppText>
              <AppText variant="title" className="text-xl">{report.vehiclesInUse}</AppText>
            </Card>
            <Card className="gap-1" variant="outline">
              <AppText variant="caption" color="secondary">Available vehicles</AppText>
              <AppText variant="title" className="text-xl">{report.availableVehicles}</AppText>
            </Card>
            <Card className="gap-1" variant="outline">
              <AppText variant="caption" color="secondary">Blocked vehicles</AppText>
              <AppText variant="title" className="text-xl">{report.blockedVehicles}</AppText>
            </Card>
            <Card className="gap-1" variant="outline">
              <AppText variant="caption" color="secondary">Pending requests</AppText>
              <AppText variant="title" className="text-xl">{report.pendingRequests}</AppText>
            </Card>
            <Card className="gap-1" variant="outline">
              <AppText variant="caption" color="secondary">Archived vehicles</AppText>
              <AppText variant="title" className="text-xl">{report.archivedVehicles}</AppText>
            </Card>
          </View>

          <Card className="gap-2">
            <AppText variant="subtitle">Membership Counts</AppText>
            <AppText variant="caption" color="secondary">
              Owners: {report.membershipCountsByRole.owner ?? 0}
            </AppText>
            <AppText variant="caption" color="secondary">
              Admins: {report.membershipCountsByRole.admin ?? 0}
            </AppText>
            <AppText variant="caption" color="secondary">
              Drivers: {report.membershipCountsByRole.driver ?? 0}
            </AppText>
          </Card>

          <Card className="gap-2">
            <AppText variant="subtitle">Auto-Unblock Normalization</AppText>
            <AppText variant="caption" color="secondary">
              Run on-demand normalization for expired block windows in this fleet.
            </AppText>
            <Button
              label="Run Normalization"
              variant="secondary"
              loading={normalizeBusy}
              loadingLabel="Running..."
              onPress={() => {
                void handleNormalizeBlocks();
              }}
            />
            {normalizedCount !== null ? (
              <AppText variant="caption" color="secondary">Normalized vehicles: {normalizedCount}</AppText>
            ) : null}
          </Card>

          <Card className="gap-2">
            <AppText variant="subtitle">Recent Audit Activity</AppText>
            {report.recentAuditActivity.length === 0 ? (
              <AppText variant="caption" color="secondary">No recent audit activity.</AppText>
            ) : (
              report.recentAuditActivity.slice(0, 10).map((audit) => (
                <Card key={audit.id} className="gap-1" variant="outline">
                  <AppText variant="label">{audit.eventType.replaceAll('_', ' ')}</AppText>
                  <AppText variant="caption" color="secondary">
                    {audit.entityType} {audit.entityId ?? ''}
                  </AppText>
                  <AppText variant="caption" color="secondary">
                    {new Date(audit.createdAt).toLocaleString()}
                  </AppText>
                </Card>
              ))
            )}
          </Card>
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
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
