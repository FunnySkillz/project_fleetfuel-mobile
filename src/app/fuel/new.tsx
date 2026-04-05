import { useIsFocused } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { VehiclePickerField } from '@/components/vehicle/vehicle-picker-field';
import { ActionIcon, Button, Card, EmptyState, FormField, Input, SectionHeader, SelectField, TextArea } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { entriesRepo, fuelRepo, vehiclesRepo } from '@/data/repositories';
import type { FuelType, ReceiptAttachment, VehicleListItem } from '@/data/types';
import { useI18n } from '@/hooks/use-i18n';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { buildFuelTypeOptions } from '@/utils/fuel-type-options';
import {
  parseDecimalValue,
  parseIntegerValue,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
  trimmedLength,
} from '@/utils/form-input';
import { copyReceiptToAppStorage } from '@/utils/receipt-files';

const LITERS_INTEGER_DIGITS = 3;
const LITERS_FRACTION_DIGITS = 2;
const LITERS_MAX = 500;
const FUEL_IN_TANK_INTEGER_DIGITS = 4;
const FUEL_IN_TANK_FRACTION_DIGITS = 2;
const FUEL_IN_TANK_MAX = 2000;
const PRICE_INTEGER_DIGITS = 6;
const PRICE_FRACTION_DIGITS = 2;
const PRICE_MAX = 500000;
const STATION_MIN = 2;
const STATION_MAX = 80;
const NOTES_MAX = 500;
const ODOMETER_DIGITS = 7;

type FuelFormErrors = {
  vehicleId?: string;
  fuelType?: string;
  liters?: string;
  fuelInTankAfterRefuel?: string;
  price?: string;
  station?: string;
  odometer?: string;
  notes?: string;
  receipt?: string;
};

type FuelDraft = {
  selectedVehicleId: string;
  fuelType: FuelType | null;
  liters: string;
  fuelInTankAfterRefuel: string;
  price: string;
  station: string;
  odometer: string;
  notes: string;
  receipt: {
    uri: string;
    name: string;
    mimeType: string | null;
  } | null;
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function calculateAvgConsumption(liters: number | null, odometerKm: number | null, previousFuelKm: number | null) {
  if (liters === null || odometerKm === null || previousFuelKm === null) {
    return null;
  }

  const distanceKm = odometerKm - previousFuelKm;
  if (distanceKm <= 0) {
    return null;
  }

  const avg = (liters / distanceKm) * 100;
  return Math.round(avg * 100) / 100;
}

export default function AddFuelEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const [latestRecordedKm, setLatestRecordedKm] = useState<number | null>(null);
  const [odometerSuggestionSource, setOdometerSuggestionSource] = useState<'latestEntry' | 'vehicleBaseline' | null>(null);
  const [previousFuelKm, setPreviousFuelKm] = useState<number | null>(null);
  const [odometerSuggestionLoading, setOdometerSuggestionLoading] = useState(false);
  const odometerEditedRef = useRef(false);
  const userInteractedRef = useRef(false);
  const systemDraftJsonRef = useRef<string | null>(null);
  const [initialDraftJson, setInitialDraftJson] = useState<string | null>(null);

  const [liters, setLiters] = useState('');
  const [fuelInTankAfterRefuel, setFuelInTankAfterRefuel] = useState('');
  const [price, setPrice] = useState('');
  const [station, setStation] = useState('');
  const [odometer, setOdometer] = useState('');
  const [fuelType, setFuelType] = useState<FuelType | null>(null);
  const [fuelTypeManuallyEdited, setFuelTypeManuallyEdited] = useState(false);
  const previousVehicleIdRef = useRef('');
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<ReceiptAttachment | null>(null);

  const [saving, setSaving] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({
    vehicleId: false,
    fuelType: false,
    liters: false,
    fuelInTankAfterRefuel: false,
    price: false,
    station: false,
    odometer: false,
    notes: false,
    receipt: false,
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
      setLatestRecordedKm(null);
      setOdometerSuggestionSource(null);
      setPreviousFuelKm(null);
      setOdometerSuggestionLoading(false);
      odometerEditedRef.current = false;
      setOdometer('');
      return;
    }

    odometerEditedRef.current = false;
    setOdometer('');
    setOdometerSuggestionLoading(true);
    let cancelled = false;
    void Promise.all([
      entriesRepo.resolveEffectiveCurrentOdometer(selectedVehicleId),
      fuelRepo.getLatestFuelOdometerKmForVehicle(selectedVehicleId),
    ])
      .then(([resolvedCurrent, previousFuel]) => {
        if (cancelled) {
          return;
        }

        setLatestRecordedKm(resolvedCurrent.value);
        setOdometerSuggestionSource(resolvedCurrent.source);
        setPreviousFuelKm(previousFuel);
        if (!odometerEditedRef.current && resolvedCurrent.value !== null) {
          setOdometer(String(resolvedCurrent.value));
        } else if (!odometerEditedRef.current) {
          setOdometer('');
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setLatestRecordedKm(null);
        setOdometerSuggestionSource(null);
        setPreviousFuelKm(null);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setOdometerSuggestionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedVehicleId]);

  useEffect(() => {
    if (previousVehicleIdRef.current === selectedVehicleId) {
      return;
    }

    previousVehicleIdRef.current = selectedVehicleId;
    setFuelTypeManuallyEdited(false);
  }, [selectedVehicleId]);

  useEffect(() => {
    if (fuelTypeManuallyEdited) {
      return;
    }
    if (!selectedVehicleId) {
      setFuelType(null);
      return;
    }

    const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId);
    setFuelType(selectedVehicle?.defaultFuelType ?? null);
  }, [fuelTypeManuallyEdited, selectedVehicleId, vehicles]);

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

  const litersValue = parseDecimalValue(liters);
  const fuelInTankAfterRefuelValue = parseDecimalValue(fuelInTankAfterRefuel);
  const priceValue = parseDecimalValue(price);
  const odometerValue = parseIntegerValue(odometer);
  const avgConsumptionPreview = calculateAvgConsumption(litersValue, odometerValue, previousFuelKm);
  const fuelTypeOptions = useMemo(() => buildFuelTypeOptions(t), [t]);

  const currentDraft = useMemo<FuelDraft>(
    () => ({
      selectedVehicleId,
      fuelType,
      liters,
      fuelInTankAfterRefuel,
      price,
      station,
      odometer,
      notes,
      receipt: receipt
        ? {
            uri: receipt.uri,
            name: receipt.name,
            mimeType: receipt.mimeType ?? null,
          }
        : null,
    }),
    [fuelInTankAfterRefuel, fuelType, liters, notes, odometer, price, receipt, selectedVehicleId, station],
  );
  const currentDraftJson = useMemo(() => JSON.stringify(currentDraft), [currentDraft]);
  const defaultsSettled = !vehiclesLoading && (!selectedVehicleId || !odometerSuggestionLoading);

  useEffect(() => {
    if (!userInteractedRef.current) {
      systemDraftJsonRef.current = currentDraftJson;
    }
  }, [currentDraftJson]);

  useEffect(() => {
    if (initialDraftJson !== null || !defaultsSettled) {
      return;
    }

    setInitialDraftJson(systemDraftJsonRef.current ?? currentDraftJson);
  }, [currentDraftJson, defaultsSettled, initialDraftJson]);

  const isDirty = useMemo(
    () =>
      (initialDraftJson !== null && currentDraftJson !== initialDraftJson) ||
      saving ||
      attachmentBusy,
    [attachmentBusy, currentDraftJson, initialDraftJson, saving],
  );
  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty);

  const errors = useMemo<FuelFormErrors>(() => {
    const result: FuelFormErrors = {};

    if (!selectedVehicleId) {
      result.vehicleId = t('fuelForm.error.vehicleRequired');
    }

    if (!fuelType) {
      result.fuelType = t('fuelForm.error.fuelTypeRequired');
    }

    if (liters.trim().length === 0) {
      result.liters = t('fuelForm.error.litersRequired');
    } else if (litersValue === null) {
      result.liters = t('fuelForm.error.litersNumber');
    } else if (litersValue <= 0) {
      result.liters = t('fuelForm.error.litersPositive');
    } else if (litersValue > LITERS_MAX) {
      result.liters = t('fuelForm.error.litersMax', { max: LITERS_MAX });
    }

    if (fuelInTankAfterRefuel.trim().length === 0) {
      result.fuelInTankAfterRefuel = t('fuelForm.error.fuelInTankAfterRefuelRequired');
    } else if (fuelInTankAfterRefuelValue === null) {
      result.fuelInTankAfterRefuel = t('fuelForm.error.fuelInTankAfterRefuelNumber');
    } else if (fuelInTankAfterRefuelValue < 0) {
      result.fuelInTankAfterRefuel = t('fuelForm.error.fuelInTankAfterRefuelNonNegative');
    } else if (fuelInTankAfterRefuelValue > FUEL_IN_TANK_MAX) {
      result.fuelInTankAfterRefuel = t('fuelForm.error.fuelInTankAfterRefuelMax', { max: FUEL_IN_TANK_MAX });
    }

    if (price.trim().length === 0) {
      result.price = t('fuelForm.error.priceRequired');
    } else if (priceValue === null) {
      result.price = t('fuelForm.error.priceNumber');
    } else if (priceValue <= 0) {
      result.price = t('fuelForm.error.pricePositive');
    } else if (priceValue > PRICE_MAX) {
      result.price = t('fuelForm.error.priceMax', { max: PRICE_MAX });
    }

    const stationLength = trimmedLength(station);
    if (stationLength === 0) {
      result.station = t('fuelForm.error.stationRequired');
    } else if (stationLength < STATION_MIN) {
      result.station = t('fuelForm.error.stationMin', { min: STATION_MIN });
    } else if (stationLength > STATION_MAX) {
      result.station = t('fuelForm.error.stationMax', { max: STATION_MAX });
    }

    if (odometer.trim().length === 0) {
      result.odometer = t('fuelForm.error.currentKmRequired');
    } else if (odometerValue === null) {
      result.odometer = t('fuelForm.error.currentKmInteger');
    } else if (latestRecordedKm !== null && odometerValue < latestRecordedKm) {
      result.odometer = t('fuelForm.error.currentKmBelowLatest', { value: latestRecordedKm });
    }

    if (trimmedLength(notes) > NOTES_MAX) {
      result.notes = t('fuelForm.error.notesMax', { max: NOTES_MAX });
    }

    if (receipt && !receipt.uri) {
      result.receipt = t('fuelForm.error.receiptInvalid');
    }

    return result;
  }, [
    fuelInTankAfterRefuel,
    fuelInTankAfterRefuelValue,
    fuelType,
    latestRecordedKm,
    liters,
    litersValue,
    notes,
    odometer,
    odometerValue,
    price,
    priceValue,
    receipt,
    selectedVehicleId,
    station,
    t,
  ]);

  const isValid =
    !errors.vehicleId &&
    !errors.fuelType &&
    !errors.liters &&
    !errors.fuelInTankAfterRefuel &&
    !errors.price &&
    !errors.station &&
    !errors.odometer &&
    !errors.notes &&
    !errors.receipt;

  const canSubmit = isValid && !saving && !attachmentBusy;
  const showError = (field: keyof typeof touched) => (submitAttempted || touched[field]) && Boolean(errors[field]);
  const markUserInteracted = () => {
    userInteractedRef.current = true;
  };

  const handleSave = async () => {
    if (saving || attachmentBusy) {
      return;
    }

    setSubmitAttempted(true);
    setTouched({
      vehicleId: true,
      fuelType: true,
      liters: true,
      fuelInTankAfterRefuel: true,
      price: true,
      station: true,
      odometer: true,
      notes: true,
      receipt: true,
    });

    if (
      !isValid ||
      litersValue === null ||
      fuelInTankAfterRefuelValue === null ||
      priceValue === null ||
      odometerValue === null
    ) {
      Alert.alert(t('common.checkFormTitle'), t('common.fixValidationErrors'));
      return;
    }

    setSaving(true);
    try {
      await fuelRepo.create({
        vehicleId: selectedVehicleId,
        fuelType,
        liters: litersValue,
        fuelInTankAfterRefuelLiters: fuelInTankAfterRefuelValue,
        totalPrice: priceValue,
        station: normalizeText(station),
        odometerKm: odometerValue,
        receipt,
        notes: normalizeText(notes) || null,
      });

      setInitialDraftJson(currentDraftJson);
      allowNextNavigation();
      router.back();
    } catch (error) {
      Alert.alert(t('fuelForm.alert.saveFailedTitle'), error instanceof Error ? error.message : t('common.unexpectedError'));
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
      markUserInteracted();
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
      markUserInteracted();
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
      markUserInteracted();
      setTouched((prev) => ({ ...prev, receipt: true }));
    } catch (error) {
      Alert.alert(t('fuelForm.alert.attachPdfFailedTitle'), error instanceof Error ? error.message : t('common.unexpectedError'));
    } finally {
      setAttachmentBusy(false);
    }
  };

  const hasVehicles = vehicles.length > 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}> 
          <SectionHeader
            title={t('fuelForm.title')}
            description={t('fuelForm.description')}
          />

          <Card className="gap-3">
            <FormField
              label={t('fuelForm.vehicleLabel')}
              required
              error={showError('vehicleId') ? errors.vehicleId : null}
              hint={hasVehicles ? undefined : t('fuelForm.vehicleHint')}>
              {vehiclesLoading ? (
                <Input value={t('common.loadingVehicles')} editable={false} variant="subtle" />
              ) : hasVehicles ? (
                <VehiclePickerField
                  vehicles={vehicles}
                  value={selectedVehicleId || null}
                  onChange={(value) => {
                    markUserInteracted();
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
                  title={t('fuelForm.noVehicle.title')}
                  description={t('fuelForm.noVehicle.description')}
                  actionLabel={t('add.actionSheet.addVehicle')}
                  onAction={() => router.push('/vehicles/new')}
                />
              )}
            </FormField>

            <FormField
              label={t('fuelForm.field.fuelType')}
              required
              error={showError('fuelType') ? errors.fuelType : null}>
              <SelectField
                options={fuelTypeOptions}
                value={fuelType}
                onChange={(value) => {
                  markUserInteracted();
                  setFuelType(value as FuelType);
                  setFuelTypeManuallyEdited(true);
                  setTouched((prev) => ({ ...prev, fuelType: true }));
                }}
              />
            </FormField>

            <FormField
              label={t('fuelForm.field.currentKm')}
              required
              hint={
                latestRecordedKm !== null
                  ? odometerSuggestionSource === 'vehicleBaseline'
                    ? t('fuelForm.hint.currentKmBaseline', { value: latestRecordedKm })
                    : t('fuelForm.hint.currentKmLatest', { value: latestRecordedKm })
                  : t('fuelForm.hint.currentKmNoLatest')
              }
              error={showError('odometer') ? errors.odometer : null}>
                <Input
                  value={odometer}
                  onChangeText={(value) => {
                    markUserInteracted();
                    odometerEditedRef.current = true;
                    setOdometer(sanitizeIntegerInput(value, ODOMETER_DIGITS));
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, odometer: true }))}
                  keyboardType="number-pad"
                  placeholder={latestRecordedKm !== null ? String(latestRecordedKm) : t('fuelForm.placeholder.currentKm')}
                tone={showError('odometer') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField label={t('fuelForm.field.liters')} required error={showError('liters') ? errors.liters : null}>
              <Input
                value={liters}
                onChangeText={(value) => {
                  markUserInteracted();
                  setLiters(sanitizeDecimalInput(value, LITERS_INTEGER_DIGITS, LITERS_FRACTION_DIGITS));
                }}
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
                value={fuelInTankAfterRefuel}
                onChangeText={(value) =>
                  {
                    markUserInteracted();
                    setFuelInTankAfterRefuel(
                      sanitizeDecimalInput(value, FUEL_IN_TANK_INTEGER_DIGITS, FUEL_IN_TANK_FRACTION_DIGITS),
                    );
                  }
                }
                onBlur={() => setTouched((prev) => ({ ...prev, fuelInTankAfterRefuel: true }))}
                keyboardType="decimal-pad"
                placeholder={t('fuelForm.placeholder.fuelInTankAfterRefuel')}
                tone={showError('fuelInTankAfterRefuel') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField label={t('fuelForm.field.price')} required error={showError('price') ? errors.price : null}>
              <Input
                value={price}
                onChangeText={(value) => {
                  markUserInteracted();
                  setPrice(sanitizeDecimalInput(value, PRICE_INTEGER_DIGITS, PRICE_FRACTION_DIGITS));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, price: true }))}
                keyboardType="decimal-pad"
                placeholder={t('fuelForm.placeholder.price')}
                tone={showError('price') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField
              label={t('fuelForm.field.station')}
              required
              hint={t('common.charCount', { current: trimmedLength(station), max: STATION_MAX })}
              error={showError('station') ? errors.station : null}>
              <Input
                value={station}
                onChangeText={(value) => {
                  markUserInteracted();
                  setStation(value.replace(/\n/g, ' ').slice(0, STATION_MAX));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, station: true }))}
                placeholder={t('fuelForm.placeholder.station')}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={STATION_MAX}
                tone={showError('station') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField
              label={t('fuelForm.field.avgReadonly')}
              hint={
                previousFuelKm !== null
                  ? t('fuelForm.hint.avgWithPrevious', { value: previousFuelKm })
                  : t('fuelForm.hint.avgNoPrevious')
              }>
              <Input
                value={
                  avgConsumptionPreview !== null
                    ? t('fuelForm.hint.avgValue', { value: avgConsumptionPreview.toFixed(2) })
                    : t('fuelForm.hint.avgPending')
                }
                editable={false}
                variant="subtle"
              />
            </FormField>

            <FormField
              label={t('fuelForm.field.receipt')}
              error={showError('receipt') ? errors.receipt : null}
              hint={t('fuelForm.receiptHint')}>
              <Card variant="subtle" className="gap-2">
                <Button
                  label={t('fuelForm.takePhoto')}
                  variant="secondary"
                  size="sm"
                  disabled={attachmentBusy}
                  onPress={() => void attachFromCamera()}
                />
                <Button
                  label={t('fuelForm.uploadPhoto')}
                  variant="secondary"
                  size="sm"
                  disabled={attachmentBusy}
                  onPress={() => void attachFromGallery()}
                />
                <Button
                  label={t('fuelForm.uploadPdf')}
                  variant="secondary"
                  size="sm"
                  disabled={attachmentBusy}
                  onPress={() => void attachPdf()}
                />
              </Card>

              {receipt ? (
                <Card variant="subtle" className="mt-2 gap-1.5">
                  <Input value={receipt.name} editable={false} variant="ghost" />
                  <Button
                    label={t('fuelForm.removeReceipt')}
                    variant="ghost"
                    size="sm"
                    onPress={() => {
                      markUserInteracted();
                      setReceipt(null);
                    }}
                    className="self-start"
                  />
                </Card>
              ) : null}
            </FormField>

            <FormField
              label={t('fuelForm.field.notes')}
              hint={t('common.charCount', { current: trimmedLength(notes), max: NOTES_MAX })}
              error={showError('notes') ? errors.notes : null}>
              <TextArea
                value={notes}
                onChangeText={(value) => {
                  markUserInteracted();
                  setNotes(value.slice(0, NOTES_MAX));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, notes: true }))}
                placeholder={t('fuelForm.placeholder.notes')}
                autoCapitalize="sentences"
                maxLength={NOTES_MAX}
                tone={showError('notes') ? 'destructive' : 'neutral'}
              />
            </FormField>
          </Card>

          <Button
            label={attachmentBusy ? t('fuelForm.preparingAttachment') : t('fuelForm.save')}
            variant="primary"
            loading={saving}
            loadingLabel={t('fuelForm.saving')}
            disabled={!canSubmit}
            leftIcon={({ color, size }) => <ActionIcon name="save" color={color} size={size} />}
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
});

