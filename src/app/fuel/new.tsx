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
import type { ReceiptAttachment, VehicleListItem } from '@/data/types';
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
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<ReceiptAttachment | null>(null);

  const [saving, setSaving] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({
    vehicleId: false,
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
      liters.trim().length > 0 ||
      price.trim().length > 0 ||
      station.trim().length > 0 ||
      notes.trim().length > 0 ||
      receipt !== null ||
      saving ||
      attachmentBusy,
    [attachmentBusy, liters, notes, price, receipt, saving, station],
  );
  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty);

  const errors = useMemo<FuelFormErrors>(() => {
    const result: FuelFormErrors = {};

    if (!selectedVehicleId) {
      result.vehicleId = 'Vehicle is required.';
    }

    if (liters.trim().length === 0) {
      result.liters = 'Liters is required.';
    } else if (litersValue === null) {
      result.liters = 'Liters must be a valid number.';
    } else if (litersValue <= 0) {
      result.liters = 'Liters must be greater than 0.';
    } else if (litersValue > LITERS_MAX) {
      result.liters = `Liters must be less than or equal to ${LITERS_MAX}.`;
    }

    if (price.trim().length === 0) {
      result.price = 'Total price is required.';
    } else if (priceValue === null) {
      result.price = 'Total price must be a valid number.';
    } else if (priceValue <= 0) {
      result.price = 'Total price must be greater than 0.';
    } else if (priceValue > PRICE_MAX) {
      result.price = `Total price must be less than or equal to ${PRICE_MAX}.`;
    }

    const stationLength = trimmedLength(station);
    if (stationLength === 0) {
      result.station = 'Station/vendor is required.';
    } else if (stationLength < STATION_MIN) {
      result.station = `Station/vendor must be at least ${STATION_MIN} characters.`;
    } else if (stationLength > STATION_MAX) {
      result.station = `Station/vendor must be at most ${STATION_MAX} characters.`;
    }

    if (odometer.trim().length === 0) {
      result.odometer = 'Current km is required.';
    } else if (odometerValue === null) {
      result.odometer = 'Current km must be a whole number.';
    } else if (latestRecordedKm !== null && odometerValue < latestRecordedKm) {
      result.odometer = `Current km cannot be below latest recorded km (${latestRecordedKm}).`;
    }

    if (trimmedLength(notes) > NOTES_MAX) {
      result.notes = `Notes must be at most ${NOTES_MAX} characters.`;
    }

    if (receipt && !receipt.uri) {
      result.receipt = 'Attached receipt is invalid.';
    }

    return result;
  }, [latestRecordedKm, liters, litersValue, notes, odometer, odometerValue, price, priceValue, receipt, selectedVehicleId, station]);

  const isValid =
    !errors.vehicleId && !errors.liters && !errors.price && !errors.station && !errors.odometer && !errors.notes && !errors.receipt;

  const canSubmit = isValid && !saving && !attachmentBusy;
  const showError = (field: keyof typeof touched) => (submitAttempted || touched[field]) && Boolean(errors[field]);

  const handleSave = async () => {
    if (saving || attachmentBusy) {
      return;
    }

    setSubmitAttempted(true);
    setTouched({
      vehicleId: true,
      liters: true,
      price: true,
      station: true,
      odometer: true,
      notes: true,
      receipt: true,
    });

    if (!isValid || litersValue === null || priceValue === null || odometerValue === null) {
      Alert.alert('Check form', 'Please fix validation errors before saving.');
      return;
    }

    setSaving(true);
    try {
      await fuelRepo.create({
        vehicleId: selectedVehicleId,
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
      Alert.alert('Could not save fuel entry', error instanceof Error ? error.message : 'Unexpected error.');
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
        Alert.alert('Camera permission needed', 'Enable camera access to take a receipt photo.');
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
      Alert.alert('Could not attach photo', error instanceof Error ? error.message : 'Unexpected error.');
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
        Alert.alert('Photos permission needed', 'Enable photo library access to select a receipt image.');
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
      Alert.alert('Could not attach image', error instanceof Error ? error.message : 'Unexpected error.');
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
      Alert.alert('Could not attach PDF', error instanceof Error ? error.message : 'Unexpected error.');
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
            title="Add Fuel Entry"
            description="Track refuels with receipt evidence and local-first consumption preview."
          />

          <Card className="gap-3">
            <FormField
              label="Vehicle"
              required
              error={showError('vehicleId') ? errors.vehicleId : null}
              hint={hasVehicles ? undefined : 'Add a vehicle first, then create fuel entries.'}>
              {vehiclesLoading ? (
                <Input value="Loading vehicles..." editable={false} variant="subtle" />
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
                  title="No vehicle available"
                  description="Create your first vehicle to start recording fuel entries."
                  actionLabel="Add Vehicle"
                  onAction={() => router.push('/vehicles/new')}
                />
              )}
            </FormField>

            <FormField
              label="Current Km (Tacho)"
              required
              hint={
                latestRecordedKm !== null
                  ? `Latest recorded km: ${latestRecordedKm}`
                  : 'No previous odometer record found for this vehicle.'
              }
              error={showError('odometer') ? errors.odometer : null}>
              <Input
                value={odometer}
                onChangeText={(value) => setOdometer(sanitizeIntegerInput(value, ODOMETER_DIGITS))}
                onBlur={() => setTouched((prev) => ({ ...prev, odometer: true }))}
                keyboardType="number-pad"
                placeholder={latestRecordedKm !== null ? String(latestRecordedKm) : '84210'}
                tone={showError('odometer') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField label="Liters" required error={showError('liters') ? errors.liters : null}>
              <Input
                value={liters}
                onChangeText={(value) => setLiters(sanitizeDecimalInput(value, LITERS_INTEGER_DIGITS, LITERS_FRACTION_DIGITS))}
                onBlur={() => setTouched((prev) => ({ ...prev, liters: true }))}
                keyboardType="decimal-pad"
                placeholder="42.4"
                tone={showError('liters') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField label="Total Price" required error={showError('price') ? errors.price : null}>
              <Input
                value={price}
                onChangeText={(value) => setPrice(sanitizeDecimalInput(value, PRICE_INTEGER_DIGITS, PRICE_FRACTION_DIGITS))}
                onBlur={() => setTouched((prev) => ({ ...prev, price: true }))}
                keyboardType="decimal-pad"
                placeholder="72.10"
                tone={showError('price') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField
              label="Station / Vendor"
              required
              hint={`${trimmedLength(station)}/${STATION_MAX}`}
              error={showError('station') ? errors.station : null}>
              <Input
                value={station}
                onChangeText={(value) => setStation(value.replace(/\n/g, ' ').slice(0, STATION_MAX))}
                onBlur={() => setTouched((prev) => ({ ...prev, station: true }))}
                placeholder="OMV City Center"
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={STATION_MAX}
                tone={showError('station') ? 'destructive' : 'neutral'}
              />
            </FormField>

            <FormField
              label="Avg Consumption (readonly)"
              hint={
                previousFuelKm !== null
                  ? `Based on previous fuel record at ${previousFuelKm} km.`
                  : 'First fuel record for this vehicle, so no comparison baseline yet.'
              }>
              <Input
                value={avgConsumptionPreview !== null ? `${avgConsumptionPreview.toFixed(2)} L / 100 km` : 'Need liters + previous fuel km'}
                editable={false}
                variant="subtle"
              />
            </FormField>

            <FormField
              label="Receipt / Evidence (optional)"
              error={showError('receipt') ? errors.receipt : null}
              hint="Take a photo, upload a photo, or attach a PDF receipt.">
              <Card variant="subtle" className="gap-2">
                <Button
                  label="Take Photo"
                  variant="secondary"
                  size="sm"
                  disabled={attachmentBusy}
                  onPress={() => void attachFromCamera()}
                />
                <Button
                  label="Upload Photo"
                  variant="secondary"
                  size="sm"
                  disabled={attachmentBusy}
                  onPress={() => void attachFromGallery()}
                />
                <Button
                  label="Upload PDF"
                  variant="secondary"
                  size="sm"
                  disabled={attachmentBusy}
                  onPress={() => void attachPdf()}
                />
              </Card>

              {receipt ? (
                <Card variant="subtle" className="mt-2 gap-1.5">
                  <Input value={receipt.name} editable={false} variant="ghost" />
                  <Button label="Remove Receipt" variant="ghost" size="sm" onPress={() => setReceipt(null)} className="self-start" />
                </Card>
              ) : null}
            </FormField>

            <FormField
              label="Notes (optional)"
              hint={`${trimmedLength(notes)}/${NOTES_MAX}`}
              error={showError('notes') ? errors.notes : null}>
              <TextArea
                value={notes}
                onChangeText={(value) => setNotes(value.slice(0, NOTES_MAX))}
                onBlur={() => setTouched((prev) => ({ ...prev, notes: true }))}
                placeholder="Receipt reference, route context, etc."
                autoCapitalize="sentences"
                maxLength={NOTES_MAX}
                tone={showError('notes') ? 'destructive' : 'neutral'}
              />
            </FormField>
          </Card>

          <Button
            label={attachmentBusy ? 'Preparing attachment...' : 'Save Fuel Entry'}
            variant="primary"
            loading={saving}
            loadingLabel="Saving..."
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
