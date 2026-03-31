import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VehicleFormScreen, type VehicleFormSubmitValues } from '@/components/vehicle/vehicle-form-screen';
import { ThemedView } from '@/components/themed-view';
import { AppText, Card, EmptyState } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { vehiclesRepo } from '@/data/repositories';
import { useI18n } from '@/hooks/use-i18n';
import type { VehicleRecord } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

export default function EditVehicleScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const theme = useTheme();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ vehicleId?: string }>();
  const vehicleId = (params.vehicleId ?? '').trim();

  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadVehicle = useCallback(async () => {
    if (!vehicleId) {
      setStatus('error');
      setErrorMessage(t('vehicleDetail.errorMissingId'));
      setVehicle(null);
      return;
    }

    setStatus((previous) => (previous === 'ready' ? 'ready' : 'loading'));
    setErrorMessage(null);

    try {
      const record = await vehiclesRepo.getById(vehicleId);
      if (!record) {
        setStatus('error');
        setErrorMessage(t('vehicleDetail.errorNotFound'));
        setVehicle(null);
        return;
      }

      setVehicle(record);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : t('vehicleDetail.errorLoadFailedFallback'));
      setVehicle(null);
    }
  }, [t, vehicleId]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    void loadVehicle();
  }, [isFocused, loadVehicle]);

  const handleSubmit = async (values: VehicleFormSubmitValues) => {
    if (!vehicle) {
      throw new Error(t('vehicleDetail.errorNotFound'));
    }
    await vehiclesRepo.update(vehicle.id, values);
  };

  if (status !== 'ready' || !vehicle) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {status === 'loading' ? (
            <Card className="mx-6 mt-6 gap-2">
              <ActivityIndicator color={theme.textSecondary} />
              <AppText variant="caption" color="secondary">{t('vehicleDetail.loading')}</AppText>
            </Card>
          ) : (
            <EmptyState
              tone="destructive"
              title={t('vehicleDetail.errorLoadTitle')}
              description={errorMessage ?? t('common.unexpectedError')}
              actionLabel={t('common.retry')}
              onAction={() => {
                void loadVehicle();
              }}
              className="mx-6 mt-6"
            />
          )}
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <VehicleFormScreen
      title={t('vehicleForm.editTitle')}
      description={t('vehicleForm.editDescription')}
      submitLabel={t('vehicleForm.saveChanges')}
      submittingLabel={t('vehicleForm.saving')}
      initialValues={vehicle}
      onSubmit={handleSubmit}
      onSubmitSuccess={() => {
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Spacing.four,
  },
});

