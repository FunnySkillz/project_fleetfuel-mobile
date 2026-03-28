import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { fuelRepo, vehiclesRepo } from '@/data/repositories';
import type { VehicleListItem } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { parseDecimalValue, sanitizeDecimalInput, trimmedLength } from '@/utils/form-input';

const LITERS_INTEGER_DIGITS = 3;
const LITERS_FRACTION_DIGITS = 2;
const LITERS_MAX = 500;
const PRICE_INTEGER_DIGITS = 6;
const PRICE_FRACTION_DIGITS = 2;
const PRICE_MAX = 500000;
const STATION_MIN = 2;
const STATION_MAX = 80;
const NOTES_MAX = 500;

type FuelFormErrors = {
  vehicleId?: string;
  liters?: string;
  price?: string;
  station?: string;
  notes?: string;
};

export default function AddFuelEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ vehicleId?: string }>();

  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState((params.vehicleId ?? '').trim());
  const [liters, setLiters] = useState('');
  const [price, setPrice] = useState('');
  const [station, setStation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({ vehicleId: false, liters: false, price: false, station: false, notes: false });

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    let cancelled = false;
    setVehiclesLoading(true);

    void vehiclesRepo
      .list()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setVehicles(data);
        setSelectedVehicleId((current) => {
          if (current.length > 0) {
            return current;
          }
          if (data.length === 1) {
            return data[0].id;
          }
          return current;
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setVehicles([]);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setVehiclesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isFocused]);

  useEffect(() => {
    if (!selectedVehicleId) {
      return;
    }

    const exists = vehicles.some((vehicle) => vehicle.id === selectedVehicleId);
    if (!exists) {
      setSelectedVehicleId('');
    }
  }, [selectedVehicleId, vehicles]);

  const isDirty = useMemo(
    () =>
      liters.trim().length > 0 ||
      price.trim().length > 0 ||
      station.trim().length > 0 ||
      notes.trim().length > 0 ||
      saving,
    [liters, notes, price, saving, station],
  );
  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty);

  const errors = useMemo<FuelFormErrors>(() => {
    const result: FuelFormErrors = {};
    const litersValue = parseDecimalValue(liters);
    const priceValue = parseDecimalValue(price);
    const stationLength = trimmedLength(station);
    const notesLength = trimmedLength(notes);

    if (!selectedVehicleId) {
      result.vehicleId = 'Vehicle is required.';
    }

    if (liters.trim().length === 0) {
      result.liters = 'Liters is required.';
    } else if (litersValue === null) {
      result.liters = 'Liters must be a valid number.';
    } else if (litersValue <= 0) {
      result.liters = 'Liters must be greater than 0.';
    } else if (litersValue > LITERS_MAX) {
      result.liters = `Liters must be less than or equal to ${LITERS_MAX}.`;
    }

    if (price.trim().length === 0) {
      result.price = 'Total price is required.';
    } else if (priceValue === null) {
      result.price = 'Total price must be a valid number.';
    } else if (priceValue <= 0) {
      result.price = 'Total price must be greater than 0.';
    } else if (priceValue > PRICE_MAX) {
      result.price = `Total price must be less than or equal to ${PRICE_MAX}.`;
    }

    if (stationLength === 0) {
      result.station = 'Station/vendor is required.';
    } else if (stationLength < STATION_MIN) {
      result.station = `Station/vendor must be at least ${STATION_MIN} characters.`;
    } else if (stationLength > STATION_MAX) {
      result.station = `Station/vendor must be at most ${STATION_MAX} characters.`;
    }

    if (notesLength > NOTES_MAX) {
      result.notes = `Notes must be at most ${NOTES_MAX} characters.`;
    }

    return result;
  }, [liters, notes, price, selectedVehicleId, station]);

  const isValid = !errors.vehicleId && !errors.liters && !errors.price && !errors.station && !errors.notes;
  const canSubmit = !saving && isValid;
  const showVehicleError = (submitAttempted || touched.vehicleId) && Boolean(errors.vehicleId);
  const showLitersError = (submitAttempted || touched.liters) && Boolean(errors.liters);
  const showPriceError = (submitAttempted || touched.price) && Boolean(errors.price);
  const showStationError = (submitAttempted || touched.station) && Boolean(errors.station);
  const showNotesError = (submitAttempted || touched.notes) && Boolean(errors.notes);

  const handleSave = async () => {
    if (saving) {
      return;
    }

    setSubmitAttempted(true);
    setTouched({ vehicleId: true, liters: true, price: true, station: true, notes: true });

    if (!isValid) {
      Alert.alert('Check form', 'Please fix validation errors before saving.');
      return;
    }

    const litersValue = parseDecimalValue(liters);
    const priceValue = parseDecimalValue(price);
    const normalizedStation = station.trim().replace(/\s+/g, ' ');
    const normalizedNotes = notes.trim().replace(/\s+/g, ' ');

    if (litersValue === null || priceValue === null) {
      Alert.alert('Check form', 'Liters and total price must be valid numbers.');
      return;
    }

    setSaving(true);
    try {
      await fuelRepo.create({
        vehicleId: selectedVehicleId,
        liters: litersValue,
        totalPrice: priceValue,
        station: normalizedStation,
        notes: normalizedNotes.length > 0 ? normalizedNotes : null,
      });

      setLiters('');
      setPrice('');
      setStation('');
      setNotes('');
      setTouched({ vehicleId: false, liters: false, price: false, station: false, notes: false });
      setSubmitAttempted(false);
      allowNextNavigation();
      router.back();
    } catch (error) {
      Alert.alert('Could not save fuel entry', error instanceof Error ? error.message : 'Unexpected error.');
    } finally {
      setSaving(false);
    }
  };

  const hasVehicles = vehicles.length > 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}>
          <ThemedText type="smallBold">Vehicle</ThemedText>
          {vehiclesLoading ? (
            <ThemedText type="small" themeColor="textSecondary">
              Loading vehicles...
            </ThemedText>
          ) : hasVehicles ? (
            <View style={styles.vehicleSelector}>
              {vehicles.map((vehicle) => {
                const active = selectedVehicleId === vehicle.id;
                return (
                  <Pressable
                    key={vehicle.id}
                    onPress={() => {
                      setSelectedVehicleId(vehicle.id);
                      setTouched((prev) => ({ ...prev, vehicleId: true }));
                    }}>
                    <ThemedView type={active ? 'backgroundSelected' : 'backgroundElement'} style={styles.vehicleChip}>
                      <ThemedText type="smallBold">{vehicle.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {vehicle.plate}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <ThemedView type="backgroundElement" style={styles.noVehicleCard}>
              <ThemedText type="smallBold">No vehicle available</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Add a vehicle first, then create fuel entries.
              </ThemedText>
              <Pressable onPress={() => router.push('/vehicles/new')}>
                <ThemedText type="link">Add Vehicle</ThemedText>
              </Pressable>
            </ThemedView>
          )}
          {showVehicleError ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.vehicleId}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">Liters</ThemedText>
          <TextInput
            value={liters}
            onChangeText={(value) =>
              setLiters(sanitizeDecimalInput(value, LITERS_INTEGER_DIGITS, LITERS_FRACTION_DIGITS))
            }
            onBlur={() => setTouched((prev) => ({ ...prev, liters: true }))}
            keyboardType="decimal-pad"
            placeholder="42.4"
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showLitersError && { borderColor: theme.destructive },
            ]}
          />
          {showLitersError ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.liters}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">Total Price</ThemedText>
          <TextInput
            value={price}
            onChangeText={(value) =>
              setPrice(sanitizeDecimalInput(value, PRICE_INTEGER_DIGITS, PRICE_FRACTION_DIGITS))
            }
            onBlur={() => setTouched((prev) => ({ ...prev, price: true }))}
            keyboardType="decimal-pad"
            placeholder="72.10"
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showPriceError && { borderColor: theme.destructive },
            ]}
          />
          {showPriceError ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.price}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">Station / Vendor</ThemedText>
          <TextInput
            value={station}
            onChangeText={(value) => setStation(value.replace(/\n/g, ' ').slice(0, STATION_MAX))}
            onBlur={() => setTouched((prev) => ({ ...prev, station: true }))}
            placeholder="OMV City Center"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={STATION_MAX}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showStationError && { borderColor: theme.destructive },
            ]}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.counterText}>
            {trimmedLength(station)}/{STATION_MAX}
          </ThemedText>
          {showStationError ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.station}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">Notes (optional)</ThemedText>
          <TextInput
            value={notes}
            onChangeText={(value) => setNotes(value.slice(0, NOTES_MAX))}
            onBlur={() => setTouched((prev) => ({ ...prev, notes: true }))}
            placeholder="Receipt reference, route context, etc."
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="sentences"
            multiline
            maxLength={NOTES_MAX}
            style={[
              styles.input,
              styles.multiline,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showNotesError && { borderColor: theme.destructive },
            ]}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.counterText}>
            {trimmedLength(notes)}/{NOTES_MAX}
          </ThemedText>
          {showNotesError ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.notes}
            </ThemedText>
          ) : null}

          <Pressable onPress={() => void handleSave()} disabled={!canSubmit} accessibilityState={{ disabled: !canSubmit }}>
            <ThemedView type="backgroundElement" style={[styles.primaryAction, !canSubmit && styles.primaryActionDisabled]}>
              <ThemedText type="smallBold">{saving ? 'Saving...' : 'Save Fuel Entry'}</ThemedText>
            </ThemedView>
          </Pressable>
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
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  vehicleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  vehicleChip: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    minWidth: 120,
    gap: 2,
  },
  noVehicleCard: {
    borderRadius: Spacing.two,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  counterText: {
    textAlign: 'right',
    marginTop: -4,
  },
  errorText: {},
  primaryAction: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  primaryActionDisabled: {
    opacity: 0.45,
  },
});
