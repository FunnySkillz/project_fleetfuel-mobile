import { useIsFocused } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { AppText, Card, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { entriesRepo, vehiclesRepo } from '@/data/repositories';
import { useI18n } from '@/hooks/use-i18n';

type DashboardMetricProps = {
  label: string;
  value: string;
  helper?: string;
};

function DashboardMetric({ label, value, helper }: DashboardMetricProps) {
  return (
    <Card className="gap-1">
      <AppText variant="caption" color="secondary">{label}</AppText>
      <AppText variant="title" className="text-2xl">{value}</AppText>
      {helper ? <AppText variant="caption" color="secondary">{helper}</AppText> : null}
    </Card>
  );
}

export default function DashboardScreen() {
  const isFocused = useIsFocused();
  const { t } = useI18n();
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
            title={t('dashboard.title')}
            description={t('dashboard.description')}
          />

          {loadError ? (
            <Card tone="warning">
              <AppText variant="caption" color="warning">
                {t('dashboard.metricsWarning', { error: loadError })}
              </AppText>
            </Card>
          ) : null}

          <View style={styles.grid}>
            <DashboardMetric
              label={t('dashboard.carsTracked')}
              value={String(carsTracked)}
              helper={carsTracked === 0 ? t('dashboard.carsTrackedHelper') : undefined}
            />
            <DashboardMetric label={t('dashboard.driversUnderYou')} value="0" helper={t('dashboard.driversDeferred')} />
            <DashboardMetric label={t('dashboard.tripsThisMonth')} value={String(tripsThisMonth)} />
            <DashboardMetric label={t('dashboard.fuelEntriesThisMonth')} value={String(fuelThisMonth)} />
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

