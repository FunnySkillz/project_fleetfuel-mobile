import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import React from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="vehicles/new" options={{ title: 'Add Vehicle' }} />
        <Stack.Screen name="vehicles/[vehicleId]" options={{ title: 'Vehicle Detail' }} />
        <Stack.Screen name="trips/new" options={{ title: 'Add Trip' }} />
        <Stack.Screen name="fuel/new" options={{ title: 'Add Fuel Entry' }} />
        <Stack.Screen name="entries/[entryId]" options={{ title: 'Entry Detail' }} />
        <Stack.Screen name="entries/[entryId]/edit" options={{ title: 'Edit Entry' }} />
        <Stack.Screen name="logs/export" options={{ title: 'Export Logs' }} />
      </Stack>
    </ThemeProvider>
  );
}
