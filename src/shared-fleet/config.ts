import { SharedFleetError } from '@/shared-fleet/errors';

export type SharedFleetConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

let cachedConfig: SharedFleetConfig | null = null;

function normalizeEnv(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function getSharedFleetConfig(): SharedFleetConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const supabaseUrl = normalizeEnv(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = normalizeEnv(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new SharedFleetError(
      'shared_config_missing',
      'Shared Fleet is not configured. Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  cachedConfig = {
    supabaseUrl,
    supabaseAnonKey,
  };

  return cachedConfig;
}

export function resetSharedFleetConfigCacheForTests() {
  cachedConfig = null;
}
