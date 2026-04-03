import { useHeaderHeight } from '@react-navigation/elements';
import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { ActionIcon, Button, Card, FormField, Input, SectionHeader, SelectField, YearPickerField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { FUEL_TYPES, type FuelType } from '@/data/types';
import { useI18n } from '@/hooks/use-i18n';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { buildFuelTypeOptions } from '@/utils/fuel-type-options';
import { parseIntegerValue, sanitizeIntegerInput, sanitizePlateInput, trimmedLength } from '@/utils/form-input';
import { isReasonPromptCancelledError } from '@/utils/reason-prompt';
import { kwFromPs, psFromKw } from '@/utils/vehicle-power';

const VEHICLE_NAME_MIN = 2;
const VEHICLE_NAME_MAX = 60;
const LICENSE_PLATE_MIN = 3;
const LICENSE_PLATE_MAX = 16;
const TEXT_MAX = 80;
const ENGINE_CODE_MAX = 40;
const YEAR_MIN = 1950;
const ODOMETER_MAX = 9_999_999;

type VehicleFieldKey =
  | 'name'
  | 'plate'
  | 'currentOdometerKm'
  | 'defaultFuelType'
  | 'make'
  | 'model'
  | 'year'
  | 'ps'
  | 'kw'
  | 'engineDisplacementCc'
  | 'vin'
  | 'engineTypeCode';

type VehicleFormState = Record<VehicleFieldKey, string>;

type VehicleFormTouchedState = Record<VehicleFieldKey, boolean>;

type VehicleFormErrors = {
  name?: string;
  plate?: string;
  currentOdometerKm?: string;
  defaultFuelType?: string;
  make?: string;
  model?: string;
  year?: string;
  ps?: string;
  kw?: string;
  engineDisplacementCc?: string;
  vin?: string;
  engineTypeCode?: string;
};

export type VehicleFormInitialValues = {
  name?: string | null;
  plate?: string | null;
  currentOdometerKm?: number | null;
  defaultFuelType?: FuelType | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  ps?: number | null;
  kw?: number | null;
  engineDisplacementCc?: number | null;
  vin?: string | null;
  engineTypeCode?: string | null;
};

export type VehicleFormSubmitValues = {
  name: string;
  plate: string;
  currentOdometerKm: number;
  defaultFuelType: FuelType;
  make: string | null;
  model: string | null;
  year: number | null;
  ps: number | null;
  kw: number | null;
  engineDisplacementCc: number | null;
  vin: string | null;
  engineTypeCode: string | null;
};

type VehicleFormScreenProps = {
  title: string;
  description: string;
  submitLabel: string;
  submittingLabel: string;
  initialValues?: VehicleFormInitialValues;
  onSubmit: (values: VehicleFormSubmitValues) => Promise<void>;
  onSubmitSuccess?: () => void;
};

function normalizeInputText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function sanitizeVinInput(value: string) {
  return value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17);
}

function toFormState(initialValues: VehicleFormInitialValues | undefined): VehicleFormState {
  return {
    name: initialValues?.name ?? '',
    plate: initialValues?.plate ?? '',
    currentOdometerKm:
      initialValues?.currentOdometerKm === null || initialValues?.currentOdometerKm === undefined
        ? ''
        : String(initialValues.currentOdometerKm),
    defaultFuelType: initialValues?.defaultFuelType ?? '',
    make: initialValues?.make ?? '',
    model: initialValues?.model ?? '',
    year: initialValues?.year === null || initialValues?.year === undefined ? '' : String(initialValues.year),
    ps: initialValues?.ps === null || initialValues?.ps === undefined ? '' : String(initialValues.ps),
    kw: initialValues?.kw === null || initialValues?.kw === undefined ? '' : String(initialValues.kw),
    engineDisplacementCc:
      initialValues?.engineDisplacementCc === null || initialValues?.engineDisplacementCc === undefined
        ? ''
        : String(initialValues.engineDisplacementCc),
    vin: initialValues?.vin ?? '',
    engineTypeCode: initialValues?.engineTypeCode ?? '',
  };
}

function toTouchedState(value: boolean): VehicleFormTouchedState {
  return {
    name: value,
    plate: value,
    currentOdometerKm: value,
    defaultFuelType: value,
    make: value,
    model: value,
    year: value,
    ps: value,
    kw: value,
    engineDisplacementCc: value,
    vin: value,
    engineTypeCode: value,
  };
}

type VehicleFormComparableValues = Omit<VehicleFormSubmitValues, 'currentOdometerKm' | 'defaultFuelType'> & {
  currentOdometerKm: number | null;
  defaultFuelType: FuelType | null;
};

function createComparablePayload(form: VehicleFormState): VehicleFormComparableValues {
  const selectedFuelType = FUEL_TYPES.find((value) => value === form.defaultFuelType) ?? null;

  return {
    name: normalizeInputText(form.name),
    plate: normalizeInputText(form.plate),
    currentOdometerKm: parseIntegerValue(form.currentOdometerKm),
    defaultFuelType: selectedFuelType,
    make: normalizeInputText(form.make) || null,
    model: normalizeInputText(form.model) || null,
    year: parseIntegerValue(form.year),
    ps: parseIntegerValue(form.ps),
    kw: parseIntegerValue(form.kw),
    engineDisplacementCc: parseIntegerValue(form.engineDisplacementCc),
    vin: normalizeInputText(form.vin) || null,
    engineTypeCode: normalizeInputText(form.engineTypeCode) || null,
  };
}

function firstErrorField(errors: VehicleFormErrors): VehicleFieldKey | null {
  const orderedFields: VehicleFieldKey[] = [
    'name',
    'plate',
    'currentOdometerKm',
    'defaultFuelType',
    'year',
    'ps',
    'kw',
    'engineDisplacementCc',
    'vin',
    'engineTypeCode',
  ];

  return orderedFields.find((field) => Boolean(errors[field])) ?? null;
}

export function VehicleFormScreen({
  title,
  description,
  submitLabel,
  submittingLabel,
  initialValues,
  onSubmit,
  onSubmitSuccess,
}: VehicleFormScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { t } = useI18n();
  const maxYear = new Date().getUTCFullYear() + 1;
  const initialFormState = useMemo(() => toFormState(initialValues), [initialValues]);
  const [form, setForm] = useState<VehicleFormState>(initialFormState);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<VehicleFormTouchedState>(() => toTouchedState(false));
  const [saving, setSaving] = useState(false);

  const fieldPositionsRef = useRef<Partial<Record<VehicleFieldKey, number>>>({});
  const scrollRef = useRef<ScrollView>(null);
  const vinInputRef = useRef<TextInput>(null);
  const engineCodeInputRef = useRef<TextInput>(null);

  const initialPayload = useMemo(() => createComparablePayload(initialFormState), [initialFormState]);
  const currentPayload = useMemo(() => createComparablePayload(form), [form]);
  const isDirty = useMemo(() => {
    return (
      currentPayload.name !== initialPayload.name ||
      currentPayload.plate !== initialPayload.plate ||
      currentPayload.currentOdometerKm !== initialPayload.currentOdometerKm ||
      currentPayload.defaultFuelType !== initialPayload.defaultFuelType ||
      currentPayload.make !== initialPayload.make ||
      currentPayload.model !== initialPayload.model ||
      currentPayload.year !== initialPayload.year ||
      currentPayload.ps !== initialPayload.ps ||
      currentPayload.kw !== initialPayload.kw ||
      currentPayload.engineDisplacementCc !== initialPayload.engineDisplacementCc ||
      currentPayload.vin !== initialPayload.vin ||
      currentPayload.engineTypeCode !== initialPayload.engineTypeCode
    );
  }, [currentPayload, initialPayload]);

  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty || saving);
  const fuelTypeOptions = useMemo(() => buildFuelTypeOptions(t), [t]);

  const errors = useMemo<VehicleFormErrors>(() => {
    const result: VehicleFormErrors = {};
    const normalizedName = normalizeInputText(form.name);
    const normalizedPlate = normalizeInputText(form.plate);
    const odometerValue = parseIntegerValue(form.currentOdometerKm);
    const selectedFuelType = FUEL_TYPES.find((value) => value === form.defaultFuelType) ?? null;

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

    if (form.currentOdometerKm.trim().length === 0) {
      result.currentOdometerKm = t('vehicleForm.error.currentKmRequired');
    } else if (odometerValue === null) {
      result.currentOdometerKm = t('vehicleForm.error.currentKmInteger');
    } else if (odometerValue < 0) {
      result.currentOdometerKm = t('vehicleForm.error.currentKmNonNegative');
    } else if (odometerValue > ODOMETER_MAX) {
      result.currentOdometerKm = t('vehicleForm.error.currentKmMax', { max: ODOMETER_MAX });
    }

    if (!selectedFuelType) {
      result.defaultFuelType = t('vehicleForm.error.defaultFuelTypeRequired');
    }

    const yearValue = parseIntegerValue(form.year);
    if (form.year.trim().length > 0 && (yearValue === null || yearValue < YEAR_MIN || yearValue > maxYear)) {
      result.year = t('vehicleForm.error.yearRange', { min: YEAR_MIN, max: maxYear });
    }

    const psValue = parseIntegerValue(form.ps);
    if (form.ps.trim().length > 0 && (psValue === null || psValue < 1 || psValue > 3000)) {
      result.ps = t('vehicleForm.error.psRange', { min: 1, max: 3000 });
    }

    const kwValue = parseIntegerValue(form.kw);
    if (form.kw.trim().length > 0 && (kwValue === null || kwValue < 1 || kwValue > 3000)) {
      result.kw = t('vehicleForm.error.kwRange', { min: 1, max: 3000 });
    }

    const engineCcValue = parseIntegerValue(form.engineDisplacementCc);
    if (form.engineDisplacementCc.trim().length > 0 && (engineCcValue === null || engineCcValue < 50 || engineCcValue > 20000)) {
      result.engineDisplacementCc = t('vehicleForm.error.displacementRange', { min: 50, max: 20000 });
    }

    const normalizedVin = normalizeInputText(form.vin);
    if (normalizedVin.length > 0) {
      if (normalizedVin.length < 11 || normalizedVin.length > 17) {
        result.vin = t('vehicleForm.error.vinLength', { min: 11, max: 17 });
      } else if (!/^[A-HJ-NPR-Z0-9]+$/.test(normalizedVin)) {
        result.vin = t('vehicleForm.error.vinPattern');
      }
    }

    const normalizedEngineTypeCode = normalizeInputText(form.engineTypeCode);
    if (normalizedEngineTypeCode.length > ENGINE_CODE_MAX) {
      result.engineTypeCode = t('vehicleForm.error.engineCodeMax', { max: ENGINE_CODE_MAX });
    }

    return result;
  }, [form, maxYear, t]);

  const isValid =
    !errors.name &&
    !errors.plate &&
    !errors.currentOdometerKm &&
    !errors.defaultFuelType &&
    !errors.year &&
    !errors.ps &&
    !errors.kw &&
    !errors.engineDisplacementCc &&
    !errors.vin &&
    !errors.engineTypeCode;

  const showError = (field: VehicleFieldKey) => (submitAttempted || touched[field]) && Boolean(errors[field]);

  const handleLayout = (field: VehicleFieldKey) => (event: LayoutChangeEvent) => {
    fieldPositionsRef.current[field] = event.nativeEvent.layout.y;
  };

  const scrollToField = (field: VehicleFieldKey) => {
    const y = fieldPositionsRef.current[field];
    if (typeof y !== 'number') {
      return;
    }

    scrollRef.current?.scrollTo({ y: Math.max(0, y - Spacing.two), animated: true });
  };

  const markTouched = (field: VehicleFieldKey) => {
    setTouched((previous) => ({ ...previous, [field]: true }));
  };

  const handlePsChange = (value: string) => {
    const nextPs = sanitizeIntegerInput(value, 4);
    const parsedPs = parseIntegerValue(nextPs);
    const nextKw = parsedPs === null ? '' : String(kwFromPs(parsedPs));

    setForm((previous) => ({
      ...previous,
      ps: nextPs,
      kw: nextKw,
    }));
  };

  const handleKwChange = (value: string) => {
    const nextKw = sanitizeIntegerInput(value, 4);
    const parsedKw = parseIntegerValue(nextKw);
    const nextPs = parsedKw === null ? '' : String(psFromKw(parsedKw));

    setForm((previous) => ({
      ...previous,
      kw: nextKw,
      ps: nextPs,
    }));
  };

  const handleSave = async () => {
    if (saving) {
      return;
    }

    setSubmitAttempted(true);
    setTouched(toTouchedState(true));

    if (!isValid) {
      const firstField = firstErrorField(errors);
      if (firstField) {
        scrollToField(firstField);
      }
      Alert.alert(t('common.checkFormTitle'), t('common.fixValidationErrors'));
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        ...currentPayload,
        currentOdometerKm: currentPayload.currentOdometerKm as number,
        defaultFuelType: currentPayload.defaultFuelType as FuelType,
      });
      allowNextNavigation();
      onSubmitSuccess?.();
    } catch (error) {
      if (isReasonPromptCancelledError(error)) {
        return;
      }
      Alert.alert(t('vehicleForm.alert.saveFailedTitle'), error instanceof Error ? error.message : t('common.unexpectedError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.safeArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}>
          <ScrollView
            ref={scrollRef}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}>
            <SectionHeader title={title} description={description} />

            <Card className="gap-3">
              <FormField
                onLayout={handleLayout('name')}
                label={t('vehicleForm.field.name')}
                required
                hint={t('common.charCount', { current: trimmedLength(form.name), max: VEHICLE_NAME_MAX })}
                error={showError('name') ? errors.name : null}>
                <Input
                  value={form.name}
                  onChangeText={(value) => setForm((previous) => ({ ...previous, name: value.replace(/\n/g, ' ').slice(0, VEHICLE_NAME_MAX) }))}
                  onBlur={() => markTouched('name')}
                  placeholder={t('vehicleForm.placeholder.name')}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={VEHICLE_NAME_MAX}
                  tone={showError('name') ? 'destructive' : 'neutral'}
                />
              </FormField>

              <FormField
                onLayout={handleLayout('plate')}
                label={t('vehicleForm.field.plate')}
                required
                hint={t('common.charCount', { current: trimmedLength(form.plate), max: LICENSE_PLATE_MAX })}
                error={showError('plate') ? errors.plate : null}>
                <Input
                  value={form.plate}
                  onChangeText={(value) => setForm((previous) => ({ ...previous, plate: sanitizePlateInput(value, LICENSE_PLATE_MAX) }))}
                  onBlur={() => markTouched('plate')}
                  placeholder={t('vehicleForm.placeholder.plate')}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={LICENSE_PLATE_MAX}
                  tone={showError('plate') ? 'destructive' : 'neutral'}
                />
              </FormField>

              <FormField
                onLayout={handleLayout('currentOdometerKm')}
                label={t('vehicleForm.field.currentKm')}
                required
                error={showError('currentOdometerKm') ? errors.currentOdometerKm : null}>
                <Input
                  value={form.currentOdometerKm}
                  onChangeText={(value) =>
                    setForm((previous) => ({ ...previous, currentOdometerKm: sanitizeIntegerInput(value, 7) }))
                  }
                  onBlur={() => markTouched('currentOdometerKm')}
                  keyboardType="number-pad"
                  placeholder={t('vehicleForm.placeholder.currentKm')}
                  tone={showError('currentOdometerKm') ? 'destructive' : 'neutral'}
                />
              </FormField>

              <FormField
                onLayout={handleLayout('defaultFuelType')}
                label={t('vehicleForm.field.defaultFuelType')}
                required
                error={showError('defaultFuelType') ? errors.defaultFuelType : null}>
                <SelectField
                  options={fuelTypeOptions}
                  value={form.defaultFuelType || null}
                  onChange={(value) => {
                    setForm((previous) => ({ ...previous, defaultFuelType: value }));
                    markTouched('defaultFuelType');
                  }}
                />
              </FormField>

              <FormField onLayout={handleLayout('make')} label={t('vehicleForm.field.make')}>
                <Input
                  value={form.make}
                  onChangeText={(value) => setForm((previous) => ({ ...previous, make: value.replace(/\n/g, ' ').slice(0, TEXT_MAX) }))}
                  placeholder={t('vehicleForm.placeholder.make')}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={TEXT_MAX}
                />
              </FormField>

              <FormField onLayout={handleLayout('model')} label={t('vehicleForm.field.model')}>
                <Input
                  value={form.model}
                  onChangeText={(value) => setForm((previous) => ({ ...previous, model: value.replace(/\n/g, ' ').slice(0, TEXT_MAX) }))}
                  placeholder={t('vehicleForm.placeholder.model')}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={TEXT_MAX}
                />
              </FormField>

              <FormField onLayout={handleLayout('year')} label={t('vehicleForm.field.year')} error={showError('year') ? errors.year : null}>
                <YearPickerField
                  value={parseIntegerValue(form.year)}
                  onChange={(value) => {
                    setForm((previous) => ({ ...previous, year: value === null ? '' : String(value) }));
                    markTouched('year');
                  }}
                  onBlur={() => markTouched('year')}
                  minYear={YEAR_MIN}
                  maxYear={maxYear}
                  placeholder={t('vehicleForm.placeholder.year')}
                  clearable
                  tone={showError('year') ? 'destructive' : 'neutral'}
                />
              </FormField>

              <View style={styles.rowTwoCols}>
                <View style={styles.col}>
                  <FormField onLayout={handleLayout('ps')} label={t('vehicleForm.field.ps')} error={showError('ps') ? errors.ps : null}>
                    <Input
                      value={form.ps}
                      onChangeText={handlePsChange}
                      onBlur={() => markTouched('ps')}
                      keyboardType="number-pad"
                      placeholder={t('vehicleForm.placeholder.ps')}
                      tone={showError('ps') ? 'destructive' : 'neutral'}
                    />
                  </FormField>
                </View>

                <View style={styles.col}>
                  <FormField onLayout={handleLayout('kw')} label={t('vehicleForm.field.kw')} error={showError('kw') ? errors.kw : null}>
                    <Input
                      value={form.kw}
                      onChangeText={handleKwChange}
                      onBlur={() => markTouched('kw')}
                      keyboardType="number-pad"
                      placeholder={t('vehicleForm.placeholder.kw')}
                      tone={showError('kw') ? 'destructive' : 'neutral'}
                    />
                  </FormField>
                </View>
              </View>

              <FormField
                onLayout={handleLayout('engineDisplacementCc')}
                label={t('vehicleForm.field.displacement')}
                error={showError('engineDisplacementCc') ? errors.engineDisplacementCc : null}>
                <Input
                  value={form.engineDisplacementCc}
                  onChangeText={(value) =>
                    setForm((previous) => ({ ...previous, engineDisplacementCc: sanitizeIntegerInput(value, 5) }))
                  }
                  onBlur={() => markTouched('engineDisplacementCc')}
                  keyboardType="number-pad"
                  placeholder={t('vehicleForm.placeholder.displacement')}
                  tone={showError('engineDisplacementCc') ? 'destructive' : 'neutral'}
                />
              </FormField>

              <FormField onLayout={handleLayout('vin')} label={t('vehicleForm.field.vin')} error={showError('vin') ? errors.vin : null}>
                <Input
                  ref={vinInputRef}
                  value={form.vin}
                  onFocus={() => scrollToField('vin')}
                  onChangeText={(value) => setForm((previous) => ({ ...previous, vin: sanitizeVinInput(value) }))}
                  onBlur={() => markTouched('vin')}
                  placeholder={t('vehicleForm.placeholder.vin')}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={17}
                  tone={showError('vin') ? 'destructive' : 'neutral'}
                />
              </FormField>

              <FormField
                onLayout={handleLayout('engineTypeCode')}
                label={t('vehicleForm.field.engineCode')}
                hint={t('common.charCount', { current: trimmedLength(form.engineTypeCode), max: ENGINE_CODE_MAX })}
                error={showError('engineTypeCode') ? errors.engineTypeCode : null}>
                <Input
                  ref={engineCodeInputRef}
                  value={form.engineTypeCode}
                  onFocus={() => scrollToField('engineTypeCode')}
                  onChangeText={(value) =>
                    setForm((previous) => ({ ...previous, engineTypeCode: value.replace(/\n/g, ' ').slice(0, ENGINE_CODE_MAX) }))
                  }
                  onBlur={() => markTouched('engineTypeCode')}
                  placeholder={t('vehicleForm.placeholder.engineCode')}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={ENGINE_CODE_MAX}
                  tone={showError('engineTypeCode') ? 'destructive' : 'neutral'}
                />
              </FormField>
            </Card>

            <Button
              label={submitLabel}
              loading={saving}
              loadingLabel={submittingLabel}
              variant="primary"
              disabled={saving}
              leftIcon={({ color, size }) => <ActionIcon name="save" color={color} size={size} />}
              onPress={() => {
                void handleSave();
              }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
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
