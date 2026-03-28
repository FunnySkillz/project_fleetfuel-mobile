import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { tripsRepo, vehiclesRepo } from '@/data/repositories';
import type { TripPrivateTag, VehicleListItem } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { parseIntegerValue, sanitizeIntegerInput, trimmedLength } from '@/utils/form-input';

const PURPOSE_MIN = 3;
const PURPOSE_MAX = 100;
const DISTANCE_MAX_DIGITS = 5;
const DISTANCE_MAX_KM = 50000;
const NOTES_MAX = 500;

type TripFormErrors = {
  vehicleId?: string;
  purpose?: string;
  distance?: string;
  notes?: string;
};

export default function AddTripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ vehicleId?: string }>();

  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState((params.vehicleId ?? '').trim());
  const [purpose, setPurpose] = useState('');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [privateTag, setPrivateTag] = useState<TripPrivateTag>(null);
  const [saving, setSaving] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({ vehicleId: false, purpose: false, distance: false, notes: false });

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
      purpose.trim().length > 0 ||
      distance.trim().length > 0 ||
      notes.trim().length > 0 ||
      privateTag !== null ||
      saving,
    [distance, notes, privateTag, purpose, saving],
  );
  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty);

  const errors = useMemo<TripFormErrors>(() => {
    const result: TripFormErrors = {};
    const purposeLength = trimmedLength(purpose);
    const notesLength = trimmedLength(notes);
    const distanceValue = parseIntegerValue(distance);

    if (!selectedVehicleId) {
      result.vehicleId = 'Vehicle is required.';
    }

    if (purposeLength === 0) {
      result.purpose = 'Purpose is required.';
    } else if (purposeLength < PURPOSE_MIN) {
      result.purpose = `Purpose must be at least ${PURPOSE_MIN} characters.`;
    } else if (purposeLength > PURPOSE_MAX) {
      result.purpose = `Purpose must be at most ${PURPOSE_MAX} characters.`;
    }

    if (distance.trim().length === 0) {
      result.distance = 'Distance is required.';
    } else if (distanceValue === null) {
      result.distance = 'Distance must be a whole number.';
    } else if (distanceValue <= 0) {
      result.distance = 'Distance must be greater than 0.';
    } else if (distanceValue > DISTANCE_MAX_KM) {
      result.distance = `Distance must be less than or equal to ${DISTANCE_MAX_KM} km.`;
    }

    if (notesLength > NOTES_MAX) {
      result.notes = `Notes must be at most ${NOTES_MAX} characters.`;
    }

    return result;
  }, [distance, notes, purpose, selectedVehicleId]);

  const isValid = !errors.vehicleId && !errors.purpose && !errors.distance && !errors.notes;
  const canSubmit = !saving && isValid;
  const showVehicleError = (submitAttempted || touched.vehicleId) && Boolean(errors.vehicleId);
  const showPurposeError = (submitAttempted || touched.purpose) && Boolean(errors.purpose);
  const showDistanceError = (submitAttempted || touched.distance) && Boolean(errors.distance);
  const showNotesError = (submitAttempted || touched.notes) && Boolean(errors.notes);

  const handleSave = async () => {
    if (saving) {
      return;
    }

    setSubmitAttempted(true);
    setTouched({ vehicleId: true, purpose: true, distance: true, notes: true });

    if (!isValid) {
      Alert.alert('Check form', 'Please fix validation errors before saving.');
      return;
    }

    const normalizedPurpose = purpose.trim().replace(/\s+/g, ' ');
    const normalizedDistance = parseIntegerValue(distance);
    const normalizedNotes = notes.trim().replace(/\s+/g, ' ');

    if (normalizedDistance === null) {
      Alert.alert('Check form', 'Distance must be a whole number.');
      return;
    }

    setSaving(true);
    try {
      await tripsRepo.create({
        vehicleId: selectedVehicleId,
        purpose: normalizedPurpose,
        distanceKm: normalizedDistance,
        notes: normalizedNotes.length > 0 ? normalizedNotes : null,
        privateTag,
      });

      setPurpose('');
      setDistance('');
      setNotes('');
      setPrivateTag(null);
      setTouched({ vehicleId: false, purpose: false, distance: false, notes: false });
      setSubmitAttempted(false);
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
          {showVehicleError ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.vehicleId}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">Purpose</ThemedText>
          <TextInput
            value={purpose}
            onChangeText={(value) => {
              const next = value.replace(/\n/g, ' ').slice(0, PURPOSE_MAX);
              setPurpose(next);
            }}
            onBlur={() => setTouched((prev) => ({ ...prev, purpose: true }))}
            placeholder="Client meeting"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="sentences"
            autoCorrect={false}
            maxLength={PURPOSE_MAX}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showPurposeError && { borderColor: theme.destructive },
            ]}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.counterText}>
            {trimmedLength(purpose)}/{PURPOSE_MAX}
          </ThemedText>
          {showPurposeError ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.purpose}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">Distance (km)</ThemedText>
          <TextInput
            value={distance}
            onChangeText={(value) => setDistance(sanitizeIntegerInput(value, DISTANCE_MAX_DIGITS))}
            onBlur={() => setTouched((prev) => ({ ...prev, distance: true }))}
            keyboardType="numeric"
            placeholder="42"
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
            maxLength={DISTANCE_MAX_DIGITS}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showDistanceError && { borderColor: theme.destructive },
            ]}
          />
          {showDistanceError ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.distance}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">Tag (optional)</ThemedText>
          <View style={styles.tagRow}>
            <Pressable onPress={() => setPrivateTag((current) => (current === 'business' ? null : 'business'))}>
              <ThemedView
                type={privateTag === 'business' ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.tagChip}>
                <ThemedText type="small">Business</ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable onPress={() => setPrivateTag((current) => (current === 'private' ? null : 'private'))}>
              <ThemedView
                type={privateTag === 'private' ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.tagChip}>
                <ThemedText type="small">Private</ThemedText>
              </ThemedView>
            </Pressable>
          </View>

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
