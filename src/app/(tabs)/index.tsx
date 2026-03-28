import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type DashboardCardProps = {
  label: string;
  value: string;
  helper?: string;
};

function DashboardCard({ label, value, helper }: DashboardCardProps) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="subtitle">{value}</ThemedText>
      {helper ? (
        <ThemedText type="small" themeColor="textSecondary">
          {helper}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

export default function DashboardScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Dashboard
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Local-first overview. Drivers are deferred to post-MVP company platform.
            </ThemedText>
          </View>

          <View style={styles.grid}>
            <DashboardCard label="Cars tracked" value="0" helper="Start by adding your first vehicle." />
            <DashboardCard label="Drivers under you" value="0" helper="Deferred in MVP." />
            <DashboardCard label="Trips this month" value="0" />
            <DashboardCard label="Fuel entries this month" value="0" />
          </View>

          <ThemedView type="backgroundElement" style={styles.quickActions}>
            <ThemedText type="smallBold">Quick Navigation</ThemedText>
            <Pressable onPress={() => router.push('/vehicles')} style={styles.actionButton}>
              <ThemedText type="link">Open Vehicles</ThemedText>
            </Pressable>
            <Pressable onPress={() => router.push('/logs')} style={styles.actionButton}>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 36,
    lineHeight: 42,
  },
  grid: {
    gap: Spacing.three,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  quickActions: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  actionButton: {
    paddingVertical: Spacing.one,
  },
});
