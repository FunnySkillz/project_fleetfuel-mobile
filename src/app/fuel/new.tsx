import { useIsFocused } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Button, Card, EmptyState, FormField, Input, SectionHeader, SelectField, TextArea } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { entriesRepo, fuelRepo, vehiclesRepo } from '@/data/repositories';
import type { FuelType, ReceiptAttachment, VehicleListItem } from '@/data/types';
import { useI18n } from '@/hooks/use-i18n';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
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
  price?: string;
  station?: string;
  odometer?: string;
  notes?: string;
  receipt?: string;
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
  const params = useLocalSearchParams<{ vehicleId?: string }>();

  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState((params.vehicleId ?? '').trim());

  const [latestRecordedKm, setLatestRecordedKm] = useState<number | null>(null);
  const [previousFuelKm, setPreviousFuelKm] = useState<number | null>(null);

  const [liters, setLiters] = useState('');
  const [price, setPrice] = useState('');
  const [station, setStation] = useState('');
  const [odometer, setOdometer] = useState('');
  const [fuelType, setFuelType] = useState<FuelType | null>(null);
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<ReceiptAttachment | null>(null);

  const [saving, setSaving] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({
    vehicleId: false,
    fuelType: false,
    liters: false,
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
      setPreviousFuelKm(null);
      setOdometer('');
      return;
    }

    let cancelled = false;
    void Promise.all([
      entriesRepo.getLatestOdometerKmForVehicle(selectedVehicleId),
      fuelRepo.getLatestFuelOdometerKmForVehicle(selectedVehicleId),
    ])
      .then(([latestKm, previousFuel]) => {
        if (cancelled) {
          return;
        }

        setLatestRecordedKm(latestKm);
        setPreviousFuelKm(previousFuel);
        if (latestKm !== null) {
          setOdometer(String(latestKm));
        } else {
          setOdometer('');
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setLatestRecordedKm(null);
        setPreviousFuelKm(null);
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

  const litersValue = parseDecimalValue(liters);
  const priceValue = parseDecimalValue(price);
  const odometerValue = parseIntegerValue(odometer);
  const avgConsumptionPreview = calculateAvgConsumption(litersValue, odometerValue, previousFuelKm);

  const isDirty = useMemo(
    () =>
      fuelType !== null ||
      liters.trim().length > 0 ||
      price.trim().length > 0 ||
      station.trim().length > 0 ||
      notes.trim().length > 0 ||
      receipt !== null ||
      saving ||
      attachmentBusy,
    [attachmentBusy, fuelType, liters, notes, price, receipt, saving, station],
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
  }, [fuelType, latestRecordedKm, liters, litersValue, notes, odometer, odometerValue, price, priceValue, receipt, selectedVehicleId, station, t]);

  const isValid =
    !errors.vehicleId &&
    !errors.fuelType &&
    !errors.liters &&
    !errors.price &&
    !errors.station &&
    !errors.odometer &&
    !errors.notes &&
    !errors.receipt;

  const canSubmit = isValid && !saving && !attachmentBusy;
  const showError = (field: keyof typeof touched) => (submitAttempted || touched[field]) && Boolean(errors[field]);

  const handleSave = async () => {
    if (saving || attachmentBusy) {
      return;
    }

    setSubmitAttempted(true);
    setTouched({
      vehicleId: true,
      fuelType: true,
      liters: true,
      price: true,
      station: true,
      odometer: true,
      notes: true,
      receipt: true,
    });

    if (!isValid || litersValue === null || priceValue === null || odometerValue === null) {
      Alert.alert(t('common.checkFormTitle'), t('common.fixValidationErrors'));
      return;
    }

    setSaving(true);
    try {
      await fuelRepo.create({
        vehicleId: selectedVehicleId,
        fuelType,
        liters: litersValue,
        totalPrice: priceValue,
        station: normalizeText(station),
        odometerKm: odometerValue,
        receipt,
        notes: normalizeText(notes) || null,
      });

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
                <SelectField
                  options={vehicles.map((vehicle) => ({
                    value: vehicle.id,
                    label: `${vehicle.name} (${vehicle.plate})`,
                  }))}
                  value={selectedVehicleId || null}
                  onChange={(value) => {
                    setSelectedVehicleId(value);
                    setTouched((prev) => ({ ...prev, vehicleId: true }));
                  }}
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
                options={[
                  { value: 'petrol', label: t('fuelForm.fuelType.petrol') },
                  { value: 'diesel', label: t('fuelForm.fuelType.diesel') },
                  { value: 'electric', label: t('fuelForm.fuelType.electric') },
                  { value: 'hybrid', label: t('fuelForm.fuelType.hybrid') },
                  { value: 'lpg', label: t('fuelForm.fuelType.lpg') },
                  { value: 'cng', label: t('fuelForm.fuelType.cng') },
                  { value: 'other', label: t('fuelForm.fuelType.other') },
                ]}
                value={fuelType}
                onChange={(value) => {
                  setFuelType(value as FuelType);
                  setTouched((prev) => ({ ...prev, fuelType: true }));
                }}
              />
            </FormField>

            <FormField
              label={t('fuelForm.field.currentKm')}
              required
              hint={
                latestRecordedKm !== null
                  ? t('fuelForm.hint.currentKmLatest', { value: latestRecordedKm })
                  : t('fuelForm.hint.currentKmNoLatest')
              }
              error={showError('odometer') ? errors.odometer : null}>
              <Input
                value={odometer}
                onChangeText={(value) => setOdometer(sanitizeIntegerInput(value, ODOMETER_DIGITS))}
                onBlur={() => setTouched((prev) => ({ ...prev, odometer: true }))}
                keyboardType="number-pad"
                placeholder={latestRecordedKm !== null ? String(latestRecordedKm) : t('fuelForm.placeholder.currentKm')}
                tone={showError('odometer') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField label={t('fuelForm.field.liters')} required error={showError('liters') ? errors.liters : null}>
              <Input
                value={liters}
                onChangeText={(value) => setLiters(sanitizeDecimalInput(value, LITERS_INTEGER_DIGITS, LITERS_FRACTION_DIGITS))}
                onBlur={() => setTouched((prev) => ({ ...prev, liters: true }))}
                keyboardType="decimal-pad"
                placeholder={t('fuelForm.placeholder.liters')}
                tone={showError('liters') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField label={t('fuelForm.field.price')} required error={showError('price') ? errors.price : null}>
              <Input
                value={price}
                onChangeText={(value) => setPrice(sanitizeDecimalInput(value, PRICE_INTEGER_DIGITS, PRICE_FRACTION_DIGITS))}
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
                onChangeText={(value) => setStation(value.replace(/\n/g, ' ').slice(0, STATION_MAX))}
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
                    onPress={() => setReceipt(null)}
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
                onChangeText={(value) => setNotes(value.slice(0, NOTES_MAX))}
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

