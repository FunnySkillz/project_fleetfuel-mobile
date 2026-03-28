import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type LogType = 'trip' | 'fuel';

type LogEntry = {
  id: string;
  type: LogType;
  vehicleId: string;
  vehicleName: string;
  date: string;
  summary: string;
};

const LOG_ENTRIES: LogEntry[] = [
  {
    id: 'trip-1001',
    type: 'trip',
    vehicleId: 'car-01',
    vehicleName: 'VW Golf',
    date: '2026-03-27',
    summary: 'Client meeting, 42 km',
  },
  {
    id: 'fuel-2201',
    type: 'fuel',
    vehicleId: 'car-01',
    vehicleName: 'VW Golf',
    date: '2026-03-26',
    summary: '42.4 L, EUR 72.10',
  },
  {
    id: 'trip-1002',
    type: 'trip',
    vehicleId: 'car-02',
    vehicleName: 'Ford Transit',
    date: '2026-03-25',
    summary: 'Supplier pickup, 71 km',
  },
];

type FilterChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
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

export default function LogsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [typeFilter, setTypeFilter] = useState<'all' | LogType>('all');
  const [vehicleFilter, setVehicleFilter] = useState<'all' | string>('all');
  const [query, setQuery] = useState('');

  const vehicleOptions = useMemo(() => {
    const map = new Map<string, string>();
    LOG_ENTRIES.forEach((entry) => map.set(entry.vehicleId, entry.vehicleName));
    return [{ id: 'all', label: 'All vehicles' }, ...Array.from(map.entries()).map(([id, label]) => ({ id, label }))];
  }, []);

  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...LOG_ENTRIES]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((entry) => {
        const typeMatches = typeFilter === 'all' || entry.type === typeFilter;
        const vehicleMatches = vehicleFilter === 'all' || entry.vehicleId === vehicleFilter;
        const queryMatches =
          needle.length === 0 ||
          entry.summary.toLowerCase().includes(needle) ||
          entry.vehicleName.toLowerCase().includes(needle) ||
          entry.date.includes(needle);

        return typeMatches && vehicleMatches && queryMatches;
      });
  }, [query, typeFilter, vehicleFilter]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={filteredEntries}
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

              <Pressable onPress={() => router.push('/logs/export')} style={styles.exportButton}>
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
                  {filteredEntries.length} result{filteredEntries.length === 1 ? '' : 's'}
                </ThemedText>
              </View>
            </View>
          }
          ListEmptyComponent={
            <ThemedView type="backgroundElement" style={styles.emptyState}>
              <ThemedText type="smallBold">No matching entries</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Try a broader filter or add a new trip/fuel entry.
              </ThemedText>
            </ThemedView>
          }
          renderItem={({ item: entry }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/entries/[entryId]',
                  params: {
                    entryId: entry.id,
                    type: entry.type,
                    vehicleName: entry.vehicleName,
                    summary: entry.summary,
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
                    {entry.date}
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
