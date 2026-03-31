import { useRouter } from 'expo-router';
import React from 'react';

import { VehicleFormScreen } from '@/components/vehicle/vehicle-form-screen';
import { vehiclesRepo } from '@/data/repositories';
import { useI18n } from '@/hooks/use-i18n';

export default function AddVehicleScreen() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <VehicleFormScreen
      title={t('vehicleForm.title')}
      description={t('vehicleForm.description')}
      submitLabel={t('vehicleForm.save')}
      submittingLabel={t('vehicleForm.saving')}
      onSubmit={async (values) => {
        await vehiclesRepo.create(values);
      }}
      onSubmitSuccess={() => {
        router.back();
      }}
    />
  );
}
