import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function VehicleDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ vehicleId?: string; name?: string; plate?: string }>();
  const vehicleId = params.vehicleId ?? 'unknown';
  const vehicleName = params.name ?? 'Vehicle';
  const vehiclePlate = params.plate ?? 'N/A';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}>
          <ThemedView type="backgroundElement" style={styles.hero}>
            <ThemedText type="subtitle">{vehicleName}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {vehiclePlate}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Vehicle ID: {vehicleId}
            </ThemedText>
          </ThemedView>

          <View style={styles.actions}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/trips/new',
                  params: { vehicleId },
                })
              }>
              <ThemedView type="backgroundElement" style={styles.actionCard}>
                <ThemedText type="smallBold">Add Trip</ThemedText>
              </ThemedView>
            </Pressable>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/fuel/new',
                  params: { vehicleId },
                })
              }>
              <ThemedView type="backgroundElement" style={styles.actionCard}>
                <ThemedText type="smallBold">Add Fuel Entry</ThemedText>
              </ThemedView>
            </Pressable>
          </View>

          <ThemedView type="backgroundElement" style={styles.infoCard}>
            <ThemedText type="smallBold">Recent Activity</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Unified history is available on Logs tab with filters by vehicle and entry type.
            </ThemedText>
            <Pressable onPress={() => router.push('/logs')} style={styles.linkButton}>
              <ThemedText type="link">Open Logs</ThemedText>
            </Pressable>
          </ThemedView>
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
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  hero: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  actions: {
    gap: Spacing.two,
  },
  actionCard: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  infoCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  linkButton: {
    paddingVertical: Spacing.one,
    alignSelf: 'flex-start',
  },
});
