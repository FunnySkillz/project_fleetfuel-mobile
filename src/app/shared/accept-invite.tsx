import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { AppText, Button, Card, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { SharedFleetError } from '@/shared-fleet/errors';
import { useSharedFleet } from '@/shared-fleet/hooks/use-shared-fleet';
import { acceptInvite } from '@/shared-fleet/services';

function readParam(param: string | string[] | undefined) {
  if (!param) {
    return null;
  }

  return Array.isArray(param) ? param[0] : param;
}

export default function SharedAcceptInviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isAuthenticated, refreshFleets } = useSharedFleet();

  const invitationId = useMemo(() => readParam(params.invitationId), [params.invitationId]);
  const token = useMemo(() => readParam(params.token), [params.token]);

  const [status, setStatus] = useState<'idle' | 'accepting' | 'accepted' | 'already_member' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !invitationId || !token) {
      return;
    }

    setStatus('accepting');
    setErrorMessage(null);

    void (async () => {
      try {
        await acceptInvite({ invitationId, token });
        await refreshFleets();
        setStatus('accepted');
      } catch (error) {
        if (error instanceof SharedFleetError && error.code === 'shared_already_member') {
          await refreshFleets();
          setStatus('already_member');
          return;
        }

        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Could not accept invitation.');
      }
    })();
  }, [invitationId, isAuthenticated, refreshFleets, token]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <SectionHeader
            title="Accept Fleet Invitation"
            description="Validate your invitation and join the shared fleet workspace."
          />

          {!invitationId || !token ? (
            <Card className="gap-2" tone="warning">
              <AppText variant="caption" color="warning">
                Invitation link is missing token or invitation id.
              </AppText>
            </Card>
          ) : !isAuthenticated ? (
            <Card className="gap-3">
              <AppText variant="caption" color="secondary">
                Sign in or create an account with the invited email address to accept this invitation.
              </AppText>

              <View style={styles.row}>
                <Button
                  label="Sign In"
                  variant="secondary"
                  onPress={() => {
                    const signInHref =
                      `/shared/auth/sign-in?invitationId=${encodeURIComponent(invitationId)}&token=${encodeURIComponent(token)}` as Href;
                    router.push(signInHref);
                  }}
                />
                <Button
                  label="Create Account"
                  variant="ghost"
                  onPress={() => {
                    const signUpHref =
                      `/shared/auth/sign-up?invitationId=${encodeURIComponent(invitationId)}&token=${encodeURIComponent(token)}` as Href;
                    router.push(signUpHref);
                  }}
                />
              </View>
            </Card>
          ) : status === 'accepting' || status === 'idle' ? (
            <Card className="gap-2">
              <AppText variant="caption" color="secondary">Accepting invitation...</AppText>
            </Card>
          ) : status === 'accepted' ? (
            <Card className="gap-3" tone="success">
              <AppText variant="caption" color="success">
                Invitation accepted. You now have access to the fleet.
              </AppText>
              <Button
                label="Open Shared Fleet"
                onPress={() => {
                  router.replace('/shared' as Href);
                }}
              />
            </Card>
          ) : status === 'already_member' ? (
            <Card className="gap-3" tone="success">
              <AppText variant="caption" color="success">
                You are already an active member of this fleet.
              </AppText>
              <Button
                label="Open Shared Fleet"
                onPress={() => {
                  router.replace('/shared' as Href);
                }}
              />
            </Card>
          ) : (
            <Card className="gap-2" tone="destructive">
              <AppText variant="caption" color="destructive">
                {errorMessage ?? 'Could not accept invitation.'}
              </AppText>
            </Card>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
