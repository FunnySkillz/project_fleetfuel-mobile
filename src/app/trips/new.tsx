import { useHeaderHeight } from '@react-navigation/elements';
import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, View, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { VehiclePickerField } from '@/components/vehicle/vehicle-picker-field';
import { ActionIcon, Button, Card, DateTimeField, EmptyState, FormField, Input, SectionHeader, SelectField, TextArea } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { entriesRepo, tripsRepo, vehiclesRepo } from '@/data/repositories';
import type { TripPrivateTag, VehicleListItem } from '@/data/types';
import { useI18n } from '@/hooks/use-i18n';
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

function currentLocalTimeHHMM(date: Date = new Date()) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function AddTripScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const isFocused = useIsFocused();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ vehicleId?: string | string[] }>();
  const routeVehicleId = useMemo(() => {
    if (typeof params.vehicleId === 'string') {
      return params.vehicleId.trim();
    }
    if (Array.isArray(params.vehicleId)) {
      return params.vehicleId.map((entry) => entry.trim()).find((entry) => entry.length > 0) ?? '';
    }
    return '';
  }, [params.vehicleId]);

  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');

  const [effectiveCurrentKm, setEffectiveCurrentKm] = useState<number | null>(null);
  const [startSuggestionSource, setStartSuggestionSource] = useState<'latestEntry' | 'vehicleBaseline' | null>(null);
  const [startOdometer, setStartOdometer] = useState('');
  const [endOdometer, setEndOdometer] = useState('');
  const [purpose, setPurpose] = useState('');
  const [startTime, setStartTime] = useState('');
  const initialEndTimeRef = useRef(currentLocalTimeHHMM());
  const [endTime, setEndTime] = useState(initialEndTimeRef.current);
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [privateTag, setPrivateTag] = useState<TripPrivateTag>(null);
  const startOdometerEditedRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const notesFieldYRef = useRef(0);

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
          if (routeVehicleId.length > 0 && data.some((vehicle) => vehicle.id === routeVehicleId)) {
            return routeVehicleId;
          }
          if (current.length > 0 && data.some((vehicle) => vehicle.id === current)) {
            return current;
          }
          if (data.length === 1) {
            return data[0].id;
          }
          return '';
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
  }, [isFocused, routeVehicleId]);

  useEffect(() => {
    if (!selectedVehicleId) {
      setEffectiveCurrentKm(null);
      setStartSuggestionSource(null);
      startOdometerEditedRef.current = false;
      setStartOdometer('');
      return;
    }

    startOdometerEditedRef.current = false;
    setStartOdometer('');
    setEffectiveCurrentKm(null);
    setStartSuggestionSource(null);

    let cancelled = false;
    void entriesRepo
      .resolveEffectiveCurrentOdometer(selectedVehicleId)
      .then((resolved) => {
        if (cancelled) {
          return;
        }

        setEffectiveCurrentKm(resolved.value);
        setStartSuggestionSource(resolved.source);
        if (!startOdometerEditedRef.current) {
          setStartOdometer(String(resolved.value));
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setEffectiveCurrentKm(null);
        setStartSuggestionSource(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedVehicleId]);

  useEffect(() => {
    if (!selectedVehicleId) {
      if (vehicles.length === 1) {
        setSelectedVehicleId(vehicles[0].id);
      }
      return;
    }

    const exists = vehicles.some((vehicle) => vehicle.id === selectedVehicleId);
    if (!exists) {
      if (vehicles.length === 1) {
        setSelectedVehicleId(vehicles[0].id);
        return;
      }
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
      endTime.trim() !== initialEndTimeRef.current ||
      startLocation.trim().length > 0 ||
      endLocation.trim().length > 0 ||
      notes.trim().length > 0 ||
      privateTag !== null ||
      saving,
    [endLocation, endOdometer, endTime, notes, privateTag, purpose, saving, startLocation, startTime],
  );
  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty);

  const errors = useMemo<TripFormErrors>(() => {
    const result: TripFormErrors = {};
    const purposeLength = trimmedLength(purpose);
    const notesLength = trimmedLength(notes);
    const startLocationLength = trimmedLength(startLocation);
    const endLocationLength = trimmedLength(endLocation);

    if (!selectedVehicleId) {
      result.vehicleId = t('tripForm.error.vehicleRequired');
    }

    if (startOdometer.trim().length === 0) {
      result.startOdometer = t('tripForm.error.startKmRequired');
    } else if (startKmValue === null) {
      result.startOdometer = t('tripForm.error.startKmInteger');
    } else if (effectiveCurrentKm !== null && startKmValue < effectiveCurrentKm) {
      result.startOdometer = t('tripForm.error.startKmBelowLatest', { value: effectiveCurrentKm });
    }

    if (endOdometer.trim().length === 0) {
      result.endOdometer = t('tripForm.error.currentKmRequired');
    } else if (endKmValue === null) {
      result.endOdometer = t('tripForm.error.currentKmInteger');
    } else if (startKmValue !== null && endKmValue < startKmValue) {
      result.endOdometer = t('tripForm.error.currentKmBelowStart');
    } else if (startKmValue !== null && endKmValue === startKmValue) {
      result.endOdometer = t('tripForm.error.currentKmEqualStart');
    } else if (effectiveCurrentKm !== null && endKmValue < effectiveCurrentKm) {
      result.endOdometer = t('tripForm.error.currentKmBelowLatest', { value: effectiveCurrentKm });
    }

    if (purposeLength === 0) {
      result.purpose = t('tripForm.error.purposeRequired');
    } else if (purposeLength < PURPOSE_MIN) {
      result.purpose = t('tripForm.error.purposeMin', { min: PURPOSE_MIN });
    } else if (purposeLength > PURPOSE_MAX) {
      result.purpose = t('tripForm.error.purposeMax', { max: PURPOSE_MAX });
    }

    if (privateTag === null) {
      result.privateTag = t('tripForm.error.classificationRequired');
    }

    if (startTime.trim().length > 0 && !isValidTime(startTime.trim())) {
      result.startTime = t('tripForm.error.startTimeFormat');
    }

    if (endTime.trim().length > 0 && !isValidTime(endTime.trim())) {
      result.endTime = t('tripForm.error.endTimeFormat');
    }

    if (startTime.trim().length > 0 && endTime.trim().length > 0 && isValidTime(startTime.trim()) && isValidTime(endTime.trim())) {
      if (endTime.trim() < startTime.trim()) {
        result.endTime = t('tripForm.error.endTimeBeforeStart');
      }
    }

    if (startLocationLength > LOCATION_MAX) {
      result.startLocation = t('tripForm.error.startLocationMax', { max: LOCATION_MAX });
    }

    if (endLocationLength > LOCATION_MAX) {
      result.endLocation = t('tripForm.error.endLocationMax', { max: LOCATION_MAX });
    }

    if (notesLength > NOTES_MAX) {
      result.notes = t('tripForm.error.notesMax', { max: NOTES_MAX });
    }

    return result;
  }, [
    endKmValue,
    endLocation,
    endOdometer,
    endTime,
    effectiveCurrentKm,
    notes,
    privateTag,
    purpose,
    selectedVehicleId,
    startKmValue,
    startLocation,
    startOdometer,
    startTime,
    t,
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
      Alert.alert(t('common.checkFormTitle'), t('common.fixValidationErrors'));
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
      Alert.alert(t('tripForm.alert.saveFailedTitle'), error instanceof Error ? error.message : t('common.unexpectedError'));
    } finally {
      setSaving(false);
    }
  };

  const hasVehicles = vehicles.length > 0;
  const scrollToNotes = () => {
    scrollRef.current?.scrollTo({
      y: Math.max(0, notesFieldYRef.current - Spacing.two),
      animated: true,
    });
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
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}> 
            <SectionHeader
              title={t('tripForm.title')}
              description={t('tripForm.description')}
            />

            <Card className="gap-3">
            <FormField
              label={t('tripForm.vehicleLabel')}
              required
              error={showError('vehicleId') ? errors.vehicleId : null}
              hint={hasVehicles ? undefined : t('tripForm.vehicleHint')}>
              {vehiclesLoading ? (
                <Input value={t('common.loadingVehicles')} editable={false} variant="subtle" />
              ) : hasVehicles ? (
                <VehiclePickerField
                  vehicles={vehicles}
                  value={selectedVehicleId || null}
                  onChange={(value) => {
                    setSelectedVehicleId(value);
                    setTouched((prev) => ({ ...prev, vehicleId: true }));
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, vehicleId: true }))}
                  placeholder={t('common.selectVehicle')}
                  searchPlaceholder={t('common.searchVehicles')}
                  noResultsTitle={t('common.noVehiclesMatch')}
                  noResultsDescription={t('common.tryDifferentVehicleSearch')}
                  loading={vehiclesLoading}
                />
              ) : (
                <EmptyState
                  title={t('tripForm.noVehicle.title')}
                  description={t('tripForm.noVehicle.description')}
                  actionLabel={t('add.actionSheet.addVehicle')}
                  onAction={() => router.push('/vehicles/new')}
                />
              )}
            </FormField>

            <FormField
              label={t('tripForm.field.startKm')}
              required
              hint={
                effectiveCurrentKm !== null
                  ? startSuggestionSource === 'vehicleBaseline'
                    ? t('tripForm.hint.startKmBaseline', { value: effectiveCurrentKm })
                    : t('tripForm.hint.startKmLatest', { value: effectiveCurrentKm })
                  : t('tripForm.hint.startKmNoLatest')
              }
              error={showError('startOdometer') ? errors.startOdometer : null}>
              <Input
                value={startOdometer}
                onChangeText={(value) => {
                  startOdometerEditedRef.current = true;
                  setStartOdometer(sanitizeIntegerInput(value, ODOMETER_DIGITS));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, startOdometer: true }))}
                keyboardType="number-pad"
                placeholder={effectiveCurrentKm !== null ? String(effectiveCurrentKm) : t('tripForm.placeholder.currentKm')}
                tone={showError('startOdometer') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField
              label={t('tripForm.field.currentKm')}
              required
              error={showError('endOdometer') ? errors.endOdometer : null}>
              <Input
                value={endOdometer}
                onChangeText={(value) => setEndOdometer(sanitizeIntegerInput(value, ODOMETER_DIGITS))}
                onBlur={() => setTouched((prev) => ({ ...prev, endOdometer: true }))}
                keyboardType="number-pad"
                placeholder={t('tripForm.placeholder.currentKm')}
                tone={showError('endOdometer') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField label={t('tripForm.field.distanceReadonly')}>
              <Input
                value={distanceKm !== null ? t('tripForm.hint.distanceValue', { value: distanceKm }) : t('tripForm.hint.distancePending')}
                editable={false}
                variant="subtle"
              />
            </FormField>

            <FormField
              label={t('tripForm.field.purpose')}
              required
              hint={t('common.charCount', { current: trimmedLength(purpose), max: PURPOSE_MAX })}
              error={showError('purpose') ? errors.purpose : null}>
              <Input
                value={purpose}
                onChangeText={(value) => setPurpose(value.replace(/\n/g, ' ').slice(0, PURPOSE_MAX))}
                onBlur={() => setTouched((prev) => ({ ...prev, purpose: true }))}
                placeholder={t('tripForm.placeholder.purpose')}
                autoCapitalize="sentences"
                autoCorrect={false}
                maxLength={PURPOSE_MAX}
                tone={showError('purpose') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <View style={styles.rowTwoCols}>
              <View style={styles.col}>
                <FormField label={t('tripForm.field.startTime')} error={showError('startTime') ? errors.startTime : null}>
                  <DateTimeField
                    mode="time"
                    value={startTime}
                    onChangeText={(value) => setStartTime(sanitizeTimeInput(value))}
                    onBlur={() => setTouched((prev) => ({ ...prev, startTime: true }))}
                    onClear={() => {
                      setStartTime('');
                      setTouched((prev) => ({ ...prev, startTime: true }));
                    }}
                    clearable
                    placeholder={t('tripForm.placeholder.startTime')}
                    tone={showError('startTime') ? 'destructive' : 'neutral'}
                  />
                </FormField>
              </View>

              <View style={styles.col}>
                <FormField label={t('tripForm.field.endTime')} error={showError('endTime') ? errors.endTime : null}>
                  <DateTimeField
                    mode="time"
                    value={endTime}
                    onChangeText={(value) => setEndTime(sanitizeTimeInput(value))}
                    onBlur={() => setTouched((prev) => ({ ...prev, endTime: true }))}
                    onClear={() => {
                      setEndTime('');
                      setTouched((prev) => ({ ...prev, endTime: true }));
                    }}
                    clearable
                    placeholder={t('tripForm.placeholder.endTime')}
                    tone={showError('endTime') ? 'destructive' : 'neutral'}
                  />
                </FormField>
              </View>
            </View>

            <FormField label={t('tripForm.field.startLocation')} error={showError('startLocation') ? errors.startLocation : null}>
              <Input
                value={startLocation}
                onChangeText={(value) => setStartLocation(value.replace(/\n/g, ' ').slice(0, LOCATION_MAX))}
                onBlur={() => setTouched((prev) => ({ ...prev, startLocation: true }))}
                placeholder={t('tripForm.placeholder.startLocation')}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={LOCATION_MAX}
                tone={showError('startLocation') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField label={t('tripForm.field.endLocation')} error={showError('endLocation') ? errors.endLocation : null}>
              <Input
                value={endLocation}
                onChangeText={(value) => setEndLocation(value.replace(/\n/g, ' ').slice(0, LOCATION_MAX))}
                onBlur={() => setTouched((prev) => ({ ...prev, endLocation: true }))}
                placeholder={t('tripForm.placeholder.endLocation')}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={LOCATION_MAX}
                tone={showError('endLocation') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField
              label={t('tripForm.field.classification')}
              required
              hint={t('tripForm.hint.classification')}
              error={showError('privateTag') ? errors.privateTag : null}>
              <SelectField
                options={[
                  { value: 'business', label: t('tripForm.classification.business') },
                  { value: 'private', label: t('tripForm.classification.private') },
                ]}
                value={privateTag}
                onChange={(value) => {
                  setPrivateTag(value as Exclude<TripPrivateTag, null>);
                  setTouched((prev) => ({ ...prev, privateTag: true }));
                }}
              />
            </FormField>

              <FormField
                onLayout={(event) => {
                  notesFieldYRef.current = event.nativeEvent.layout.y;
                }}
                label={t('tripForm.field.notes')}
                hint={t('common.charCount', { current: trimmedLength(notes), max: NOTES_MAX })}
                error={showError('notes') ? errors.notes : null}>
                <TextArea
                  value={notes}
                  onChangeText={(value) => setNotes(value.slice(0, NOTES_MAX))}
                  onFocus={() => {
                    requestAnimationFrame(() => {
                      scrollToNotes();
                    });
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, notes: true }))}
                  placeholder={t('tripForm.placeholder.notes')}
                  autoCapitalize="sentences"
                  maxLength={NOTES_MAX}
                  tone={showError('notes') ? 'destructive' : 'neutral'}
                />
              </FormField>
            </Card>

            <Button
              label={t('tripForm.save')}
              loading={saving}
              loadingLabel={t('tripForm.saving')}
              variant="primary"
              disabled={!canSubmit}
              leftIcon={({ color, size }) => <ActionIcon name="save" color={color} size={size} />}
              onPress={() => void handleSave()}
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

