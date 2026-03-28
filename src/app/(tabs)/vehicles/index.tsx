import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const VEHICLES = [
  { id: 'car-01', name: 'VW Golf', plate: 'W-123AB', mileage: '84,200 km' },
  { id: 'car-02', name: 'Ford Transit', plate: 'W-987CD', mileage: '152,910 km' },
];

export default function VehiclesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const filteredVehicles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...VEHICLES]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((vehicle) => {
        if (!needle) return true;
        return (
          vehicle.name.toLowerCase().includes(needle) ||
          vehicle.plate.toLowerCase().includes(needle) ||
          vehicle.mileage.toLowerCase().includes(needle)
        );
      });
  }, [query]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={filteredVehicles}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          ListHeaderComponent={
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
                  placeholder="Search by name, plate, or mileage"
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
                  {filteredVehicles.length} result{filteredVehicles.length === 1 ? '' : 's'}
                </ThemedText>
              </View>
            </View>
          }
          ListEmptyComponent={
            <ThemedView type="backgroundElement" style={styles.emptyState}>
              <ThemedText type="smallBold">No vehicles found</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Try a broader search or create a new vehicle.
              </ThemedText>
            </ThemedView>
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
                  <ThemedText type="small" themeColor="textSecondary">
                    {vehicle.plate}
                  </ThemedText>
                </View>
                <View style={styles.rowRight}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {vehicle.mileage}
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
