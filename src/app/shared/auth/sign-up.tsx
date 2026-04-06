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

export default function SharedSignUpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { signUp, authBusy } = useSharedFleet();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const invitationId = useMemo(() => readParam(params.invitationId), [params.invitationId]);
  const token = useMemo(() => readParam(params.token), [params.token]);

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    try {
      await signUp({ email, password });

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

      setErrorMessage(error instanceof Error ? error.message : 'Could not sign up.');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SectionHeader
            title="Create Shared Fleet Account"
            description="Create your account to join invited fleets or create your own fleet workspace."
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
                placeholder="At least 8 characters"
              />
            </FormField>

            <FormField label="Confirm Password" required>
              <Input
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Repeat password"
              />
            </FormField>

            {errorMessage ? (
              <AppText variant="caption" color="destructive">
                {errorMessage}
              </AppText>
            ) : null}

            <Button
              label="Create Account"
              loading={authBusy}
              loadingLabel="Creating Account..."
              onPress={() => {
                void handleSubmit();
              }}
            />

            <Button
              label="Already have an account? Sign in."
              variant="ghost"
              onPress={() => {
                const signInHref =
                  invitationId && token
                    ? (`/shared/auth/sign-in?invitationId=${encodeURIComponent(invitationId)}&token=${encodeURIComponent(token)}` as Href)
                    : ('/shared/auth/sign-in' as Href);
                router.push(signInHref);
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
