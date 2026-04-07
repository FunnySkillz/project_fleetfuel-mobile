import { type Href, Redirect, Stack, useSegments } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { AppText, Button, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAppPreferences } from '@/hooks/use-app-preferences';
import { SharedFleetProvider } from '@/shared-fleet/providers/shared-fleet-provider';
import { useSharedFleet } from '@/shared-fleet/hooks/use-shared-fleet';

function SharedLayoutInner() {
  const segments = useSegments();
  const { setAppMode } = useAppPreferences();
  const { status, errorMessage, isAuthenticated } = useSharedFleet();

  const section = String(segments[1] ?? '');
  const isAuthRoute = section === 'auth';
  const isInviteAcceptRoute = section === 'accept-invite';

  if (status === 'booting') {
    return (
      <ThemedView style={styles.centered}>
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <AppText variant="caption" color="secondary">Bootstrapping Shared Fleet...</AppText>
        </View>
      </ThemedView>
    );
  }

  if (status === 'error') {
    return (
      <ThemedView style={styles.centered}>
        <Card className="gap-2">
          <AppText variant="subtitle">Shared Fleet Setup Error</AppText>
          <AppText variant="caption" color="destructive">
            {errorMessage ?? 'Unable to initialize Shared Fleet mode.'}
          </AppText>
          <Button
            label="Switch Back To Local Mode"
            variant="secondary"
            onPress={() => {
              void setAppMode('local');
            }}
          />
        </Card>
      </ThemedView>
    );
  }

  if (!isAuthenticated && !isAuthRoute && !isInviteAcceptRoute) {
    return <Redirect href={'/shared/auth/sign-in' as Href} />;
  }

  if (isAuthenticated && isAuthRoute) {
    return <Redirect href={'/shared' as Href} />;
  }

  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerBackButtonMenuEnabled: false,
      }}>
      <Stack.Screen name="index" options={{ title: 'Shared Fleet' }} />
      <Stack.Screen name="auth/sign-in" options={{ title: 'Sign In' }} />
      <Stack.Screen name="auth/sign-up" options={{ title: 'Sign Up' }} />
      <Stack.Screen name="members" options={{ title: 'Members' }} />
      <Stack.Screen name="invitations" options={{ title: 'Invitations' }} />
      <Stack.Screen name="vehicles/index" options={{ title: 'Vehicles' }} />
      <Stack.Screen name="vehicles/[vehicleId]" options={{ title: 'Vehicle Access' }} />
      <Stack.Screen name="pending-requests" options={{ title: 'Pending Requests' }} />
      <Stack.Screen name="history" options={{ title: 'Assignment History' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="audit-log" options={{ title: 'Audit Log' }} />
      <Stack.Screen name="operations" options={{ title: 'Operations' }} />
      <Stack.Screen name="accept-invite" options={{ title: 'Accept Invitation' }} />
    </Stack>
  );
}

export default function SharedLayout() {
  return (
    <SharedFleetProvider>
      <SharedLayoutInner />
    </SharedFleetProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
