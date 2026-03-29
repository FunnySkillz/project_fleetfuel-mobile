import { messagesByLanguage, type TranslationKey, type TranslationParams, enMessages } from './messages';
import type { AppLanguage } from '@/preferences/types';

function interpolate(template: string, params?: TranslationParams) {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`));
}

export function translate(language: AppLanguage, key: TranslationKey, params?: TranslationParams) {
  const localized = messagesByLanguage[language][key] ?? enMessages[key] ?? key;
  return interpolate(localized, params);
}

export type { TranslationKey, TranslationParams } from './messages';
