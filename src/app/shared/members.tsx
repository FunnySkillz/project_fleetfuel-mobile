import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { AppText, Card, EmptyState, ListRow, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useSharedFleet } from '@/shared-fleet/hooks/use-shared-fleet';
import { loadFleetMembers } from '@/shared-fleet/services';
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
  const { activeFleet } = useSharedFleet();
  const [members, setMembers] = useState<FleetMemberProfile[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <SectionHeader
                title="Fleet Members"
                description={
                  activeFleet ? `Members of ${activeFleet.fleet.name}.` : 'Select an active fleet first.'
                }
              />
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
              <ListRow
                title={item.profile?.email ?? item.userId}
                subtitle={formatMemberSubtitle(item)}
                meta={formatMemberMeta(item)}
              />
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
