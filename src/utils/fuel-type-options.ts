import { FUEL_TYPES, type FuelType, type FuelTypeFilter } from '@/data/types';
import type { TranslationKey, TranslationParams } from '@/i18n';

type Translate = (key: TranslationKey, params?: TranslationParams) => string;

const FUEL_TYPE_LABEL_KEYS: Record<FuelType, TranslationKey> = {
  petrol: 'common.fuelType.petrol',
  diesel: 'common.fuelType.diesel',
  electric: 'common.fuelType.electric',
  hybrid: 'common.fuelType.hybrid',
  lpg: 'common.fuelType.lpg',
  cng: 'common.fuelType.cng',
  other: 'common.fuelType.other',
};

export function fuelTypeLabel(t: Translate, value: FuelType) {
  return t(FUEL_TYPE_LABEL_KEYS[value]);
}

export function buildFuelTypeOptions(t: Translate): { value: FuelType; label: string }[] {
  return FUEL_TYPES.map((value) => ({ value, label: fuelTypeLabel(t, value) }));
}

export function buildFuelTypeFilterOptions(t: Translate): { value: FuelTypeFilter; label: string }[] {
  return [{ value: 'all', label: t('common.fuelType.all') }, ...buildFuelTypeOptions(t)];
}
