import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSharedFleetConfig } from '@/shared-fleet/config';
import type { Database } from '@/shared-fleet/database.types';

const SHARED_SUPABASE_STORAGE_KEY = 'fleetfuel.shared.supabase.auth.v1';

const authStorage = {
  getItem: async (key: string) => {
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    await AsyncStorage.removeItem(key);
  },
};

let sharedSupabaseClient: SupabaseClient<Database> | null = null;

export function getSharedSupabaseClient(): SupabaseClient<Database> {
  if (sharedSupabaseClient) {
    return sharedSupabaseClient;
  }

  const config = getSharedFleetConfig();

  sharedSupabaseClient = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storage: authStorage,
      storageKey: SHARED_SUPABASE_STORAGE_KEY,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-FleetFuel-Client': 'mobile-shared-fleet',
      },
    },
  });

  return sharedSupabaseClient;
}

export function resetSharedSupabaseClientForTests() {
  sharedSupabaseClient = null;
}
