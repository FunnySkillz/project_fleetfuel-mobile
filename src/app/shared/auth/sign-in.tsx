import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { AppText, Button, Card, FormField, Input, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { SharedFleetError } from '@/shared-fleet/errors';
import { useSharedFleet } from '@/shared-fleet/hooks/use-shared-fleet';

function readParam(param: string | string[] | undefined) {
  if (!param) {
    return null;
  }

  return Array.isArray(param) ? param[0] : param;
}

export default function SharedSignInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { signIn, authBusy } = useSharedFleet();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const invitationId = useMemo(() => readParam(params.invitationId), [params.invitationId]);
  const token = useMemo(() => readParam(params.token), [params.token]);

  const handleSubmit = async () => {
    setErrorMessage(null);

    try {
      await signIn({ email, password });

      if (invitationId && token) {
        const inviteHref =
          `/shared/accept-invite?invitationId=${encodeURIComponent(invitationId)}&token=${encodeURIComponent(token)}` as Href;
        router.replace(inviteHref);
        return;
      }

      router.replace('/shared' as Href);
    } catch (error) {
      if (error instanceof SharedFleetError) {
        setErrorMessage(error.message);
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : 'Could not sign in.');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SectionHeader
            title="Shared Fleet Sign In"
            description="Sign in to access company fleets, invitations, and shared driver workflows."
          />

          <Card className="gap-3">
            <FormField label="Email" required>
              <Input
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@company.com"
              />
            </FormField>

            <FormField label="Password" required>
              <Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Your password"
              />
            </FormField>

            {errorMessage ? (
              <AppText variant="caption" color="destructive">
                {errorMessage}
              </AppText>
            ) : null}

            <Button
              label="Sign In"
              loading={authBusy}
              loadingLabel="Signing In..."
              onPress={() => {
                void handleSubmit();
              }}
            />

            <Button
              label="Need an account? Create one now."
              variant="ghost"
              onPress={() => {
                const signUpHref =
                  invitationId && token
                    ? (`/shared/auth/sign-up?invitationId=${encodeURIComponent(invitationId)}&token=${encodeURIComponent(token)}` as Href)
                    : ('/shared/auth/sign-up' as Href);
                router.push(signUpHref);
              }}
            />
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
});
