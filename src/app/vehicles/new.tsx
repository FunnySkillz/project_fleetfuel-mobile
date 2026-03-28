import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { vehiclesRepo } from '@/data/repositories';
import { parseIntegerValue, sanitizeIntegerInput, sanitizePlateInput, trimmedLength } from '@/utils/form-input';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';

const VEHICLE_NAME_MIN = 2;
const VEHICLE_NAME_MAX = 60;
const LICENSE_PLATE_MIN = 3;
const LICENSE_PLATE_MAX = 16;
const TEXT_MAX = 80;
const ENGINE_CODE_MAX = 40;

type VehicleFormErrors = {
  name?: string;
  plate?: string;
  year?: string;
  ps?: string;
  kw?: string;
  engineDisplacementCc?: string;
  vin?: string;
  engineTypeCode?: string;
};

function normalizeInputText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function sanitizeVinInput(value: string) {
  return value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17);
}

export default function AddVehicleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [ps, setPs] = useState('');
  const [kw, setKw] = useState('');
  const [engineDisplacementCc, setEngineDisplacementCc] = useState('');
  const [vin, setVin] = useState('');
  const [engineTypeCode, setEngineTypeCode] = useState('');

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({
    name: false,
    plate: false,
    year: false,
    ps: false,
    kw: false,
    engineDisplacementCc: false,
    vin: false,
    engineTypeCode: false,
  });
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(
    () =>
      name.trim().length > 0 ||
      plate.trim().length > 0 ||
      make.trim().length > 0 ||
      model.trim().length > 0 ||
      year.trim().length > 0 ||
      ps.trim().length > 0 ||
      kw.trim().length > 0 ||
      engineDisplacementCc.trim().length > 0 ||
      vin.trim().length > 0 ||
      engineTypeCode.trim().length > 0,
    [engineDisplacementCc, engineTypeCode, kw, make, model, name, plate, ps, vin, year],
  );
  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty || saving);

  const errors = useMemo<VehicleFormErrors>(() => {
    const result: VehicleFormErrors = {};
    const normalizedName = normalizeInputText(name);
    const normalizedPlate = normalizeInputText(plate);

    if (normalizedName.length === 0) {
      result.name = 'Vehicle name is required.';
    } else if (normalizedName.length < VEHICLE_NAME_MIN) {
      result.name = `Vehicle name must be at least ${VEHICLE_NAME_MIN} characters.`;
    } else if (normalizedName.length > VEHICLE_NAME_MAX) {
      result.name = `Vehicle name must be at most ${VEHICLE_NAME_MAX} characters.`;
    }

    if (normalizedPlate.length === 0) {
      result.plate = 'License plate is required.';
    } else if (normalizedPlate.length < LICENSE_PLATE_MIN) {
      result.plate = `License plate must be at least ${LICENSE_PLATE_MIN} characters.`;
    } else if (normalizedPlate.length > LICENSE_PLATE_MAX) {
      result.plate = `License plate must be at most ${LICENSE_PLATE_MAX} characters.`;
    } else if (!/^[A-Z0-9 -]+$/.test(normalizedPlate)) {
      result.plate = 'License plate can only contain A-Z, 0-9, spaces, and hyphen.';
    }

    const yearValue = parseIntegerValue(year);
    if (year.trim().length > 0) {
      const maxYear = new Date().getUTCFullYear() + 1;
      if (yearValue === null || yearValue < 1950 || yearValue > maxYear) {
        result.year = `Year must be between 1950 and ${maxYear}.`;
      }
    }

    const psValue = parseIntegerValue(ps);
    if (ps.trim().length > 0 && (psValue === null || psValue < 1 || psValue > 3000)) {
      result.ps = 'PS must be between 1 and 3000.';
    }

    const kwValue = parseIntegerValue(kw);
    if (kw.trim().length > 0 && (kwValue === null || kwValue < 1 || kwValue > 3000)) {
      result.kw = 'kW must be between 1 and 3000.';
    }

    const engineCcValue = parseIntegerValue(engineDisplacementCc);
    if (engineDisplacementCc.trim().length > 0 && (engineCcValue === null || engineCcValue < 50 || engineCcValue > 20000)) {
      result.engineDisplacementCc = 'Hubraum must be between 50 and 20000 cc.';
    }

    const normalizedVin = normalizeInputText(vin);
    if (normalizedVin.length > 0) {
      if (normalizedVin.length < 11 || normalizedVin.length > 17) {
        result.vin = 'VIN must be between 11 and 17 characters.';
      } else if (!/^[A-HJ-NPR-Z0-9]+$/.test(normalizedVin)) {
        result.vin = 'VIN can only contain A-Z (without I, O, Q) and numbers.';
      }
    }

    const normalizedEngineTypeCode = normalizeInputText(engineTypeCode);
    if (normalizedEngineTypeCode.length > ENGINE_CODE_MAX) {
      result.engineTypeCode = `Engine type code must be at most ${ENGINE_CODE_MAX} characters.`;
    }

    return result;
  }, [engineDisplacementCc, engineTypeCode, kw, name, plate, ps, vin, year]);

  const isValid =
    !errors.name &&
    !errors.plate &&
    !errors.year &&
    !errors.ps &&
    !errors.kw &&
    !errors.engineDisplacementCc &&
    !errors.vin &&
    !errors.engineTypeCode;

  const canSubmit = isDirty && isValid && !saving;

  const showError = (field: keyof typeof touched) => (submitAttempted || touched[field]) && Boolean(errors[field]);

  const handleSave = async () => {
    if (saving) {
      return;
    }

    setSubmitAttempted(true);
    setTouched({
      name: true,
      plate: true,
      year: true,
      ps: true,
      kw: true,
      engineDisplacementCc: true,
      vin: true,
      engineTypeCode: true,
    });

    if (!isValid) {
      Alert.alert('Check form', 'Please fix validation errors before saving.');
      return;
    }

    setSaving(true);
    try {
      await vehiclesRepo.create({
        name: normalizeInputText(name),
        plate: normalizeInputText(plate),
        make: normalizeInputText(make) || null,
        model: normalizeInputText(model) || null,
        year: parseIntegerValue(year),
        ps: parseIntegerValue(ps),
        kw: parseIntegerValue(kw),
        engineDisplacementCc: parseIntegerValue(engineDisplacementCc),
        vin: normalizeInputText(vin) || null,
        engineTypeCode: normalizeInputText(engineTypeCode) || null,
      });

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
            onChangeText={(value) => setName(value.replace(/\n/g, ' ').slice(0, VEHICLE_NAME_MAX))}
            onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
            placeholder="Ford Transit"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={VEHICLE_NAME_MAX}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showError('name') && { borderColor: theme.destructive },
            ]}
          />
          <View style={styles.metaRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {trimmedLength(name)}/{VEHICLE_NAME_MAX}
            </ThemedText>
            {showError('name') ? (
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
              showError('plate') && { borderColor: theme.destructive },
            ]}
          />
          <View style={styles.metaRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {trimmedLength(plate)}/{LICENSE_PLATE_MAX}
            </ThemedText>
            {showError('plate') ? (
              <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
                {errors.plate}
              </ThemedText>
            ) : null}
          </View>

          <ThemedText type="smallBold">Make (optional)</ThemedText>
          <TextInput
            value={make}
            onChangeText={(value) => setMake(value.replace(/\n/g, ' ').slice(0, TEXT_MAX))}
            placeholder="Ford"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={TEXT_MAX}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background }]}
          />

          <ThemedText type="smallBold">Model (optional)</ThemedText>
          <TextInput
            value={model}
            onChangeText={(value) => setModel(value.replace(/\n/g, ' ').slice(0, TEXT_MAX))}
            placeholder="Transit Custom"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={TEXT_MAX}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background }]}
          />

          <ThemedText type="smallBold">Year (optional)</ThemedText>
          <TextInput
            value={year}
            onChangeText={(value) => setYear(sanitizeIntegerInput(value, 4))}
            onBlur={() => setTouched((prev) => ({ ...prev, year: true }))}
            keyboardType="numeric"
            placeholder="2022"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showError('year') && { borderColor: theme.destructive },
            ]}
          />
          {showError('year') ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.year}
            </ThemedText>
          ) : null}

          <View style={styles.rowTwoCols}>
            <View style={styles.col}>
              <ThemedText type="smallBold">PS (optional)</ThemedText>
              <TextInput
                value={ps}
                onChangeText={(value) => setPs(sanitizeIntegerInput(value, 4))}
                onBlur={() => setTouched((prev) => ({ ...prev, ps: true }))}
                keyboardType="numeric"
                placeholder="150"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
                  showError('ps') && { borderColor: theme.destructive },
                ]}
              />
              {showError('ps') ? (
                <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
                  {errors.ps}
                </ThemedText>
              ) : null}
            </View>

            <View style={styles.col}>
              <ThemedText type="smallBold">kW (optional)</ThemedText>
              <TextInput
                value={kw}
                onChangeText={(value) => setKw(sanitizeIntegerInput(value, 4))}
                onBlur={() => setTouched((prev) => ({ ...prev, kw: true }))}
                keyboardType="numeric"
                placeholder="110"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
                  showError('kw') && { borderColor: theme.destructive },
                ]}
              />
              {showError('kw') ? (
                <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
                  {errors.kw}
                </ThemedText>
              ) : null}
            </View>
          </View>

          <ThemedText type="smallBold">Hubraum ccm (optional)</ThemedText>
          <TextInput
            value={engineDisplacementCc}
            onChangeText={(value) => setEngineDisplacementCc(sanitizeIntegerInput(value, 5))}
            onBlur={() => setTouched((prev) => ({ ...prev, engineDisplacementCc: true }))}
            keyboardType="numeric"
            placeholder="1995"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showError('engineDisplacementCc') && { borderColor: theme.destructive },
            ]}
          />
          {showError('engineDisplacementCc') ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.engineDisplacementCc}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">VIN / FIN (optional)</ThemedText>
          <TextInput
            value={vin}
            onChangeText={(value) => setVin(sanitizeVinInput(value))}
            onBlur={() => setTouched((prev) => ({ ...prev, vin: true }))}
            placeholder="WF0XXXXXXXXXXXXXX"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={17}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showError('vin') && { borderColor: theme.destructive },
            ]}
          />
          {showError('vin') ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.vin}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">Engine Type Code (optional)</ThemedText>
          <TextInput
            value={engineTypeCode}
            onChangeText={(value) => setEngineTypeCode(value.replace(/\n/g, ' ').slice(0, ENGINE_CODE_MAX))}
            onBlur={() => setTouched((prev) => ({ ...prev, engineTypeCode: true }))}
            placeholder="YT2Q"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={ENGINE_CODE_MAX}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showError('engineTypeCode') && { borderColor: theme.destructive },
            ]}
          />
          {showError('engineTypeCode') ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.engineTypeCode}
            </ThemedText>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={() => void handleSave()}
              disabled={!canSubmit}
              accessibilityState={{ disabled: !canSubmit }}>
              <ThemedView type="backgroundElement" style={[styles.primaryAction, !canSubmit && styles.primaryActionDisabled]}>
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
  rowTwoCols: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  col: {
    flex: 1,
    gap: Spacing.one,
  },
  errorText: {
    flexShrink: 1,
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
