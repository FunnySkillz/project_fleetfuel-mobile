import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { AppText, Button, Card, EmptyState, FormField, ListRow, SectionHeader, TextArea } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useSharedFleet } from '@/shared-fleet/hooks/use-shared-fleet';
import { deactivateFleetMembership, loadFleetMembers, updateFleetMembershipRole } from '@/shared-fleet/services';
import type { FleetMemberProfile } from '@/shared-fleet/types';

function formatMemberSubtitle(member: FleetMemberProfile) {
  const profileLabel = member.profile?.displayName ?? member.profile?.email ?? member.userId;
  return `${profileLabel} | role: ${member.role}`;
}

function formatMemberMeta(member: FleetMemberProfile) {
  const invitedBy = member.invitedByUserId ? `invited by ${member.invitedByUserId}` : 'owner bootstrap';
  return `joined ${new Date(member.joinedAt).toLocaleDateString()} | ${invitedBy}`;
}

export default function SharedMembersScreen() {
  const { activeFleet, user } = useSharedFleet();
  const [members, setMembers] = useState<FleetMemberProfile[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [memberActionBusyId, setMemberActionBusyId] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState('');

  const isOwner = activeFleet?.role === 'owner';
  const currentUserId = user?.id ?? null;

  useEffect(() => {
    if (!activeFleet?.fleetId) {
      setMembers([]);
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    void (async () => {
      try {
        const data = await loadFleetMembers({ fleetId: activeFleet.fleetId });
        setMembers(data);
        setStatus('ready');
      } catch (error) {
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Could not load fleet members.');
      }
    })();
  }, [activeFleet?.fleetId]);

  const reloadMembers = async () => {
    if (!activeFleet?.fleetId) {
      return;
    }

    const data = await loadFleetMembers({ fleetId: activeFleet.fleetId });
    setMembers(data);
  };

  const runMemberAction = async (membershipId: string, action: () => Promise<void>) => {
    setMemberActionBusyId(membershipId);
    setErrorMessage(null);

    try {
      await action();
      await reloadMembers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not update membership.');
    } finally {
      setMemberActionBusyId(null);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <SectionHeader
                title="Fleet Members"
                description={
                  activeFleet ? `Members of ${activeFleet.fleet.name}.` : 'Select an active fleet first.'
                }
              />
              {isOwner ? (
                <Card className="gap-2">
                  <FormField label="Optional deactivation reason">
                    <TextArea
                      value={actionReason}
                      onChangeText={setActionReason}
                      placeholder="Policy update or temporary deactivation reason."
                    />
                  </FormField>
                </Card>
              ) : null}
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
                <AppText variant="caption" color="secondary">Loading members...</AppText>
              </Card>
            ) : status === 'error' ? (
              <EmptyState
                tone="destructive"
                title="Could not load members"
                description={errorMessage ?? 'Unexpected error while loading members.'}
              />
            ) : (
              <EmptyState
                title="No members found"
                description="This fleet currently has no active members."
              />
            )
          }
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <Card className="gap-2" variant="outline">
                <ListRow
                  title={item.profile?.email ?? item.userId}
                  subtitle={formatMemberSubtitle(item)}
                  meta={formatMemberMeta(item)}
                />
                {isOwner && item.role !== 'owner' && item.userId !== currentUserId ? (
                  <View style={styles.actions}>
                    <Button
                      label={item.role === 'driver' ? 'Promote to Admin' : 'Set as Driver'}
                      size="sm"
                      variant="secondary"
                      loading={memberActionBusyId === item.id}
                      loadingLabel="Updating..."
                      onPress={() => {
                        void runMemberAction(item.id, async () => {
                          await updateFleetMembershipRole({
                            membershipId: item.id,
                            role: item.role === 'driver' ? 'admin' : 'driver',
                          });
                        });
                      }}
                    />
                    <Button
                      label="Deactivate"
                      size="sm"
                      variant="destructive"
                      loading={memberActionBusyId === item.id}
                      loadingLabel="Deactivating..."
                      onPress={() => {
                        void runMemberAction(item.id, async () => {
                          await deactivateFleetMembership({
                            membershipId: item.id,
                            reason: actionReason || undefined,
                          });
                        });
                      }}
                    />
                  </View>
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
