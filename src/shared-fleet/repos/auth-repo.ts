import type { Session } from '@supabase/supabase-js';

import { SharedFleetError } from '@/shared-fleet/errors';
import { getSharedSupabaseClient } from '@/shared-fleet/supabase/client';

import type { AuthRepo, AuthStateChangeCallback, AuthStateSubscription, AuthCredentials } from './contracts';

function toKeyValueMap(payload: string): Map<string, string> {
  const map = new Map<string, string>();
  const pairs = payload.split('&');

  for (const pair of pairs) {
    if (!pair) {
      continue;
    }

    const [rawKey, rawValue = ''] = pair.split('=');
    if (!rawKey) {
      continue;
    }

    map.set(decodeURIComponent(rawKey), decodeURIComponent(rawValue));
  }

  return map;
}

function parseAccessAndRefreshToken(url: string): { accessToken: string; refreshToken: string } | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex < 0) {
    return null;
  }

  const hash = url.slice(hashIndex + 1);
  const values = toKeyValueMap(hash);
  const accessToken = values.get('access_token');
  const refreshToken = values.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function mapAuthError(error: unknown): SharedFleetError {
  if (error instanceof SharedFleetError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('invalid login credentials')) {
      return new SharedFleetError('shared_invalid_credentials', 'Invalid email or password.', { cause: error, status: 400 });
    }

    if (message.includes('network')) {
      return new SharedFleetError('shared_network_error', 'Unable to reach the Shared Fleet backend.', { cause: error, status: null });
    }

    return new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
  }

  return new SharedFleetError('shared_unknown_error', 'Unknown Shared Fleet authentication error.');
}

function validateCredentials(input: AuthCredentials): AuthCredentials {
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (!email || !email.includes('@')) {
    throw new SharedFleetError('shared_validation_error', 'Please enter a valid email address.');
  }

  if (password.length < 8) {
    throw new SharedFleetError('shared_validation_error', 'Password must be at least 8 characters.');
  }

  return { email, password };
}

async function fetchSessionOrThrow(): Promise<Session | null> {
  const supabase = getSharedSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw mapAuthError(error);
  }

  return data.session;
}

export const authRepo: AuthRepo = {
  async signUp(input) {
    const credentials = validateCredentials(input);
    const supabase = getSharedSupabaseClient();

    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      throw mapAuthError(error);
    }

    return data.session;
  },

  async signIn(input) {
    const credentials = validateCredentials(input);
    const supabase = getSharedSupabaseClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      throw mapAuthError(error);
    }

    return data.session;
  },

  async signOut() {
    const supabase = getSharedSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw mapAuthError(error);
    }
  },

  async getSession() {
    return fetchSessionOrThrow();
  },

  onAuthStateChange(callback: AuthStateChangeCallback): AuthStateSubscription {
    const supabase = getSharedSupabaseClient();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });

    return {
      unsubscribe: () => {
        data.subscription.unsubscribe();
      },
    };
  },

  async handleDeepLinkCallback(url: string) {
    const tokenSet = parseAccessAndRefreshToken(url);
    if (!tokenSet) {
      return false;
    }

    const supabase = getSharedSupabaseClient();
    const { error } = await supabase.auth.setSession({
      access_token: tokenSet.accessToken,
      refresh_token: tokenSet.refreshToken,
    });

    if (error) {
      throw mapAuthError(error);
    }

    return true;
  },
};
