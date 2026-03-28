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
import { useTheme } from '@/hooks/use-theme';

function formatDate(iso: string | null) {
  if (!iso) {
    return 'No activity yet';
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
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load vehicles.');
    }
  }, []);

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
        <SectionHeader title="Vehicles" description="Choose a vehicle to manage trips and fuel logs." />

        <Button label="Add Vehicle" variant="primary" onPress={() => router.push('/vehicles/new')} className="self-start" />

        <FormField label="Search Vehicles" hint={`${vehicles.length} result${vehicles.length === 1 ? '' : 's'}`}>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, plate, make, model, or VIN"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </FormField>
      </View>
    ),
    [query, router, vehicles.length],
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
                <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">Loading vehicles...</Text>
              </View>
            ) : status === 'error' ? (
              <EmptyState
                tone="destructive"
                title="Could not load vehicles"
                description={errorMessage ?? 'Unexpected error.'}
                actionLabel="Retry"
                onAction={() => void loadVehicles(query)}
              />
            ) : (
              <EmptyState
                title={hasQuery ? 'No vehicles found' : 'No vehicles yet'}
                description={
                  hasQuery ? 'Try a broader search term.' : 'Create your first vehicle to begin logging trips and fuel.'
                }
              />
            )
          }
          renderItem={({ item: vehicle }) => (
            <ListRow
              title={vehicle.name}
              subtitle={
                vehicle.make || vehicle.model
                  ? `${[vehicle.make, vehicle.model].filter(Boolean).join(' ')} | ${vehicle.plate} | Trips: ${vehicle.tripCount} | Fuel: ${vehicle.fuelCount}`
                  : `${vehicle.plate} | Trips: ${vehicle.tripCount} | Fuel: ${vehicle.fuelCount}`
              }
              meta={formatDate(vehicle.lastActivityAt)}
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


