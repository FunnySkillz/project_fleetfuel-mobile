import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Button, Card, FormField, Input, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { vehiclesRepo } from '@/data/repositories';
import { useI18n } from '@/hooks/use-i18n';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { parseIntegerValue, sanitizeIntegerInput, sanitizePlateInput, trimmedLength } from '@/utils/form-input';

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
  const { t } = useI18n();

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
      result.name = t('vehicleForm.error.nameRequired');
    } else if (normalizedName.length < VEHICLE_NAME_MIN) {
      result.name = t('vehicleForm.error.nameMin', { min: VEHICLE_NAME_MIN });
    } else if (normalizedName.length > VEHICLE_NAME_MAX) {
      result.name = t('vehicleForm.error.nameMax', { max: VEHICLE_NAME_MAX });
    }

    if (normalizedPlate.length === 0) {
      result.plate = t('vehicleForm.error.plateRequired');
    } else if (normalizedPlate.length < LICENSE_PLATE_MIN) {
      result.plate = t('vehicleForm.error.plateMin', { min: LICENSE_PLATE_MIN });
    } else if (normalizedPlate.length > LICENSE_PLATE_MAX) {
      result.plate = t('vehicleForm.error.plateMax', { max: LICENSE_PLATE_MAX });
    } else if (!/^[A-Z0-9 -]+$/.test(normalizedPlate)) {
      result.plate = t('vehicleForm.error.platePattern');
    }

    const yearValue = parseIntegerValue(year);
    if (year.trim().length > 0) {
      const maxYear = new Date().getUTCFullYear() + 1;
      if (yearValue === null || yearValue < 1950 || yearValue > maxYear) {
        result.year = t('vehicleForm.error.yearRange', { min: 1950, max: maxYear });
      }
    }

    const psValue = parseIntegerValue(ps);
    if (ps.trim().length > 0 && (psValue === null || psValue < 1 || psValue > 3000)) {
      result.ps = t('vehicleForm.error.psRange', { min: 1, max: 3000 });
    }

    const kwValue = parseIntegerValue(kw);
    if (kw.trim().length > 0 && (kwValue === null || kwValue < 1 || kwValue > 3000)) {
      result.kw = t('vehicleForm.error.kwRange', { min: 1, max: 3000 });
    }

    const engineCcValue = parseIntegerValue(engineDisplacementCc);
    if (engineDisplacementCc.trim().length > 0 && (engineCcValue === null || engineCcValue < 50 || engineCcValue > 20000)) {
      result.engineDisplacementCc = t('vehicleForm.error.displacementRange', { min: 50, max: 20000 });
    }

    const normalizedVin = normalizeInputText(vin);
    if (normalizedVin.length > 0) {
      if (normalizedVin.length < 11 || normalizedVin.length > 17) {
        result.vin = t('vehicleForm.error.vinLength', { min: 11, max: 17 });
      } else if (!/^[A-HJ-NPR-Z0-9]+$/.test(normalizedVin)) {
        result.vin = t('vehicleForm.error.vinPattern');
      }
    }

    const normalizedEngineTypeCode = normalizeInputText(engineTypeCode);
    if (normalizedEngineTypeCode.length > ENGINE_CODE_MAX) {
      result.engineTypeCode = t('vehicleForm.error.engineCodeMax', { max: ENGINE_CODE_MAX });
    }

    return result;
  }, [engineDisplacementCc, engineTypeCode, kw, name, plate, ps, t, vin, year]);

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
      Alert.alert(t('common.checkFormTitle'), t('common.fixValidationErrors'));
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
      Alert.alert(t('vehicleForm.alert.saveFailedTitle'), error instanceof Error ? error.message : t('common.unexpectedError'));
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
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}> 
          <SectionHeader
            title={t('vehicleForm.title')}
            description={t('vehicleForm.description')}
          />

          <Card className="gap-3">
            <FormField
              label={t('vehicleForm.field.name')}
              required
              hint={t('common.charCount', { current: trimmedLength(name), max: VEHICLE_NAME_MAX })}
              error={showError('name') ? errors.name : null}>
              <Input
                value={name}
                onChangeText={(value) => setName(value.replace(/\n/g, ' ').slice(0, VEHICLE_NAME_MAX))}
                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                placeholder={t('vehicleForm.placeholder.name')}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={VEHICLE_NAME_MAX}
                tone={showError('name') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField
              label={t('vehicleForm.field.plate')}
              required
              hint={t('common.charCount', { current: trimmedLength(plate), max: LICENSE_PLATE_MAX })}
              error={showError('plate') ? errors.plate : null}>
              <Input
                value={plate}
                onChangeText={(value) => setPlate(sanitizePlateInput(value, LICENSE_PLATE_MAX))}
                onBlur={() => setTouched((prev) => ({ ...prev, plate: true }))}
                placeholder={t('vehicleForm.placeholder.plate')}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={LICENSE_PLATE_MAX}
                tone={showError('plate') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField label={t('vehicleForm.field.make')}>
              <Input
                value={make}
                onChangeText={(value) => setMake(value.replace(/\n/g, ' ').slice(0, TEXT_MAX))}
                placeholder={t('vehicleForm.placeholder.make')}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={TEXT_MAX}
              />
            </FormField>

            <FormField label={t('vehicleForm.field.model')}>
              <Input
                value={model}
                onChangeText={(value) => setModel(value.replace(/\n/g, ' ').slice(0, TEXT_MAX))}
                placeholder={t('vehicleForm.placeholder.model')}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={TEXT_MAX}
              />
            </FormField>

            <FormField label={t('vehicleForm.field.year')} error={showError('year') ? errors.year : null}>
              <Input
                value={year}
                onChangeText={(value) => setYear(sanitizeIntegerInput(value, 4))}
                onBlur={() => setTouched((prev) => ({ ...prev, year: true }))}
                keyboardType="number-pad"
                placeholder={t('vehicleForm.placeholder.year')}
                tone={showError('year') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <View style={styles.rowTwoCols}>
              <View style={styles.col}>
                <FormField label={t('vehicleForm.field.ps')} error={showError('ps') ? errors.ps : null}>
                  <Input
                    value={ps}
                    onChangeText={(value) => setPs(sanitizeIntegerInput(value, 4))}
                    onBlur={() => setTouched((prev) => ({ ...prev, ps: true }))}
                    keyboardType="number-pad"
                    placeholder={t('vehicleForm.placeholder.ps')}
                    tone={showError('ps') ? 'destructive' : 'neutral'}
                  />
                </FormField>
              </View>

              <View style={styles.col}>
                <FormField label={t('vehicleForm.field.kw')} error={showError('kw') ? errors.kw : null}>
                  <Input
                    value={kw}
                    onChangeText={(value) => setKw(sanitizeIntegerInput(value, 4))}
                    onBlur={() => setTouched((prev) => ({ ...prev, kw: true }))}
                    keyboardType="number-pad"
                    placeholder={t('vehicleForm.placeholder.kw')}
                    tone={showError('kw') ? 'destructive' : 'neutral'}
                  />
                </FormField>
              </View>
            </View>

            <FormField label={t('vehicleForm.field.displacement')} error={showError('engineDisplacementCc') ? errors.engineDisplacementCc : null}>
              <Input
                value={engineDisplacementCc}
                onChangeText={(value) => setEngineDisplacementCc(sanitizeIntegerInput(value, 5))}
                onBlur={() => setTouched((prev) => ({ ...prev, engineDisplacementCc: true }))}
                keyboardType="number-pad"
                placeholder={t('vehicleForm.placeholder.displacement')}
                tone={showError('engineDisplacementCc') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField label={t('vehicleForm.field.vin')} error={showError('vin') ? errors.vin : null}>
              <Input
                value={vin}
                onChangeText={(value) => setVin(sanitizeVinInput(value))}
                onBlur={() => setTouched((prev) => ({ ...prev, vin: true }))}
                placeholder={t('vehicleForm.placeholder.vin')}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={17}
                tone={showError('vin') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField
              label={t('vehicleForm.field.engineCode')}
              hint={t('common.charCount', { current: trimmedLength(engineTypeCode), max: ENGINE_CODE_MAX })}
              error={showError('engineTypeCode') ? errors.engineTypeCode : null}>
              <Input
                value={engineTypeCode}
                onChangeText={(value) => setEngineTypeCode(value.replace(/\n/g, ' ').slice(0, ENGINE_CODE_MAX))}
                onBlur={() => setTouched((prev) => ({ ...prev, engineTypeCode: true }))}
                placeholder={t('vehicleForm.placeholder.engineCode')}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={ENGINE_CODE_MAX}
                tone={showError('engineTypeCode') ? 'destructive' : 'neutral'}
              />
            </FormField>
          </Card>

          <Button
            label={t('vehicleForm.save')}
            loading={saving}
            loadingLabel={t('vehicleForm.saving')}
            variant="primary"
            disabled={!canSubmit}
            onPress={() => void handleSave()}
          />
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
    gap: Spacing.three,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  col: {
    flex: 1,
  },
});

