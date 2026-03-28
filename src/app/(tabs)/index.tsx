import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { entriesRepo, vehiclesRepo } from '@/data/repositories';

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
  const isFocused = useIsFocused();
  const [carsTracked, setCarsTracked] = useState(0);
  const [tripsThisMonth, setTripsThisMonth] = useState(0);
  const [fuelThisMonth, setFuelThisMonth] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    let cancelled = false;
    setLoadError(null);

    void Promise.all([vehiclesRepo.countActive(), entriesRepo.countMonthly()])
      .then(([vehicleCount, monthlyCounts]) => {
        if (cancelled) {
          return;
        }

        setCarsTracked(vehicleCount);
        setTripsThisMonth(monthlyCounts.trips);
        setFuelThisMonth(monthlyCounts.fuelEntries);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : 'Failed to load dashboard metrics.');
      });

    return () => {
      cancelled = true;
    };
  }, [isFocused]);

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
            {loadError ? (
              <ThemedText type="small" themeColor="textSecondary">
                Metrics warning: {loadError}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.grid}>
            <DashboardCard
              label="Cars tracked"
              value={String(carsTracked)}
              helper={carsTracked === 0 ? 'Start by adding your first vehicle.' : undefined}
            />
            <DashboardCard label="Drivers under you" value="0" helper="Deferred in MVP." />
            <DashboardCard label="Trips this month" value={String(tripsThisMonth)} />
            <DashboardCard label="Fuel entries this month" value={String(fuelThisMonth)} />
          </View>
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
});
