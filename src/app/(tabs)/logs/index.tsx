import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { logsRepo, vehiclesRepo } from '@/data/repositories';
import type { EntrySummary, EntryType, VehicleListItem } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

type FilterChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

type VehicleFilterOption = {
  id: string;
  label: string;
};

function FilterChip({ label, active, onPress }: FilterChipProps) {
  return (
    <Pressable onPress={onPress}>
      <ThemedView type={active ? 'backgroundSelected' : 'backgroundElement'} style={styles.filterChip}>
        <ThemedText type="small">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function formatDate(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }

  return parsed.toISOString().slice(0, 10);
}

export default function LogsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const theme = useTheme();
  const [typeFilter, setTypeFilter] = useState<'all' | EntryType>('all');
  const [vehicleFilter, setVehicleFilter] = useState<'all' | string>('all');
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const logsRequestRef = useRef(0);
  const vehiclesRequestRef = useRef(0);

  const loadVehicleFilters = useCallback(async () => {
    const requestId = ++vehiclesRequestRef.current;
    try {
      const data = await vehiclesRepo.list();
      if (requestId !== vehiclesRequestRef.current) {
        return;
      }

      setVehicles(data);
    } catch {
      if (requestId !== vehiclesRequestRef.current) {
        return;
      }

      setVehicles([]);
    }
  }, []);

  const loadEntries = useCallback(async () => {
    const requestId = ++logsRequestRef.current;
    setErrorMessage(null);
    setStatus((previous) => (previous === 'ready' ? 'ready' : 'loading'));

    try {
      const data = await logsRepo.list({
        type: typeFilter,
        vehicleId: vehicleFilter === 'all' ? null : vehicleFilter,
        search: query,
      });

      if (requestId !== logsRequestRef.current) {
        return;
      }

      setEntries(data);
      setStatus('ready');
    } catch (error) {
      if (requestId !== logsRequestRef.current) {
        return;
      }

      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load logs.');
    }
  }, [query, typeFilter, vehicleFilter]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void loadVehicleFilters();
    void loadEntries();
  }, [isFocused, loadEntries, loadVehicleFilters]);

  useEffect(() => {
    if (vehicleFilter === 'all') {
      return;
    }

    const stillExists = vehicles.some((vehicle) => vehicle.id === vehicleFilter);
    if (!stillExists) {
      setVehicleFilter('all');
    }
  }, [vehicleFilter, vehicles]);

  const vehicleOptions = useMemo<VehicleFilterOption[]>(() => {
    return [{ id: 'all', label: 'All vehicles' }, ...vehicles.map((vehicle) => ({ id: vehicle.id, label: vehicle.name }))];
  }, [vehicles]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <View style={styles.header}>
                <ThemedText type="title" style={styles.title}>
                  Logs
                </ThemedText>
                <ThemedText themeColor="textSecondary">Unified timeline for trip and fuel entries.</ThemedText>
              </View>

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/logs/export',
                    params: {
                      type: typeFilter,
                      vehicleId: vehicleFilter === 'all' ? '' : vehicleFilter,
                      search: query,
                    },
                  })
                }
                style={styles.exportButton}>
                <ThemedView type="backgroundElement" style={styles.exportSurface}>
                  <ThemedText type="smallBold">Export Logs</ThemedText>
                </ThemedView>
              </Pressable>

              <View style={styles.searchSection}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search by summary, vehicle, or date"
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
              </View>

              <View style={styles.filterSection}>
                <ThemedText type="smallBold">Type</ThemedText>
                <View style={styles.filterRow}>
                  <FilterChip label="All" active={typeFilter === 'all'} onPress={() => setTypeFilter('all')} />
                  <FilterChip label="Trips" active={typeFilter === 'trip'} onPress={() => setTypeFilter('trip')} />
                  <FilterChip label="Fuel" active={typeFilter === 'fuel'} onPress={() => setTypeFilter('fuel')} />
                </View>

                <ThemedText type="smallBold">Vehicle</ThemedText>
                <View style={styles.filterRow}>
                  {vehicleOptions.map((vehicle) => (
                    <FilterChip
                      key={vehicle.id}
                      label={vehicle.label}
                      active={vehicleFilter === vehicle.id}
                      onPress={() => setVehicleFilter(vehicle.id)}
                    />
                  ))}
                </View>

                <ThemedText type="small" themeColor="textSecondary">
                  {entries.length} result{entries.length === 1 ? '' : 's'}
                </ThemedText>
              </View>
            </View>
          }
          ListEmptyComponent={
            status === 'loading' ? (
              <ThemedView type="backgroundElement" style={styles.emptyState}>
                <ActivityIndicator color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">
                  Loading timeline...
                </ThemedText>
              </ThemedView>
            ) : status === 'error' ? (
              <ThemedView type="backgroundElement" style={styles.emptyState}>
                <ThemedText type="smallBold">Could not load logs</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {errorMessage ?? 'Unexpected error.'}
                </ThemedText>
                <Pressable onPress={() => void loadEntries()}>
                  <ThemedText type="link">Retry</ThemedText>
                </Pressable>
              </ThemedView>
            ) : (
              <ThemedView type="backgroundElement" style={styles.emptyState}>
                <ThemedText type="smallBold">No matching entries</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Try a broader filter or add a new trip/fuel entry.
                </ThemedText>
              </ThemedView>
            )
          }
          renderItem={({ item: entry }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/entries/[entryId]',
                  params: {
                    entryId: entry.id,
                    type: entry.type,
                  },
                })
              }>
              <ThemedView type="backgroundElement" style={styles.row}>
                <View style={styles.rowLeft}>
                  <ThemedText type="smallBold">{entry.type === 'trip' ? 'Trip' : 'Fuel'}</ThemedText>
                  <ThemedText type="small">{entry.vehicleName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {entry.summary}
                  </ThemedText>
                </View>
                <View style={styles.rowRight}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDate(entry.date)}
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
  exportButton: {
    alignSelf: 'flex-start',
  },
  exportSurface: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
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
  filterSection: {
    gap: Spacing.two,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    flexWrap: 'wrap',
  },
  filterChip: {
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
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
