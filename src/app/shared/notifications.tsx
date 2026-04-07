import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { AppText, Button, Card, EmptyState, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useSharedFleet } from '@/shared-fleet/hooks/use-shared-fleet';
import { getFleetNotifications, markAllNotificationsRead, markNotificationRead } from '@/shared-fleet/services';
import type { FleetNotification } from '@/shared-fleet/types';

const EVENT_LABEL: Record<FleetNotification['eventType'], string> = {
  fleet_created: 'Fleet created',
  invitation_sent: 'Invitation sent',
  invitation_accepted: 'Invitation accepted',
  invitation_revoked: 'Invitation revoked',
  vehicle_created: 'Vehicle created',
  vehicle_updated: 'Vehicle updated',
  vehicle_request_submitted: 'Vehicle request submitted',
  assignment_approved: 'Assignment approved',
  assignment_rejected: 'Assignment rejected',
  assignment_cancelled: 'Assignment cancelled',
  direct_assignment_created: 'Direct assignment created',
  assignment_ended: 'Assignment ended',
  vehicle_blocked: 'Vehicle blocked',
  vehicle_unblocked: 'Vehicle unblocked',
  vehicle_archived: 'Vehicle archived',
  vehicle_unarchived: 'Vehicle unarchived',
  membership_role_changed: 'Membership role changed',
  membership_deactivated: 'Membership deactivated',
};

function formatPayloadPreview(notification: FleetNotification) {
  if (!notification.payload || typeof notification.payload !== 'object' || Array.isArray(notification.payload)) {
    return '';
  }

  const payload = notification.payload as Record<string, unknown>;
  if (typeof payload.email === 'string' && payload.email) {
    return payload.email;
  }

  if (typeof payload.reason === 'string' && payload.reason) {
    return payload.reason;
  }

  if (typeof payload.status === 'string' && payload.status) {
    return `status ${payload.status}`;
  }

  if (typeof payload.vehicleId === 'string' && payload.vehicleId) {
    return `vehicle ${payload.vehicleId}`;
  }

  return '';
}

export default function SharedNotificationsScreen() {
  const { activeFleet, activeFleetId } = useSharedFleet();
  const [notifications, setNotifications] = useState<FleetNotification[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markAllBusy, setMarkAllBusy] = useState(false);

  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.isRead).length, [notifications]);

  const loadNotifications = useCallback(async () => {
    if (!activeFleetId) {
      setNotifications([]);
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const loaded = await getFleetNotifications({ fleetId: activeFleetId, limit: 200 });
      setNotifications(loaded);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Could not load notifications.');
    }
  }, [activeFleetId]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (notificationId: string) => {
    setBusyId(notificationId);
    setErrorMessage(null);
    try {
      await markNotificationRead({ notificationId });
      await loadNotifications();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not mark notification as read.');
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (!activeFleetId) {
      return;
    }

    setMarkAllBusy(true);
    setErrorMessage(null);
    try {
      await markAllNotificationsRead({ fleetId: activeFleetId });
      await loadNotifications();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not mark all notifications as read.');
    } finally {
      setMarkAllBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <SectionHeader
                title="Notifications"
                description={activeFleet ? `Recent events for ${activeFleet.fleet.name}.` : 'Select an active fleet first.'}
              />
              <Card className="gap-2">
                <AppText variant="caption" color="secondary">
                  Unread: {unreadCount}
                </AppText>
                <Button
                  label="Mark All Read"
                  size="sm"
                  variant="secondary"
                  disabled={unreadCount === 0}
                  loading={markAllBusy}
                  loadingLabel="Marking..."
                  onPress={() => {
                    void handleMarkAllRead();
                  }}
                />
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
                <AppText variant="caption" color="secondary">Loading notifications...</AppText>
              </Card>
            ) : status === 'error' ? (
              <EmptyState
                tone="destructive"
                title="Could not load notifications"
                description={errorMessage ?? 'Unexpected error while loading notifications.'}
              />
            ) : (
              <EmptyState title="No notifications" description="Operational events will appear here." />
            )
          }
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <Card className="gap-2" variant="outline">
                <AppText variant="label">{EVENT_LABEL[item.eventType] ?? item.eventType}</AppText>
                <AppText variant="caption" color="secondary">
                  {new Date(item.createdAt).toLocaleString()}
                </AppText>
                {formatPayloadPreview(item) ? (
                  <AppText variant="caption" color="secondary">{formatPayloadPreview(item)}</AppText>
                ) : null}
                {!item.isRead ? (
                  <Button
                    label="Mark Read"
                    size="sm"
                    variant="ghost"
                    loading={busyId === item.id}
                    loadingLabel="Marking..."
                    onPress={() => {
                      void handleMarkRead(item.id);
                    }}
                  />
                ) : (
                  <AppText variant="caption" color="secondary">Read</AppText>
                )}
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
