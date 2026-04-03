import { useIsFocused } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReasonRequiredModal } from '@/components/reason-required-modal';
import { ThemedView } from '@/components/themed-view';
import { VehiclePickerField } from '@/components/vehicle/vehicle-picker-field';
import { ActionIcon, Button, Card, EmptyState, FormField, Input, SectionHeader, SelectField, TextArea } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { fuelRepo, tripsRepo, vehiclesRepo, entriesRepo } from '@/data/repositories';
import type { EntryDetail, FuelType, ReceiptAttachment, TripPrivateTag, VehicleListItem } from '@/data/types';
import { useI18n } from '@/hooks/use-i18n';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { buildFuelTypeOptions } from '@/utils/fuel-type-options';
import { parseDecimalValue, parseIntegerValue, sanitizeDecimalInput, sanitizeIntegerInput, trimmedLength } from '@/utils/form-input';
import { copyReceiptToAppStorage } from '@/utils/receipt-files';

const PURPOSE_MIN = 3;
const PURPOSE_MAX = 100;
const LOCATION_MAX = 120;
const NOTES_MAX = 500;
const STATION_MIN = 2;
const STATION_MAX = 80;
const LITERS_MAX = 500;
const FUEL_IN_TANK_MAX = 2000;
const PRICE_MAX = 500000;

type FormTouched = Record<
  | 'vehicleId'
  | 'purpose'
  | 'startOdometer'
  | 'endOdometer'
  | 'privateTag'
  | 'startTime'
  | 'endTime'
  | 'startLocation'
  | 'endLocation'
  | 'fuelType'
  | 'liters'
  | 'fuelInTankAfterRefuel'
  | 'price'
  | 'station'
  | 'odometer'
  | 'notes'
  | 'receipt',
  boolean
>;

const EMPTY_TOUCHED: FormTouched = {
  vehicleId: false,
  purpose: false,
  startOdometer: false,
  endOdometer: false,
  privateTag: false,
  startTime: false,
  endTime: false,
  startLocation: false,
  endLocation: false,
  fuelType: false,
  liters: false,
  fuelInTankAfterRefuel: false,
  price: false,
  station: false,
  odometer: false,
  notes: false,
  receipt: false,
};

const FULL_TOUCHED: FormTouched = {
  vehicleId: true,
  purpose: true,
  startOdometer: true,
  endOdometer: true,
  privateTag: true,
  startTime: true,
  endTime: true,
  startLocation: true,
  endLocation: true,
  fuelType: true,
  liters: true,
  fuelInTankAfterRefuel: true,
  price: true,
  station: true,
  odometer: true,
  notes: true,
  receipt: true,
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function sanitizeTime(value: string) {
  return value.replace(/[^\d:]/g, '').slice(0, 5);
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

type FormState = {
  vehicleId: string;
  purpose: string;
  startOdometer: string;
  endOdometer: string;
  privateTag: TripPrivateTag;
  startTime: string;
  endTime: string;
  startLocation: string;
  endLocation: string;
  fuelType: FuelType | null;
  liters: string;
  fuelInTankAfterRefuel: string;
  price: string;
  station: string;
  odometer: string;
  notes: string;
};

function snapshotFromEntry(entry: EntryDetail): FormState {
  if (entry.type === 'trip') {
    return {
      vehicleId: entry.vehicleId,
      purpose: entry.purpose,
      startOdometer: String(entry.startOdometerKm),
      endOdometer: String(entry.endOdometerKm),
      privateTag: entry.privateTag,
      startTime: entry.startTime ?? '',
      endTime: entry.endTime ?? '',
      startLocation: entry.startLocation ?? '',
      endLocation: entry.endLocation ?? '',
      fuelType: null,
      liters: '',
      fuelInTankAfterRefuel: '',
      price: '',
      station: '',
      odometer: '',
      notes: entry.notes ?? '',
    };
  }

  return {
    vehicleId: entry.vehicleId,
    purpose: '',
    startOdometer: '',
    endOdometer: '',
    privateTag: null,
    startTime: '',
    endTime: '',
    startLocation: '',
    endLocation: '',
    fuelType: entry.fuelType,
    liters: String(entry.liters),
    fuelInTankAfterRefuel:
      entry.fuelInTankAfterRefuelLiters === null ? '' : String(entry.fuelInTankAfterRefuelLiters),
    price: String(entry.totalPrice),
    station: entry.station,
    odometer: entry.odometerKm === null ? '' : String(entry.odometerKm),
    notes: entry.notes ?? '',
  };
}

export default function EditEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ entryId?: string | string[] }>();
  const entryId = useMemo(() => {
    if (typeof params.entryId === 'string') {
      return params.entryId.trim();
    }
    if (Array.isArray(params.entryId)) {
      return params.entryId.map((value) => value.trim()).find((value) => value.length > 0) ?? '';
    }
    return '';
  }, [params.entryId]);

  const initialFormRef = useRef<FormState | null>(null);
  const initialReceiptRef = useRef<ReceiptAttachment | null>(null);
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [form, setForm] = useState<FormState>({
    vehicleId: '',
    purpose: '',
    startOdometer: '',
    endOdometer: '',
    privateTag: null,
    startTime: '',
    endTime: '',
    startLocation: '',
    endLocation: '',
    fuelType: null,
    liters: '',
    fuelInTankAfterRefuel: '',
    price: '',
    station: '',
    odometer: '',
    notes: '',
  });
  const [touched, setTouched] = useState<FormTouched>(EMPTY_TOUCHED);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptAttachment | null>(null);

  const fuelTypeOptions = useMemo(() => buildFuelTypeOptions(t), [t]);

  const loadData = useCallback(async () => {
    if (!entryId) {
      setStatus('error');
      setErrorMessage(t('entryEdit.errorMissingId'));
      return;
    }
    setStatus('loading');
    setVehiclesLoading(true);
    setErrorMessage(null);

    try {
      const [entryData, vehiclesData] = await Promise.all([entriesRepo.getById(entryId), vehiclesRepo.list()]);
      if (!entryData) {
        setStatus('error');
        setErrorMessage(t('entryEdit.errorNotFound'));
        return;
      }
      const snapshot = snapshotFromEntry(entryData);
      initialFormRef.current = snapshot;
      const loadedReceipt =
        entryData.type === 'fuel' && entryData.receiptUri
          ? {
              uri: entryData.receiptUri,
              name: entryData.receiptName ?? 'receipt',
              mimeType: entryData.receiptMimeType,
            }
          : null;
      initialReceiptRef.current = loadedReceipt;
      setEntry(entryData);
      setVehicles(vehiclesData);
      setForm(snapshot);
      setReceipt(loadedReceipt);
      setTouched(EMPTY_TOUCHED);
      setSubmitAttempted(false);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : t('entryEdit.errorLoadFailedFallback'));
    } finally {
      setVehiclesLoading(false);
    }
  }, [entryId, t]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    void loadData();
  }, [isFocused, loadData]);

  const startKm = parseIntegerValue(form.startOdometer);
  const endKm = parseIntegerValue(form.endOdometer);
  const liters = parseDecimalValue(form.liters);
  const tankAfter = parseDecimalValue(form.fuelInTankAfterRefuel);
  const price = parseDecimalValue(form.price);
  const odometer = parseIntegerValue(form.odometer);

  const errors = useMemo(() => {
    const result: Record<string, string> = {};
    if (!form.vehicleId) {
      result.vehicleId = t('tripForm.error.vehicleRequired');
    }

    if (entry?.type === 'trip') {
      if (!form.startOdometer.trim()) result.startOdometer = t('tripForm.error.startKmRequired');
      else if (startKm === null) result.startOdometer = t('tripForm.error.startKmInteger');
      if (!form.endOdometer.trim()) result.endOdometer = t('tripForm.error.currentKmRequired');
      else if (endKm === null) result.endOdometer = t('tripForm.error.currentKmInteger');
      else if (startKm !== null && endKm < startKm) result.endOdometer = t('tripForm.error.currentKmBelowStart');
      else if (startKm !== null && endKm === startKm) result.endOdometer = t('tripForm.error.currentKmEqualStart');
      const purposeLen = trimmedLength(form.purpose);
      if (purposeLen === 0) result.purpose = t('tripForm.error.purposeRequired');
      else if (purposeLen < PURPOSE_MIN) result.purpose = t('tripForm.error.purposeMin', { min: PURPOSE_MIN });
      else if (purposeLen > PURPOSE_MAX) result.purpose = t('tripForm.error.purposeMax', { max: PURPOSE_MAX });
      if (form.privateTag === null) result.privateTag = t('tripForm.error.classificationRequired');
      if (form.startTime.trim() && !isValidTime(form.startTime.trim())) result.startTime = t('tripForm.error.startTimeFormat');
      if (form.endTime.trim() && !isValidTime(form.endTime.trim())) result.endTime = t('tripForm.error.endTimeFormat');
      if (form.startTime.trim() && form.endTime.trim() && isValidTime(form.startTime.trim()) && isValidTime(form.endTime.trim())) {
        if (form.endTime.trim() < form.startTime.trim()) result.endTime = t('tripForm.error.endTimeBeforeStart');
      }
      if (trimmedLength(form.startLocation) > LOCATION_MAX) result.startLocation = t('tripForm.error.startLocationMax', { max: LOCATION_MAX });
      if (trimmedLength(form.endLocation) > LOCATION_MAX) result.endLocation = t('tripForm.error.endLocationMax', { max: LOCATION_MAX });
    }

    if (entry?.type === 'fuel') {
      if (!form.fuelType) result.fuelType = t('fuelForm.error.fuelTypeRequired');
      if (!form.liters.trim()) result.liters = t('fuelForm.error.litersRequired');
      else if (liters === null) result.liters = t('fuelForm.error.litersNumber');
      else if (liters <= 0) result.liters = t('fuelForm.error.litersPositive');
      else if (liters > LITERS_MAX) result.liters = t('fuelForm.error.litersMax', { max: LITERS_MAX });
      if (!form.fuelInTankAfterRefuel.trim()) result.fuelInTankAfterRefuel = t('fuelForm.error.fuelInTankAfterRefuelRequired');
      else if (tankAfter === null) result.fuelInTankAfterRefuel = t('fuelForm.error.fuelInTankAfterRefuelNumber');
      else if (tankAfter < 0) result.fuelInTankAfterRefuel = t('fuelForm.error.fuelInTankAfterRefuelNonNegative');
      else if (tankAfter > FUEL_IN_TANK_MAX) result.fuelInTankAfterRefuel = t('fuelForm.error.fuelInTankAfterRefuelMax', { max: FUEL_IN_TANK_MAX });
      if (!form.price.trim()) result.price = t('fuelForm.error.priceRequired');
      else if (price === null) result.price = t('fuelForm.error.priceNumber');
      else if (price <= 0) result.price = t('fuelForm.error.pricePositive');
      else if (price > PRICE_MAX) result.price = t('fuelForm.error.priceMax', { max: PRICE_MAX });
      const stationLen = trimmedLength(form.station);
      if (stationLen === 0) result.station = t('fuelForm.error.stationRequired');
      else if (stationLen < STATION_MIN) result.station = t('fuelForm.error.stationMin', { min: STATION_MIN });
      else if (stationLen > STATION_MAX) result.station = t('fuelForm.error.stationMax', { max: STATION_MAX });
      if (!form.odometer.trim()) result.odometer = t('fuelForm.error.currentKmRequired');
      else if (odometer === null) result.odometer = t('fuelForm.error.currentKmInteger');
    }

    if (trimmedLength(form.notes) > NOTES_MAX) {
      result.notes = t('tripForm.error.notesMax', { max: NOTES_MAX });
    }
    return result;
  }, [entry?.type, endKm, form, liters, odometer, price, startKm, t, tankAfter]);

  const isValid = Object.values(errors).every((value) => !value);
  const isDirty = useMemo(() => {
    if (!initialFormRef.current) {
      return false;
    }

    const formChanged = JSON.stringify(form) !== JSON.stringify(initialFormRef.current);
    const receiptChanged =
      JSON.stringify(receipt ?? null) !== JSON.stringify(initialReceiptRef.current ?? null);
    return formChanged || receiptChanged;
  }, [form, receipt]);
  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty || saving || attachmentBusy);

  const showError = (field: keyof FormTouched) => (submitAttempted || touched[field]) && Boolean(errors[field]);
  const hasVehicles = vehicles.length > 0;
  const canSubmit = status === 'ready' && Boolean(entry) && isDirty && isValid && !saving && !attachmentBusy;

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleSave = () => {
    if (saving || attachmentBusy || !entry) {
      return;
    }
    setSubmitAttempted(true);
    setTouched(FULL_TOUCHED);
    if (!isValid) {
      Alert.alert(t('common.checkFormTitle'), t('common.fixValidationErrors'));
      return;
    }
    setReasonModalVisible(true);
  };

  const submitWithReason = async (reason: string) => {
    if (!entry || saving || attachmentBusy) {
      return;
    }
    setSaving(true);
    try {
      if (entry.type === 'trip') {
        if (startKm === null || endKm === null) {
          throw new Error(t('common.fixValidationErrors'));
        }
        await tripsRepo.update(
          entry.id,
          {
            vehicleId: form.vehicleId,
            purpose: normalizeText(form.purpose),
            startOdometerKm: startKm,
            endOdometerKm: endKm,
            startTime: normalizeText(form.startTime) || null,
            endTime: normalizeText(form.endTime) || null,
            startLocation: normalizeText(form.startLocation) || null,
            endLocation: normalizeText(form.endLocation) || null,
            notes: normalizeText(form.notes) || null,
            privateTag: form.privateTag,
          },
          { reason },
        );
      } else {
        if (liters === null || tankAfter === null || price === null || odometer === null) {
          throw new Error(t('common.fixValidationErrors'));
        }
        await fuelRepo.update(
          entry.id,
          {
            vehicleId: form.vehicleId,
            fuelType: form.fuelType,
            liters,
            fuelInTankAfterRefuelLiters: tankAfter,
            totalPrice: price,
            station: normalizeText(form.station),
            odometerKm: odometer,
            receipt,
            notes: normalizeText(form.notes) || null,
          },
          { reason },
        );
      }
      setReasonModalVisible(false);
      allowNextNavigation();
      router.back();
    } catch (error) {
      Alert.alert(t('entryEdit.saveFailedTitle'), error instanceof Error ? error.message : t('common.unexpectedError'));
    } finally {
      setSaving(false);
    }
  };

  const attachFromCamera = async () => {
    if (attachmentBusy) {
      return;
    }

    setAttachmentBusy(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('fuelForm.alert.cameraPermissionTitle'), t('fuelForm.alert.cameraPermissionMessage'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const copied = await copyReceiptToAppStorage({
        sourceUri: asset.uri,
        preferredName: asset.fileName ?? 'receipt_photo.jpg',
        prefix: 'receipt_photo',
      });

      setReceipt({
        uri: copied.uri,
        name: copied.name,
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      setTouched((prev) => ({ ...prev, receipt: true }));
    } catch (error) {
      Alert.alert(t('fuelForm.alert.attachPhotoFailedTitle'), error instanceof Error ? error.message : t('common.unexpectedError'));
    } finally {
      setAttachmentBusy(false);
    }
  };

  const attachFromGallery = async () => {
    if (attachmentBusy) {
      return;
    }

    setAttachmentBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('fuelForm.alert.photosPermissionTitle'), t('fuelForm.alert.photosPermissionMessage'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const copied = await copyReceiptToAppStorage({
        sourceUri: asset.uri,
        preferredName: asset.fileName ?? 'receipt_gallery.jpg',
        prefix: 'receipt_photo',
      });

      setReceipt({
        uri: copied.uri,
        name: copied.name,
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      setTouched((prev) => ({ ...prev, receipt: true }));
    } catch (error) {
      Alert.alert(t('fuelForm.alert.attachImageFailedTitle'), error instanceof Error ? error.message : t('common.unexpectedError'));
    } finally {
      setAttachmentBusy(false);
    }
  };

  const attachPdf = async () => {
    if (attachmentBusy) {
      return;
    }

    setAttachmentBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const copied = await copyReceiptToAppStorage({
        sourceUri: asset.uri,
        preferredName: asset.name ?? 'receipt.pdf',
        prefix: 'receipt_pdf',
      });

      setReceipt({
        uri: copied.uri,
        name: copied.name,
        mimeType: asset.mimeType ?? 'application/pdf',
      });
      setTouched((prev) => ({ ...prev, receipt: true }));
    } catch (error) {
      Alert.alert(t('fuelForm.alert.attachPdfFailedTitle'), error instanceof Error ? error.message : t('common.unexpectedError'));
    } finally {
      setAttachmentBusy(false);
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
            title={t('entryEdit.title')}
            description={entry ? t('entryEdit.descriptionLoaded', { id: entry.id }) : t('entryEdit.descriptionLoading')}
          />

          {status === 'loading' ? (
            <Card>
              <Input value={t('entryEdit.loading')} editable={false} variant="subtle" />
            </Card>
          ) : status === 'error' || !entry ? (
            <Card tone="destructive" className="gap-2">
              <FormField label={t('entryEdit.loadErrorLabel')} error={errorMessage ?? t('common.unexpectedError')}>
                <Input value={t('entryEdit.errorLoadTitle')} editable={false} variant="subtle" tone="destructive" />
              </FormField>
              <Button label={t('common.retry')} variant="ghost" tone="destructive" onPress={() => void loadData()} className="self-start" />
            </Card>
          ) : (
            <Card className="gap-3">
              <FormField label={t('tripForm.vehicleLabel')} required error={showError('vehicleId') ? errors.vehicleId : null}>
                {vehiclesLoading ? (
                  <Input value={t('common.loadingVehicles')} editable={false} variant="subtle" />
                ) : hasVehicles ? (
                  <VehiclePickerField
                    vehicles={vehicles}
                    value={form.vehicleId || null}
                    onChange={(value) => {
                      updateField('vehicleId', value);
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

              {entry.type === 'trip' ? (
                <>
                  <FormField label={t('tripForm.field.startKm')} required error={showError('startOdometer') ? errors.startOdometer : null}>
                    <Input
                      value={form.startOdometer}
                      onChangeText={(value) => updateField('startOdometer', sanitizeIntegerInput(value, 7))}
                      onBlur={() => setTouched((prev) => ({ ...prev, startOdometer: true }))}
                      keyboardType="number-pad"
                      placeholder={t('tripForm.placeholder.currentKm')}
                      tone={showError('startOdometer') ? 'destructive' : 'neutral'}
                    />
                  </FormField>
                  <FormField label={t('tripForm.field.currentKm')} required error={showError('endOdometer') ? errors.endOdometer : null}>
                    <Input
                      value={form.endOdometer}
                      onChangeText={(value) => updateField('endOdometer', sanitizeIntegerInput(value, 7))}
                      onBlur={() => setTouched((prev) => ({ ...prev, endOdometer: true }))}
                      keyboardType="number-pad"
                      placeholder={t('tripForm.placeholder.currentKm')}
                      tone={showError('endOdometer') ? 'destructive' : 'neutral'}
                    />
                  </FormField>
                  <FormField
                    label={t('tripForm.field.purpose')}
                    required
                    hint={t('common.charCount', { current: trimmedLength(form.purpose), max: PURPOSE_MAX })}
                    error={showError('purpose') ? errors.purpose : null}>
                    <Input
                      value={form.purpose}
                      onChangeText={(value) => updateField('purpose', value.replace(/\n/g, ' ').slice(0, PURPOSE_MAX))}
                      onBlur={() => setTouched((prev) => ({ ...prev, purpose: true }))}
                      placeholder={t('tripForm.placeholder.purpose')}
                      tone={showError('purpose') ? 'destructive' : 'neutral'}
                    />
                  </FormField>
                  <View style={styles.rowTwoCols}>
                    <View style={styles.col}>
                      <FormField label={t('tripForm.field.startTime')} error={showError('startTime') ? errors.startTime : null}>
                        <Input
                          value={form.startTime}
                          onChangeText={(value) => updateField('startTime', sanitizeTime(value))}
                          onBlur={() => setTouched((prev) => ({ ...prev, startTime: true }))}
                          placeholder={t('tripForm.placeholder.startTime')}
                          tone={showError('startTime') ? 'destructive' : 'neutral'}
                        />
                      </FormField>
                    </View>
                    <View style={styles.col}>
                      <FormField label={t('tripForm.field.endTime')} error={showError('endTime') ? errors.endTime : null}>
                        <Input
                          value={form.endTime}
                          onChangeText={(value) => updateField('endTime', sanitizeTime(value))}
                          onBlur={() => setTouched((prev) => ({ ...prev, endTime: true }))}
                          placeholder={t('tripForm.placeholder.endTime')}
                          tone={showError('endTime') ? 'destructive' : 'neutral'}
                        />
                      </FormField>
                    </View>
                  </View>
                  <FormField label={t('tripForm.field.startLocation')} error={showError('startLocation') ? errors.startLocation : null}>
                    <Input
                      value={form.startLocation}
                      onChangeText={(value) => updateField('startLocation', value.replace(/\n/g, ' ').slice(0, LOCATION_MAX))}
                      onBlur={() => setTouched((prev) => ({ ...prev, startLocation: true }))}
                      placeholder={t('tripForm.placeholder.startLocation')}
                      tone={showError('startLocation') ? 'destructive' : 'neutral'}
                    />
                  </FormField>
                  <FormField label={t('tripForm.field.endLocation')} error={showError('endLocation') ? errors.endLocation : null}>
                    <Input
                      value={form.endLocation}
                      onChangeText={(value) => updateField('endLocation', value.replace(/\n/g, ' ').slice(0, LOCATION_MAX))}
                      onBlur={() => setTouched((prev) => ({ ...prev, endLocation: true }))}
                      placeholder={t('tripForm.placeholder.endLocation')}
                      tone={showError('endLocation') ? 'destructive' : 'neutral'}
                    />
                  </FormField>
                  <FormField
                    label={t('tripForm.field.classification')}
                    required
                    error={showError('privateTag') ? errors.privateTag : null}>
                    <SelectField
                      options={[
                        { value: 'business', label: t('tripForm.classification.business') },
                        { value: 'private', label: t('tripForm.classification.private') },
                      ]}
                      value={form.privateTag}
                      onChange={(value) => {
                        updateField('privateTag', value as Exclude<TripPrivateTag, null>);
                        setTouched((prev) => ({ ...prev, privateTag: true }));
                      }}
                    />
                  </FormField>
                </>
              ) : (
                <>
                  <FormField label={t('fuelForm.field.fuelType')} required error={showError('fuelType') ? errors.fuelType : null}>
                    <SelectField
                      options={fuelTypeOptions}
                      value={form.fuelType}
                      onChange={(value) => {
                        updateField('fuelType', value as FuelType);
                        setTouched((prev) => ({ ...prev, fuelType: true }));
                      }}
                    />
                  </FormField>
                  <FormField label={t('fuelForm.field.currentKm')} required error={showError('odometer') ? errors.odometer : null}>
                    <Input
                      value={form.odometer}
                      onChangeText={(value) => updateField('odometer', sanitizeIntegerInput(value, 7))}
                      onBlur={() => setTouched((prev) => ({ ...prev, odometer: true }))}
                      keyboardType="number-pad"
                      placeholder={t('fuelForm.placeholder.currentKm')}
                      tone={showError('odometer') ? 'destructive' : 'neutral'}
                    />
                  </FormField>
                  <FormField label={t('fuelForm.field.liters')} required error={showError('liters') ? errors.liters : null}>
                    <Input
                      value={form.liters}
                      onChangeText={(value) => updateField('liters', sanitizeDecimalInput(value, 3, 2))}
                      onBlur={() => setTouched((prev) => ({ ...prev, liters: true }))}
                      keyboardType="decimal-pad"
                      placeholder={t('fuelForm.placeholder.liters')}
                      tone={showError('liters') ? 'destructive' : 'neutral'}
                    />
                  </FormField>
                  <FormField
                    label={t('fuelForm.field.fuelInTankAfterRefuel')}
                    required
                    error={showError('fuelInTankAfterRefuel') ? errors.fuelInTankAfterRefuel : null}>
                    <Input
                      value={form.fuelInTankAfterRefuel}
                      onChangeText={(value) => updateField('fuelInTankAfterRefuel', sanitizeDecimalInput(value, 4, 2))}
                      onBlur={() => setTouched((prev) => ({ ...prev, fuelInTankAfterRefuel: true }))}
                      keyboardType="decimal-pad"
                      placeholder={t('fuelForm.placeholder.fuelInTankAfterRefuel')}
                      tone={showError('fuelInTankAfterRefuel') ? 'destructive' : 'neutral'}
                    />
                  </FormField>
                  <FormField label={t('fuelForm.field.price')} required error={showError('price') ? errors.price : null}>
                    <Input
                      value={form.price}
                      onChangeText={(value) => updateField('price', sanitizeDecimalInput(value, 6, 2))}
                      onBlur={() => setTouched((prev) => ({ ...prev, price: true }))}
                      keyboardType="decimal-pad"
                      placeholder={t('fuelForm.placeholder.price')}
                      tone={showError('price') ? 'destructive' : 'neutral'}
                    />
                  </FormField>
                  <FormField
                    label={t('fuelForm.field.station')}
                    required
                    hint={t('common.charCount', { current: trimmedLength(form.station), max: STATION_MAX })}
                    error={showError('station') ? errors.station : null}>
                    <Input
                      value={form.station}
                      onChangeText={(value) => updateField('station', value.replace(/\n/g, ' ').slice(0, STATION_MAX))}
                      onBlur={() => setTouched((prev) => ({ ...prev, station: true }))}
                      placeholder={t('fuelForm.placeholder.station')}
                      tone={showError('station') ? 'destructive' : 'neutral'}
                    />
                  </FormField>

                  <FormField label={t('fuelForm.field.receipt')} hint={t('fuelForm.receiptHint')}>
                    <Card variant="subtle" className="gap-2">
                      <Button
                        label={t('fuelForm.takePhoto')}
                        variant="secondary"
                        size="sm"
                        disabled={attachmentBusy}
                        onPress={() => {
                          void attachFromCamera();
                        }}
                      />
                      <Button
                        label={t('fuelForm.uploadPhoto')}
                        variant="secondary"
                        size="sm"
                        disabled={attachmentBusy}
                        onPress={() => {
                          void attachFromGallery();
                        }}
                      />
                      <Button
                        label={t('fuelForm.uploadPdf')}
                        variant="secondary"
                        size="sm"
                        disabled={attachmentBusy}
                        onPress={() => {
                          void attachPdf();
                        }}
                      />
                    </Card>

                    {receipt ? (
                      <Card variant="subtle" className="mt-2 gap-1.5">
                        <Input value={receipt.name} editable={false} variant="ghost" />
                        <Button
                          label={t('fuelForm.removeReceipt')}
                          variant="ghost"
                          size="sm"
                          className="self-start"
                          onPress={() => {
                            setReceipt(null);
                            setTouched((prev) => ({ ...prev, receipt: true }));
                          }}
                        />
                      </Card>
                    ) : null}
                  </FormField>
                </>
              )}

              <FormField
                label={t('entryEdit.notesLabel')}
                hint={t('common.charCount', { current: trimmedLength(form.notes), max: NOTES_MAX })}
                error={showError('notes') ? errors.notes : null}>
                <TextArea
                  value={form.notes}
                  onChangeText={(value) => updateField('notes', value.slice(0, NOTES_MAX))}
                  onBlur={() => setTouched((prev) => ({ ...prev, notes: true }))}
                  placeholder={t('entryEdit.notesPlaceholder')}
                  tone={showError('notes') ? 'destructive' : 'neutral'}
                />
              </FormField>
            </Card>
          )}

          <Button
            label={t('entryEdit.saveAction')}
            variant="primary"
            loading={saving}
            loadingLabel={t('entryEdit.saving')}
            disabled={!canSubmit}
            leftIcon={({ color, size }) => <ActionIcon name="save" color={color} size={size} />}
            onPress={handleSave}
          />
        </ScrollView>

        <ReasonRequiredModal
          visible={reasonModalVisible}
          title={entry?.type === 'trip' ? t('audit.reason.tripUpdateTitle') : t('audit.reason.fuelUpdateTitle')}
          description={entry?.type === 'trip' ? t('audit.reason.tripUpdateDescription') : t('audit.reason.fuelUpdateDescription')}
          confirmLabel={t('audit.reason.saveAction')}
          submitting={saving}
          onCancel={() => {
            if (!saving) setReasonModalVisible(false);
          }}
          onConfirm={(reason) => {
            void submitWithReason(reason);
          }}
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
