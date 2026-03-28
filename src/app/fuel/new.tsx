import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { parseDecimalValue, sanitizeDecimalInput, trimmedLength } from '@/utils/form-input';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';

const LITERS_INTEGER_DIGITS = 3;
const LITERS_FRACTION_DIGITS = 2;
const LITERS_MAX = 500;
const PRICE_INTEGER_DIGITS = 6;
const PRICE_FRACTION_DIGITS = 2;
const PRICE_MAX = 500000;
const STATION_MIN = 2;
const STATION_MAX = 80;

type FuelFormErrors = {
  liters?: string;
  price?: string;
  station?: string;
};

export default function AddFuelEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const params = useLocalSearchParams<{ vehicleId?: string }>();
  const [liters, setLiters] = useState('');
  const [price, setPrice] = useState('');
  const [station, setStation] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({ liters: false, price: false, station: false });

  const isDirty = useMemo(
    () => liters.trim().length > 0 || price.trim().length > 0 || station.trim().length > 0,
    [liters, price, station],
  );
  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty);

  const errors = useMemo<FuelFormErrors>(() => {
    const result: FuelFormErrors = {};
    const litersValue = parseDecimalValue(liters);
    const priceValue = parseDecimalValue(price);
    const stationLength = trimmedLength(station);

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

    if (stationLength === 0) {
      result.station = 'Station/vendor is required.';
    } else if (stationLength < STATION_MIN) {
      result.station = `Station/vendor must be at least ${STATION_MIN} characters.`;
    } else if (stationLength > STATION_MAX) {
      result.station = `Station/vendor must be at most ${STATION_MAX} characters.`;
    }

    return result;
  }, [liters, price, station]);

  const isValid = !errors.liters && !errors.price && !errors.station;
  const canSubmit = isDirty && isValid;
  const showLitersError = (submitAttempted || touched.liters) && Boolean(errors.liters);
  const showPriceError = (submitAttempted || touched.price) && Boolean(errors.price);
  const showStationError = (submitAttempted || touched.station) && Boolean(errors.station);

  const handleSave = () => {
    setSubmitAttempted(true);
    setTouched({ liters: true, price: true, station: true });

    if (!isValid) {
      Alert.alert('Check form', 'Please fix validation errors before saving.');
      return;
    }

    const normalizedStation = station.trim().replace(/\s+/g, ' ');
    const litersValue = parseDecimalValue(liters);
    const priceValue = parseDecimalValue(price);

    Alert.alert(
      'Fuel entry saved locally (placeholder)',
      `${litersValue} L at ${normalizedStation} for ${priceValue} is valid and ready for data-layer integration.`,
    );
    setLiters('');
    setPrice('');
    setStation('');
    setTouched({ liters: false, price: false, station: false });
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

          <ThemedText type="smallBold">Liters</ThemedText>
          <TextInput
            value={liters}
            onChangeText={(value) =>
              setLiters(sanitizeDecimalInput(value, LITERS_INTEGER_DIGITS, LITERS_FRACTION_DIGITS))
            }
            onBlur={() => setTouched((prev) => ({ ...prev, liters: true }))}
            keyboardType="decimal-pad"
            placeholder="42.4"
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showLitersError && { borderColor: theme.destructive },
            ]}
          />
          {showLitersError ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.liters}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">Total Price</ThemedText>
          <TextInput
            value={price}
            onChangeText={(value) =>
              setPrice(sanitizeDecimalInput(value, PRICE_INTEGER_DIGITS, PRICE_FRACTION_DIGITS))
            }
            onBlur={() => setTouched((prev) => ({ ...prev, price: true }))}
            keyboardType="decimal-pad"
            placeholder="72.10"
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showPriceError && { borderColor: theme.destructive },
            ]}
          />
          {showPriceError ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.price}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">Station / Vendor</ThemedText>
          <TextInput
            value={station}
            onChangeText={(value) => setStation(value.replace(/\n/g, ' ').slice(0, STATION_MAX))}
            onBlur={() => setTouched((prev) => ({ ...prev, station: true }))}
            placeholder="OMV City Center"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={STATION_MAX}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
              showStationError && { borderColor: theme.destructive },
            ]}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.counterText}>
            {trimmedLength(station)}/{STATION_MAX}
          </ThemedText>
          {showStationError ? (
            <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
              {errors.station}
            </ThemedText>
          ) : null}

          <Pressable onPress={handleSave} disabled={!canSubmit} accessibilityState={{ disabled: !canSubmit }}>
            <ThemedView
              type="backgroundElement"
              style={[styles.primaryAction, !canSubmit && styles.primaryActionDisabled]}>
              <ThemedText type="smallBold">Save Fuel Entry</ThemedText>
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
  counterText: {
    textAlign: 'right',
    marginTop: -4,
  },
  errorText: {},
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
