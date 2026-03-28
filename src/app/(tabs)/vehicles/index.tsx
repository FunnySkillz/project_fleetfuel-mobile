import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Vehicles
          </ThemedText>
          <ThemedText themeColor="textSecondary">Choose a vehicle to manage trips and fuel logs.</ThemedText>
        </View>

        <Pressable onPress={() => router.push('/vehicles/new')} style={styles.primaryButton}>
          <ThemedView type="backgroundElement" style={styles.primarySurface}>
            <ThemedText type="smallBold">Add Vehicle</ThemedText>
          </ThemedView>
        </Pressable>

        <View style={styles.searchSection}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, plate, make, model, or VIN"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={[
              styles.searchInput,
              {
                color: theme.text,
                borderColor: theme.backgroundElement,
                backgroundColor: theme.background,
              },
            ]}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {vehicles.length} result{vehicles.length === 1 ? '' : 's'}
          </ThemedText>
        </View>
      </View>
    ),
    [query, router, theme.background, theme.backgroundElement, theme.text, theme.textSecondary, vehicles.length],
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
              <ThemedView type="backgroundElement" style={styles.emptyState}>
                <ActivityIndicator color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">
                  Loading vehicles...
                </ThemedText>
              </ThemedView>
            ) : status === 'error' ? (
              <ThemedView type="backgroundElement" style={styles.emptyState}>
                <ThemedText type="smallBold">Could not load vehicles</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {errorMessage ?? 'Unexpected error.'}
                </ThemedText>
                <Pressable onPress={() => void loadVehicles(query)}>
                  <ThemedText type="link">Retry</ThemedText>
                </Pressable>
              </ThemedView>
            ) : (
              <ThemedView type="backgroundElement" style={styles.emptyState}>
                <ThemedText type="smallBold">{hasQuery ? 'No vehicles found' : 'No vehicles yet'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {hasQuery ? 'Try a broader search term.' : 'Create your first vehicle to begin logging trips and fuel.'}
                </ThemedText>
              </ThemedView>
            )
          }
          renderItem={({ item: vehicle }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/vehicles/[vehicleId]',
                  params: { vehicleId: vehicle.id, name: vehicle.name, plate: vehicle.plate },
                })
              }>
              <ThemedView type="backgroundElement" style={styles.row}>
                <View style={styles.rowLeft}>
                  <ThemedText type="smallBold">{vehicle.name}</ThemedText>
                  {vehicle.make || vehicle.model ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {[vehicle.make, vehicle.model].filter(Boolean).join(' ')}
                    </ThemedText>
                  ) : null}
                  <ThemedText type="small" themeColor="textSecondary">
                    {vehicle.plate}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Trips: {vehicle.tripCount} | Fuel: {vehicle.fuelCount}
                  </ThemedText>
                </View>
                <View style={styles.rowRight}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDate(vehicle.lastActivityAt)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {'>'}
                  </ThemedText>
                </View>
              </ThemedView>
            </Pressable>
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
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 36,
    lineHeight: 42,
  },
  primaryButton: {
    alignSelf: 'flex-start',
  },
  primarySurface: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  searchSection: {
    gap: Spacing.one,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  row: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  rowLeft: {
    flex: 1,
    gap: Spacing.half,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  emptyState: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
});
