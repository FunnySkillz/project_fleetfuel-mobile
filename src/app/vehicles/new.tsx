import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { vehiclesRepo } from '@/data/repositories';
import { sanitizePlateInput, trimmedLength } from '@/utils/form-input';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';

const VEHICLE_NAME_MIN = 2;
const VEHICLE_NAME_MAX = 60;
const LICENSE_PLATE_MIN = 3;
const LICENSE_PLATE_MAX = 16;

type VehicleFormErrors = {
  name?: string;
  plate?: string;
};

export default function AddVehicleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({ name: false, plate: false });
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(() => name.trim().length > 0 || plate.trim().length > 0, [name, plate]);
  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty);

  const errors = useMemo<VehicleFormErrors>(() => {
    const result: VehicleFormErrors = {};
    const normalizedNameLength = trimmedLength(name);
    const normalizedPlate = plate.trim();
    const normalizedPlateLength = trimmedLength(plate);

    if (normalizedNameLength === 0) {
      result.name = 'Vehicle name is required.';
    } else if (normalizedNameLength < VEHICLE_NAME_MIN) {
      result.name = `Vehicle name must be at least ${VEHICLE_NAME_MIN} characters.`;
    } else if (normalizedNameLength > VEHICLE_NAME_MAX) {
      result.name = `Vehicle name must be at most ${VEHICLE_NAME_MAX} characters.`;
    }

    if (normalizedPlateLength === 0) {
      result.plate = 'License plate is required.';
    } else if (normalizedPlateLength < LICENSE_PLATE_MIN) {
      result.plate = `License plate must be at least ${LICENSE_PLATE_MIN} characters.`;
    } else if (normalizedPlateLength > LICENSE_PLATE_MAX) {
      result.plate = `License plate must be at most ${LICENSE_PLATE_MAX} characters.`;
    } else if (!/^[A-Z0-9 -]+$/.test(normalizedPlate)) {
      result.plate = 'License plate can only contain A-Z, 0-9, spaces, and hyphen.';
    }

    return result;
  }, [name, plate]);

  const isValid = !errors.name && !errors.plate;
  const canSubmit = isDirty && isValid;
  const showNameError = (submitAttempted || touched.name) && Boolean(errors.name);
  const showPlateError = (submitAttempted || touched.plate) && Boolean(errors.plate);

  const handleSave = async () => {
    if (saving) {
      return;
    }

    setSubmitAttempted(true);
    setTouched({ name: true, plate: true });

    if (!isValid) {
      Alert.alert('Check form', 'Please fix validation errors before saving.');
      return;
    }

    const normalizedName = name.trim().replace(/\s+/g, ' ');
    const normalizedPlate = plate.trim();

    setSaving(true);
    try {
      await vehiclesRepo.create({
        name: normalizedName,
        plate: normalizedPlate,
      });

      setName('');
      setPlate('');
      setTouched({ name: false, plate: false });
      setSubmitAttempted(false);
      allowNextNavigation();
      router.back();
    } catch (error) {
      Alert.alert('Could not save vehicle', error instanceof Error ? error.message : 'Unexpected error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}>
          <ThemedText type="smallBold">Vehicle Name</ThemedText>
          <TextInput
            value={name}
            onChangeText={(value) => {
              const next = value.replace(/\n/g, ' ').slice(0, VEHICLE_NAME_MAX);
              setName(next);
            }}
            onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
            placeholder="Ford Transit"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            maxLength={VEHICLE_NAME_MAX}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showNameError && { borderColor: theme.destructive },
            ]}
          />
          <View style={styles.metaRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {trimmedLength(name)}/{VEHICLE_NAME_MAX}
            </ThemedText>
            {showNameError ? (
              <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
                {errors.name}
              </ThemedText>
            ) : null}
          </View>

          <ThemedText type="smallBold">License Plate</ThemedText>
          <TextInput
            value={plate}
            onChangeText={(value) => setPlate(sanitizePlateInput(value, LICENSE_PLATE_MAX))}
            onBlur={() => setTouched((prev) => ({ ...prev, plate: true }))}
            placeholder="W-123AB"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={LICENSE_PLATE_MAX}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showPlateError && { borderColor: theme.destructive },
            ]}
          />
          <View style={styles.metaRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {trimmedLength(plate)}/{LICENSE_PLATE_MAX}
            </ThemedText>
            {showPlateError ? (
              <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
                {errors.plate}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => void handleSave()}
              disabled={!canSubmit || saving}
              accessibilityState={{ disabled: !canSubmit || saving }}>
              <ThemedView
                type="backgroundElement"
                style={[styles.primaryAction, (!canSubmit || saving) && styles.primaryActionDisabled]}>
                <ThemedText type="smallBold">{saving ? 'Saving...' : 'Save Vehicle'}</ThemedText>
              </ThemedView>
            </Pressable>
          </View>
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
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.one,
  },
  errorText: {
    flexShrink: 1,
    textAlign: 'right',
  },
  actions: {
    paddingTop: Spacing.two,
  },
  primaryAction: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  primaryActionDisabled: {
    opacity: 0.45,
  },
});
