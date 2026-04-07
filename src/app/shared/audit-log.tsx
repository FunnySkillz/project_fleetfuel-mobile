import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { AppText, Card, EmptyState, FormField, SectionHeader, SelectField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useSharedFleet } from '@/shared-fleet/hooks/use-shared-fleet';
import { getFleetAuditLog } from '@/shared-fleet/services';
import type { FleetAuditLog } from '@/shared-fleet/types';

function eventLabel(eventType: string) {
  return eventType.replaceAll('_', ' ');
}

export default function SharedAuditLogScreen() {
  const { activeFleet, activeFleetId } = useSharedFleet();
  const [logs, setLogs] = useState<FleetAuditLog[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<string>('all');

  const isManager = useMemo(() => activeFleet?.role === 'owner' || activeFleet?.role === 'admin', [activeFleet?.role]);

  const loadAuditLogs = useCallback(async () => {
    if (!activeFleetId || !isManager) {
      setLogs([]);
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const loaded = await getFleetAuditLog({
        fleetId: activeFleetId,
        eventType: eventFilter === 'all' ? null : eventFilter,
        limit: 300,
      });
      setLogs(loaded);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Could not load audit log.');
    }
  }, [activeFleetId, eventFilter, isManager]);

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  const eventOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All events' }];
    const unique = Array.from(new Set(logs.map((item) => item.eventType))).sort();
    return options.concat(unique.map((event) => ({ value: event, label: eventLabel(event) })));
  }, [logs]);

  if (!isManager) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <EmptyState title="Manager access required" description="Audit log visibility is restricted to owner/admin roles." />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <SectionHeader
                title="Audit Log"
                description={activeFleet ? `Admin audit trail for ${activeFleet.fleet.name}.` : 'Select an active fleet first.'}
              />
              <Card className="gap-2">
                <FormField label="Filter by event type">
                  <SelectField
                    options={eventOptions}
                    value={eventFilter}
                    onChange={(value) => {
                      setEventFilter(value);
                    }}
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
                <AppText variant="caption" color="secondary">Loading audit records...</AppText>
              </Card>
            ) : status === 'error' ? (
              <EmptyState
                tone="destructive"
                title="Could not load audit log"
                description={errorMessage ?? 'Unexpected error while loading audit records.'}
              />
            ) : (
              <EmptyState title="No audit records" description="Fleet audit entries will appear once operations occur." />
            )
          }
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <Card className="gap-1" variant="outline">
                <AppText variant="label">{eventLabel(item.eventType)}</AppText>
                <AppText variant="caption" color="secondary">
                  Entity: {item.entityType} {item.entityId ?? ''}
                </AppText>
                <AppText variant="caption" color="secondary">
                  Actor: {item.actorUserId ?? 'system'}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {new Date(item.createdAt).toLocaleString()}
                </AppText>
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
