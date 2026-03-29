import { useCallback } from 'react';

import { translate, type TranslationKey, type TranslationParams } from '@/i18n';
import { useAppPreferences } from '@/hooks/use-app-preferences';

export function useI18n() {
  const { preferences } = useAppPreferences();

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) => translate(preferences.language, key, params),
    [preferences.language],
  );

  return {
    t,
    language: preferences.language,
  };
}
