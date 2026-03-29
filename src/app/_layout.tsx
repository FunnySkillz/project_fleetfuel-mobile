import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import React from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useI18n } from '@/hooks/use-i18n';
import { AppPreferencesProvider } from '@/providers/app-preferences-provider';
import { useAppPreferences } from '@/hooks/use-app-preferences';

export default function RootLayout() {
  return (
    <AppPreferencesProvider>
      <RootNavigator />
    </AppPreferencesProvider>
  );
}

function RootNavigator() {
  const { resolvedTheme } = useAppPreferences();
  const { t } = useI18n();

  return (
    <ThemeProvider value={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="vehicles/new" options={{ title: t('root.addVehicle') }} />
        <Stack.Screen name="vehicles/[vehicleId]" options={{ title: t('root.vehicleDetail') }} />
        <Stack.Screen name="trips/new" options={{ title: t('root.addTrip') }} />
        <Stack.Screen name="fuel/new" options={{ title: t('root.addFuelEntry') }} />
        <Stack.Screen name="entries/[entryId]" options={{ title: t('root.entryDetail') }} />
        <Stack.Screen name="entries/[entryId]/edit" options={{ title: t('root.editEntry') }} />
        <Stack.Screen name="logs/export" options={{ title: t('root.exportLogs') }} />
        <Stack.Screen name="settings/appearance" options={{ title: t('root.appearance') }} />
      </Stack>
    </ThemeProvider>
  );
}
