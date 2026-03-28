import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Card, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { entriesRepo, vehiclesRepo } from '@/data/repositories';

type DashboardMetricProps = {
  label: string;
  value: string;
  helper?: string;
};

function DashboardMetric({ label, value, helper }: DashboardMetricProps) {
  return (
    <Card className="gap-1">
      <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">{label}</Text>
      <Text className="text-2xl font-semibold text-text dark:text-dark-text">{value}</Text>
      {helper ? <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">{helper}</Text> : null}
    </Card>
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
          <SectionHeader
            title="Dashboard"
            description="Local-first overview. Drivers are deferred to post-MVP company platform."
          />

          {loadError ? (
            <Card tone="warning">
              <Text className="text-xs text-warning dark:text-dark-warning">Metrics warning: {loadError}</Text>
            </Card>
          ) : null}

          <View style={styles.grid}>
            <DashboardMetric
              label="Cars tracked"
              value={String(carsTracked)}
              helper={carsTracked === 0 ? 'Start by adding your first vehicle.' : undefined}
            />
            <DashboardMetric label="Drivers under you" value="0" helper="Deferred in MVP." />
            <DashboardMetric label="Trips this month" value={String(tripsThisMonth)} />
            <DashboardMetric label="Fuel entries this month" value={String(fuelThisMonth)} />
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
    gap: Spacing.three,
  },
  grid: {
    gap: Spacing.two,
  },
});

