import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { AppText, Button, Card, EmptyState, FormField, Input, SectionHeader, SelectField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { SharedFleetError } from '@/shared-fleet/errors';
import { useSharedFleet } from '@/shared-fleet/hooks/use-shared-fleet';
import { createInvite, loadFleetInvitations, revokeInvite } from '@/shared-fleet/services';
import type { FleetInvitation, MembershipRole } from '@/shared-fleet/types';

const ROLE_OPTIONS: { value: MembershipRole; label: string }[] = [
  { value: 'driver', label: 'Driver' },
  { value: 'admin', label: 'Admin' },
];

function formatInvitationMeta(invitation: FleetInvitation) {
  const dateText = new Date(invitation.createdAt).toLocaleDateString();
  return `${invitation.role} | created ${dateText} | status ${invitation.status}`;
}

export default function SharedInvitationsScreen() {
  const { activeFleet, activeFleetId } = useSharedFleet();
  const [invitations, setInvitations] = useState<FleetInvitation[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MembershipRole>('driver');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [revokeBusyId, setRevokeBusyId] = useState<string | null>(null);

  const canCreateInvite = useMemo(() => inviteEmail.trim().length > 0 && !!activeFleetId, [activeFleetId, inviteEmail]);

  const loadInvitations = useCallback(async (fleetId: string) => {
    setStatus('loading');
    setErrorMessage(null);

    try {
      const data = await loadFleetInvitations({ fleetId });
      setInvitations(data);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Could not load invitations.');
    }
  }, []);

  useEffect(() => {
    if (!activeFleetId) {
      setInvitations([]);
      setStatus('ready');
      return;
    }

    void loadInvitations(activeFleetId);
  }, [activeFleetId, loadInvitations]);

  const handleCreateInvite = async () => {
    if (!activeFleetId) {
      return;
    }

    setInviteBusy(true);
    setErrorMessage(null);

    try {
      await createInvite({
        fleetId: activeFleetId,
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail('');
      await loadInvitations(activeFleetId);
    } catch (error) {
      if (error instanceof SharedFleetError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Could not create invitation.');
      }
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!activeFleetId) {
      return;
    }

    setRevokeBusyId(invitationId);
    setErrorMessage(null);

    try {
      await revokeInvite({ invitationId });
      await loadInvitations(activeFleetId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not revoke invitation.');
    } finally {
      setRevokeBusyId(null);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={invitations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <SectionHeader
                title="Fleet Invitations"
                description={
                  activeFleet ? `Manage invitations for ${activeFleet.fleet.name}.` : 'Select an active fleet first.'
                }
              />

              <Card className="gap-3">
                <FormField label="Invite by email" required>
                  <Input
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="driver@company.com"
                  />
                </FormField>

                <FormField label="Role">
                  <SelectField
                    options={ROLE_OPTIONS}
                    value={inviteRole}
                    onChange={(value) => {
                      if (value === 'driver' || value === 'admin') {
                        setInviteRole(value);
                      }
                    }}
                  />
                </FormField>

                <Button
                  label="Send Invite"
                  loading={inviteBusy}
                  loadingLabel="Sending..."
                  disabled={!canCreateInvite}
                  onPress={() => {
                    void handleCreateInvite();
                  }}
                />

                {errorMessage ? (
                  <AppText variant="caption" color="destructive">
                    {errorMessage}
                  </AppText>
                ) : null}
              </Card>
            </View>
          }
          ListEmptyComponent={
            status === 'loading' ? (
              <Card>
                <AppText variant="caption" color="secondary">Loading invitations...</AppText>
              </Card>
            ) : status === 'error' ? (
              <EmptyState
                tone="destructive"
                title="Could not load invitations"
                description={errorMessage ?? 'Unexpected error while loading invitations.'}
              />
            ) : (
              <EmptyState
                title="No invitations yet"
                description="Create your first invitation to onboard drivers or admins."
              />
            )
          }
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <Card className="gap-2" variant="outline">
                <AppText variant="label">{item.email}</AppText>
                <AppText variant="caption" color="secondary">
                  {formatInvitationMeta(item)}
                </AppText>
                <AppText variant="caption" color="secondary">
                  Expires: {new Date(item.expiresAt).toLocaleString()}
                </AppText>

                {item.status === 'pending' ? (
                  <Button
                    label="Revoke Invite"
                    variant="destructive"
                    loading={revokeBusyId === item.id}
                    loadingLabel="Revoking..."
                    onPress={() => {
                      void handleRevokeInvite(item.id);
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
});
