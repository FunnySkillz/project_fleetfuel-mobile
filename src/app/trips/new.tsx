import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { parseIntegerValue, sanitizeIntegerInput, trimmedLength } from '@/utils/form-input';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';

const PURPOSE_MIN = 3;
const PURPOSE_MAX = 100;
const DISTANCE_MAX_DIGITS = 5;
const DISTANCE_MAX_KM = 50000;
const NOTES_MAX = 500;

type TripFormErrors = {
  purpose?: string;
  distance?: string;
  notes?: string;
};

export default function AddTripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const params = useLocalSearchParams<{ vehicleId?: string }>();
  const [purpose, setPurpose] = useState('');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({ purpose: false, distance: false, notes: false });

  const isDirty = useMemo(
    () => purpose.trim().length > 0 || distance.trim().length > 0 || notes.trim().length > 0,
    [purpose, distance, notes],
  );
  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty);

  const errors = useMemo<TripFormErrors>(() => {
    const result: TripFormErrors = {};
    const purposeLength = trimmedLength(purpose);
    const notesLength = trimmedLength(notes);
    const distanceValue = parseIntegerValue(distance);

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
  }, [distance, notes, purpose]);

  const isValid = !errors.purpose && !errors.distance && !errors.notes;
  const canSubmit = isDirty && isValid;
  const showPurposeError = (submitAttempted || touched.purpose) && Boolean(errors.purpose);
  const showDistanceError = (submitAttempted || touched.distance) && Boolean(errors.distance);
  const showNotesError = (submitAttempted || touched.notes) && Boolean(errors.notes);

  const handleSave = () => {
    setSubmitAttempted(true);
    setTouched({ purpose: true, distance: true, notes: true });

    if (!isValid) {
      Alert.alert('Check form', 'Please fix validation errors before saving.');
      return;
    }

    const normalizedPurpose = purpose.trim().replace(/\s+/g, ' ');
    const normalizedDistance = parseIntegerValue(distance);

    Alert.alert(
      'Trip saved locally (placeholder)',
      `Trip "${normalizedPurpose}" (${normalizedDistance} km) is valid and ready for data-layer integration.`,
    );
    setPurpose('');
    setDistance('');
    setNotes('');
    setTouched({ purpose: false, distance: false, notes: false });
    setSubmitAttempted(false);
    allowNextNavigation();
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Vehicle context: {params.vehicleId ?? 'not preselected'}
          </ThemedText>

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

          <Pressable onPress={handleSave} disabled={!canSubmit} accessibilityState={{ disabled: !canSubmit }}>
            <ThemedView
              type="backgroundElement"
              style={[styles.primaryAction, !canSubmit && styles.primaryActionDisabled]}>
              <ThemedText type="smallBold">Save Trip</ThemedText>
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
  errorText: {
  },
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
