import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Button, EmptyState, FormField, Input, ListRow, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { vehiclesRepo } from '@/data/repositories';
import type { VehicleListItem } from '@/data/types';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

function formatDate(iso: string | null, fallback: string) {
  if (!iso) {
    return fallback;
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }

  return parsed.toISOString().slice(0, 10);
}

export default function VehiclesScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const theme = useTheme();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestRef = useRef(0);

  const loadVehicles = useCallback(async (searchText: string) => {
    const requestId = ++requestRef.current;
    setErrorMessage(null);
    setStatus((previous) => (previous === 'ready' ? 'ready' : 'loading'));

    try {
      const data = await vehiclesRepo.list(searchText);
      if (requestId !== requestRef.current) {
        return;
      }

      setVehicles(data);
      setStatus('ready');
    } catch (error) {
      if (requestId !== requestRef.current) {
        return;
      }

      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : t('vehicles.errorLoadFailedFallback'));
    }
  }, [t]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void loadVehicles(query);
  }, [isFocused, loadVehicles, query]);

  const hasQuery = query.trim().length > 0;

  const listHeader = useMemo(
    () => (
      <View style={styles.headerSection}>
        <SectionHeader title={t('vehicles.title')} description={t('vehicles.description')} />

        <Button label={t('vehicles.addAction')} variant="primary" onPress={() => router.push('/vehicles/new')} className="self-start" />

        <FormField
          label={t('vehicles.searchLabel')}
          hint={t('vehicles.searchResultsHint', { count: vehicles.length })}>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={t('vehicles.searchPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </FormField>
      </View>
    ),
    [query, router, t, vehicles.length],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            status === 'loading' ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={theme.textSecondary} />
                <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">{t('vehicles.loading')}</Text>
              </View>
            ) : status === 'error' ? (
              <EmptyState
                tone="destructive"
                title={t('vehicles.errorLoadTitle')}
                description={errorMessage ?? t('common.unexpectedError')}
                actionLabel={t('common.retry')}
                onAction={() => void loadVehicles(query)}
              />
            ) : (
              <EmptyState
                title={hasQuery ? t('vehicles.emptySearchTitle') : t('vehicles.emptyTitle')}
                description={
                  hasQuery ? t('vehicles.emptySearchDescription') : t('vehicles.emptyDescription')
                }
              />
            )
          }
          renderItem={({ item: vehicle }) => (
            <ListRow
              title={vehicle.name}
              subtitle={
                vehicle.make || vehicle.model
                  ? t('vehicles.listSubtitleWithSpecs', {
                      specs: [vehicle.make, vehicle.model].filter(Boolean).join(' '),
                      plate: vehicle.plate,
                      tripCount: vehicle.tripCount,
                      fuelCount: vehicle.fuelCount,
                    })
                  : t('vehicles.listSubtitle', {
                      plate: vehicle.plate,
                      tripCount: vehicle.tripCount,
                      fuelCount: vehicle.fuelCount,
                    })
              }
              meta={formatDate(vehicle.lastActivityAt, t('vehicles.noActivityYet'))}
              onPress={() =>
                router.push({
                  pathname: '/vehicles/[vehicleId]',
                  params: { vehicleId: vehicle.id, name: vehicle.name, plate: vehicle.plate },
                })
              }
              className="mt-2"
            />
          )}
        />
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
    gap: Spacing.two,
  },
  headerSection: {
    gap: Spacing.three,
  },
  loadingWrap: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});


