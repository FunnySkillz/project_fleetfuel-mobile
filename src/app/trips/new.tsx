import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { entriesRepo, tripsRepo, vehiclesRepo } from '@/data/repositories';
import type { TripPrivateTag, VehicleListItem } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { parseIntegerValue, sanitizeIntegerInput, trimmedLength } from '@/utils/form-input';

const PURPOSE_MIN = 3;
const PURPOSE_MAX = 100;
const LOCATION_MAX = 120;
const NOTES_MAX = 500;
const ODOMETER_DIGITS = 7;

type TripFormErrors = {
  vehicleId?: string;
  startOdometer?: string;
  endOdometer?: string;
  purpose?: string;
  privateTag?: string;
  startTime?: string;
  endTime?: string;
  startLocation?: string;
  endLocation?: string;
  notes?: string;
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function sanitizeTimeInput(value: string) {
  return value.replace(/[^\d:]/g, '').slice(0, 5);
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

export default function AddTripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ vehicleId?: string }>();

  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState((params.vehicleId ?? '').trim());

  const [latestRecordedKm, setLatestRecordedKm] = useState<number | null>(null);
  const [startOdometer, setStartOdometer] = useState('');
  const [endOdometer, setEndOdometer] = useState('');
  const [purpose, setPurpose] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [privateTag, setPrivateTag] = useState<TripPrivateTag>(null);

  const [saving, setSaving] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({
    vehicleId: false,
    startOdometer: false,
    endOdometer: false,
    purpose: false,
    privateTag: false,
    startTime: false,
    endTime: false,
    startLocation: false,
    endLocation: false,
    notes: false,
  });

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
      setLatestRecordedKm(null);
      setStartOdometer('');
      return;
    }

    let cancelled = false;
    void entriesRepo
      .getLatestOdometerKmForVehicle(selectedVehicleId)
      .then((value) => {
        if (cancelled) {
          return;
        }

        setLatestRecordedKm(value);
        if (value !== null) {
          setStartOdometer(String(value));
        } else {
          setStartOdometer('');
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setLatestRecordedKm(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedVehicleId]);

  useEffect(() => {
    if (!selectedVehicleId) {
      return;
    }

    const exists = vehicles.some((vehicle) => vehicle.id === selectedVehicleId);
    if (!exists) {
      setSelectedVehicleId('');
    }
  }, [selectedVehicleId, vehicles]);

  const startKmValue = parseIntegerValue(startOdometer);
  const endKmValue = parseIntegerValue(endOdometer);
  const distanceKm =
    startKmValue !== null && endKmValue !== null && endKmValue >= startKmValue
      ? endKmValue - startKmValue
      : null;

  const isDirty = useMemo(
    () =>
      endOdometer.trim().length > 0 ||
      purpose.trim().length > 0 ||
      startTime.trim().length > 0 ||
      endTime.trim().length > 0 ||
      startLocation.trim().length > 0 ||
      endLocation.trim().length > 0 ||
      notes.trim().length > 0 ||
      privateTag !== null ||
      saving,
    [endLocation, endOdometer, notes, privateTag, purpose, saving, startLocation, startTime, endTime],
  );
  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty);

  const errors = useMemo<TripFormErrors>(() => {
    const result: TripFormErrors = {};
    const purposeLength = trimmedLength(purpose);
    const notesLength = trimmedLength(notes);
    const startLocationLength = trimmedLength(startLocation);
    const endLocationLength = trimmedLength(endLocation);

    if (!selectedVehicleId) {
      result.vehicleId = 'Vehicle is required.';
    }

    if (startOdometer.trim().length === 0) {
      result.startOdometer = 'Start km is required.';
    } else if (startKmValue === null) {
      result.startOdometer = 'Start km must be a whole number.';
    } else if (latestRecordedKm !== null && startKmValue < latestRecordedKm) {
      result.startOdometer = `Start km cannot be below latest recorded km (${latestRecordedKm}).`;
    }

    if (endOdometer.trim().length === 0) {
      result.endOdometer = 'Current km is required.';
    } else if (endKmValue === null) {
      result.endOdometer = 'Current km must be a whole number.';
    } else if (startKmValue !== null && endKmValue < startKmValue) {
      result.endOdometer = 'Current km cannot be less than start km.';
    } else if (startKmValue !== null && endKmValue === startKmValue) {
      result.endOdometer = 'Current km must be greater than start km.';
    } else if (latestRecordedKm !== null && endKmValue < latestRecordedKm) {
      result.endOdometer = `Current km cannot be below latest recorded km (${latestRecordedKm}).`;
    }

    if (purposeLength === 0) {
      result.purpose = 'Purpose is required.';
    } else if (purposeLength < PURPOSE_MIN) {
      result.purpose = `Purpose must be at least ${PURPOSE_MIN} characters.`;
    } else if (purposeLength > PURPOSE_MAX) {
      result.purpose = `Purpose must be at most ${PURPOSE_MAX} characters.`;
    }

    if (privateTag === null) {
      result.privateTag = 'Trip classification is required (Business or Private).';
    }

    if (startTime.trim().length > 0 && !isValidTime(startTime.trim())) {
      result.startTime = 'Start time must use HH:MM (24h).';
    }

    if (endTime.trim().length > 0 && !isValidTime(endTime.trim())) {
      result.endTime = 'End time must use HH:MM (24h).';
    }

    if (startTime.trim().length > 0 && endTime.trim().length > 0 && isValidTime(startTime.trim()) && isValidTime(endTime.trim())) {
      if (endTime.trim() < startTime.trim()) {
        result.endTime = 'End time must be later than or equal to start time.';
      }
    }

    if (startLocationLength > LOCATION_MAX) {
      result.startLocation = `Start location must be at most ${LOCATION_MAX} characters.`;
    }

    if (endLocationLength > LOCATION_MAX) {
      result.endLocation = `End location must be at most ${LOCATION_MAX} characters.`;
    }

    if (notesLength > NOTES_MAX) {
      result.notes = `Notes must be at most ${NOTES_MAX} characters.`;
    }

    return result;
  }, [
    endKmValue,
    endLocation,
    endOdometer,
    endTime,
    latestRecordedKm,
    notes,
    privateTag,
    purpose,
    selectedVehicleId,
    startKmValue,
    startLocation,
    startOdometer,
    startTime,
  ]);

  const isValid =
    !errors.vehicleId &&
    !errors.startOdometer &&
    !errors.endOdometer &&
    !errors.purpose &&
    !errors.privateTag &&
    !errors.startTime &&
    !errors.endTime &&
    !errors.startLocation &&
    !errors.endLocation &&
    !errors.notes;

  const canSubmit = !saving && isValid;
  const showError = (field: keyof typeof touched) => (submitAttempted || touched[field]) && Boolean(errors[field]);

  const handleSave = async () => {
    if (saving) {
      return;
    }

    setSubmitAttempted(true);
    setTouched({
      vehicleId: true,
      startOdometer: true,
      endOdometer: true,
      purpose: true,
      privateTag: true,
      startTime: true,
      endTime: true,
      startLocation: true,
      endLocation: true,
      notes: true,
    });

    if (!isValid || startKmValue === null || endKmValue === null) {
      Alert.alert('Check form', 'Please fix validation errors before saving.');
      return;
    }

    setSaving(true);
    try {
      await tripsRepo.create({
        vehicleId: selectedVehicleId,
        purpose: normalizeText(purpose),
        startOdometerKm: startKmValue,
        endOdometerKm: endKmValue,
        startTime: normalizeText(startTime) || null,
        endTime: normalizeText(endTime) || null,
        startLocation: normalizeText(startLocation) || null,
        endLocation: normalizeText(endLocation) || null,
        notes: normalizeText(notes) || null,
        privateTag,
      });

      allowNextNavigation();
      router.back();
    } catch (error) {
      Alert.alert('Could not save trip', error instanceof Error ? error.message : 'Unexpected error.');
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
                Add a vehicle first, then create trip entries.
              </ThemedText>
              <Pressable onPress={() => router.push('/vehicles/new')}>
                <ThemedText type="link">Add Vehicle</ThemedText>
              </Pressable>
            </ThemedView>
          )}
          {showError('vehicleId') ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.vehicleId}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">Start Km</ThemedText>
          <TextInput
            value={startOdometer}
            onChangeText={(value) => setStartOdometer(sanitizeIntegerInput(value, ODOMETER_DIGITS))}
            onBlur={() => setTouched((prev) => ({ ...prev, startOdometer: true }))}
            keyboardType="numeric"
            editable={latestRecordedKm === null}
            placeholder={latestRecordedKm !== null ? String(latestRecordedKm) : '84000'}
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              latestRecordedKm !== null && styles.readOnlyInput,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showError('startOdometer') && { borderColor: theme.destructive },
            ]}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {latestRecordedKm !== null
              ? `Suggested from latest record: ${latestRecordedKm} km`
              : 'No previous odometer record found. Enter your start km manually.'}
          </ThemedText>
          {showError('startOdometer') ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.startOdometer}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">Current Km (Tacho)</ThemedText>
          <TextInput
            value={endOdometer}
            onChangeText={(value) => setEndOdometer(sanitizeIntegerInput(value, ODOMETER_DIGITS))}
            onBlur={() => setTouched((prev) => ({ ...prev, endOdometer: true }))}
            keyboardType="numeric"
            placeholder="84210"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showError('endOdometer') && { borderColor: theme.destructive },
            ]}
          />
          {showError('endOdometer') ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.endOdometer}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">Distance (readonly)</ThemedText>
          <ThemedView type="backgroundElement" style={styles.readOnlyCard}>
            <ThemedText type="subtitle">{distanceKm !== null ? `${distanceKm} km` : 'Fill km values'}</ThemedText>
          </ThemedView>

          <ThemedText type="smallBold">Purpose</ThemedText>
          <TextInput
            value={purpose}
            onChangeText={(value) => setPurpose(value.replace(/\n/g, ' ').slice(0, PURPOSE_MAX))}
            onBlur={() => setTouched((prev) => ({ ...prev, purpose: true }))}
            placeholder="Client meeting"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="sentences"
            autoCorrect={false}
            maxLength={PURPOSE_MAX}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showError('purpose') && { borderColor: theme.destructive },
            ]}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.counterText}>
            {trimmedLength(purpose)}/{PURPOSE_MAX}
          </ThemedText>
          {showError('purpose') ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.purpose}
            </ThemedText>
          ) : null}

          <View style={styles.rowTwoCols}>
            <View style={styles.col}>
              <ThemedText type="smallBold">Start Time (optional)</ThemedText>
              <TextInput
                value={startTime}
                onChangeText={(value) => setStartTime(sanitizeTimeInput(value))}
                onBlur={() => setTouched((prev) => ({ ...prev, startTime: true }))}
                placeholder="08:30"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numbers-and-punctuation"
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
                  showError('startTime') && { borderColor: theme.destructive },
                ]}
              />
              {showError('startTime') ? (
                <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
                  {errors.startTime}
                </ThemedText>
              ) : null}
            </View>

            <View style={styles.col}>
              <ThemedText type="smallBold">End Time (optional)</ThemedText>
              <TextInput
                value={endTime}
                onChangeText={(value) => setEndTime(sanitizeTimeInput(value))}
                onBlur={() => setTouched((prev) => ({ ...prev, endTime: true }))}
                placeholder="09:10"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numbers-and-punctuation"
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
                  showError('endTime') && { borderColor: theme.destructive },
                ]}
              />
              {showError('endTime') ? (
                <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
                  {errors.endTime}
                </ThemedText>
              ) : null}
            </View>
          </View>

          <ThemedText type="smallBold">Start Location (optional)</ThemedText>
          <TextInput
            value={startLocation}
            onChangeText={(value) => setStartLocation(value.replace(/\n/g, ' ').slice(0, LOCATION_MAX))}
            onBlur={() => setTouched((prev) => ({ ...prev, startLocation: true }))}
            placeholder="Vienna Office"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={LOCATION_MAX}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showError('startLocation') && { borderColor: theme.destructive },
            ]}
          />
          {showError('startLocation') ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.startLocation}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">End Location (optional)</ThemedText>
          <TextInput
            value={endLocation}
            onChangeText={(value) => setEndLocation(value.replace(/\n/g, ' ').slice(0, LOCATION_MAX))}
            onBlur={() => setTouched((prev) => ({ ...prev, endLocation: true }))}
            placeholder="Client HQ"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={LOCATION_MAX}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showError('endLocation') && { borderColor: theme.destructive },
            ]}
          />
          {showError('endLocation') ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.endLocation}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">Trip Classification</ThemedText>
          <View style={styles.tagRow}>
            <Pressable
              onPress={() => {
                setPrivateTag('business');
                setTouched((prev) => ({ ...prev, privateTag: true }));
              }}>
              <ThemedView
                type={privateTag === 'business' ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.tagChip}>
                <ThemedText type="small">Business</ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              onPress={() => {
                setPrivateTag('private');
                setTouched((prev) => ({ ...prev, privateTag: true }));
              }}>
              <ThemedView
                type={privateTag === 'private' ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.tagChip}>
                <ThemedText type="small">Private</ThemedText>
              </ThemedView>
            </Pressable>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Required for export filtering and clear work/private separation.
          </ThemedText>
          {showError('privateTag') ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.privateTag}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">Notes (optional)</ThemedText>
          <TextInput
            value={notes}
            onChangeText={(value) => setNotes(value.slice(0, NOTES_MAX))}
            onBlur={() => setTouched((prev) => ({ ...prev, notes: true }))}
            placeholder="Parking and toll included"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="sentences"
            multiline
            maxLength={NOTES_MAX}
            style={[
              styles.input,
              styles.multiline,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showError('notes') && { borderColor: theme.destructive },
            ]}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.counterText}>
            {trimmedLength(notes)}/{NOTES_MAX}
          </ThemedText>
          {showError('notes') ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.notes}
            </ThemedText>
          ) : null}

          <Pressable onPress={() => void handleSave()} disabled={!canSubmit} accessibilityState={{ disabled: !canSubmit }}>
            <ThemedView type="backgroundElement" style={[styles.primaryAction, !canSubmit && styles.primaryActionDisabled]}>
              <ThemedText type="smallBold">{saving ? 'Saving...' : 'Save Trip'}</ThemedText>
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
  readOnlyInput: {
    opacity: 0.8,
  },
  readOnlyCard: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  col: {
    flex: 1,
    gap: Spacing.one,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  tagRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    flexWrap: 'wrap',
  },
  tagChip: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
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
