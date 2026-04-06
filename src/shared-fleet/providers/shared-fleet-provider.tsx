import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { SharedFleetError } from '@/shared-fleet/errors';
import { authRepo } from '@/shared-fleet/repos';
import {
  loadCurrentUserFleets,
  signInSharedUser,
  signOutSharedUser,
  signUpSharedUser,
} from '@/shared-fleet/services';
import { getSharedSupabaseClient } from '@/shared-fleet/supabase/client';
import type { FleetMembershipWithFleet } from '@/shared-fleet/types';

const ACTIVE_FLEET_STORAGE_KEY_PREFIX = 'fleetfuel.shared.active-fleet.v1';

type SharedFleetContextValue = {
  status: 'booting' | 'ready' | 'error';
  errorMessage: string | null;
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  authBusy: boolean;
  dataBusy: boolean;
  fleets: FleetMembershipWithFleet[];
  activeFleetId: string | null;
  activeFleet: FleetMembershipWithFleet | null;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signUp: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshFleets: () => Promise<void>;
  setActiveFleetId: (fleetId: string) => Promise<void>;
  clearError: () => void;
};

const SharedFleetContext = createContext<SharedFleetContextValue>({
  status: 'booting',
  errorMessage: null,
  session: null,
  user: null,
  isAuthenticated: false,
  authBusy: false,
  dataBusy: false,
  fleets: [],
  activeFleetId: null,
  activeFleet: null,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  refreshFleets: async () => {},
  setActiveFleetId: async () => {},
  clearError: () => {},
});

function getActiveFleetStorageKey(userId: string) {
  return `${ACTIVE_FLEET_STORAGE_KEY_PREFIX}.${userId}`;
}

async function loadPersistedActiveFleet(userId: string) {
  try {
    return await AsyncStorage.getItem(getActiveFleetStorageKey(userId));
  } catch {
    return null;
  }
}

async function persistActiveFleet(userId: string, fleetId: string | null) {
  try {
    const key = getActiveFleetStorageKey(userId);
    if (!fleetId) {
      await AsyncStorage.removeItem(key);
      return;
    }

    await AsyncStorage.setItem(key, fleetId);
  } catch {
    // Non-blocking preference persistence.
  }
}

function pickActiveFleetId(
  fleets: FleetMembershipWithFleet[],
  persistedFleetId: string | null,
  currentFleetId: string | null,
): string | null {
  if (fleets.length === 0) {
    return null;
  }

  if (currentFleetId && fleets.some((fleet) => fleet.fleetId === currentFleetId)) {
    return currentFleetId;
  }

  if (persistedFleetId && fleets.some((fleet) => fleet.fleetId === persistedFleetId)) {
    return persistedFleetId;
  }

  return fleets[0].fleetId;
}

function mapError(error: unknown) {
  if (error instanceof SharedFleetError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Shared Fleet operation failed.';
}

export function SharedFleetProvider({ children }: React.PropsWithChildren) {
  const [status, setStatus] = useState<'booting' | 'ready' | 'error'>('booting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [dataBusy, setDataBusy] = useState(false);
  const [fleets, setFleets] = useState<FleetMembershipWithFleet[]>([]);
  const [activeFleetId, setActiveFleetIdState] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const applySession = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
  }, []);

  const refreshFleets = useCallback(async () => {
    if (!session?.user.id) {
      setFleets([]);
      setActiveFleetIdState(null);
      return;
    }

    setDataBusy(true);
    try {
      const loaded = await loadCurrentUserFleets();
      if (!mountedRef.current) {
        return;
      }

      const persisted = await loadPersistedActiveFleet(session.user.id);
      if (!mountedRef.current) {
        return;
      }

      const nextActiveFleetId = pickActiveFleetId(loaded, persisted, activeFleetId);

      setFleets(loaded);
      setActiveFleetIdState(nextActiveFleetId);
      await persistActiveFleet(session.user.id, nextActiveFleetId);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setErrorMessage(mapError(error));
    } finally {
      if (mountedRef.current) {
        setDataBusy(false);
      }
    }
  }, [activeFleetId, session?.user.id]);

  const bootstrap = useCallback(async () => {
    setStatus('booting');
    setErrorMessage(null);

    try {
      const initialSession = await authRepo.getSession();
      if (!mountedRef.current) {
        return;
      }

      applySession(initialSession);
      setStatus('ready');
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setStatus('error');
      setErrorMessage(mapError(error));
    }
  }, [applySession]);

  const signIn = useCallback(async (input: { email: string; password: string }) => {
    setAuthBusy(true);
    setErrorMessage(null);

    try {
      const maybeSession = await signInSharedUser(input);
      if (maybeSession) {
        applySession(maybeSession);
      }
    } catch (error) {
      throw new SharedFleetError('shared_unknown_error', mapError(error), { cause: error });
    } finally {
      setAuthBusy(false);
    }
  }, [applySession]);

  const signUp = useCallback(async (input: { email: string; password: string }) => {
    setAuthBusy(true);
    setErrorMessage(null);

    try {
      const maybeSession = await signUpSharedUser(input);
      if (maybeSession) {
        applySession(maybeSession);
      }
    } catch (error) {
      throw new SharedFleetError('shared_unknown_error', mapError(error), { cause: error });
    } finally {
      setAuthBusy(false);
    }
  }, [applySession]);

  const signOut = useCallback(async () => {
    setAuthBusy(true);
    setErrorMessage(null);

    try {
      const userId = session?.user.id ?? null;
      await signOutSharedUser();
      if (userId) {
        await persistActiveFleet(userId, null);
      }

      if (!mountedRef.current) {
        return;
      }

      setFleets([]);
      setActiveFleetIdState(null);
      applySession(null);
    } finally {
      if (mountedRef.current) {
        setAuthBusy(false);
      }
    }
  }, [applySession, session?.user.id]);

  const setActiveFleetId = useCallback(
    async (fleetId: string) => {
      const normalizedFleetId = fleetId.trim();
      const exists = fleets.some((fleet) => fleet.fleetId === normalizedFleetId);

      if (!exists || !session?.user.id) {
        return;
      }

      setActiveFleetIdState(normalizedFleetId);
      await persistActiveFleet(session.user.id, normalizedFleetId);
    },
    [fleets, session?.user.id],
  );

  useEffect(() => {
    mountedRef.current = true;
    void bootstrap();

    return () => {
      mountedRef.current = false;
    };
  }, [bootstrap]);

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    const subscription = authRepo.onAuthStateChange((nextSession) => {
      if (!mountedRef.current) {
        return;
      }

      applySession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [applySession, status]);

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    void refreshFleets();
  }, [refreshFleets, session?.user.id, status]);

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    const handleAuthCallbackFromUrl = async (url: string) => {
      try {
        await authRepo.handleDeepLinkCallback(url);
      } catch {
        // Ignore callback parsing failures and keep normal auth flow.
      }
    };

    void (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await handleAuthCallbackFromUrl(initialUrl);
      }
    })();

    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleAuthCallbackFromUrl(url);
    });

    return () => {
      linkingSubscription.remove();
    };
  }, [status]);

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    const supabase = getSharedSupabaseClient();

    if (appStateRef.current === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;

      if (nextState === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      subscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, [status]);

  const activeFleet = useMemo(() => {
    if (!activeFleetId) {
      return null;
    }

    return fleets.find((fleet) => fleet.fleetId === activeFleetId) ?? null;
  }, [activeFleetId, fleets]);

  const value = useMemo<SharedFleetContextValue>(
    () => ({
      status,
      errorMessage,
      session,
      user,
      isAuthenticated: Boolean(session),
      authBusy,
      dataBusy,
      fleets,
      activeFleetId,
      activeFleet,
      signIn,
      signUp,
      signOut,
      refreshFleets,
      setActiveFleetId,
      clearError,
    }),
    [
      activeFleet,
      activeFleetId,
      authBusy,
      clearError,
      dataBusy,
      errorMessage,
      fleets,
      refreshFleets,
      session,
      setActiveFleetId,
      signIn,
      signOut,
      signUp,
      status,
      user,
    ],
  );

  return <SharedFleetContext.Provider value={value}>{children}</SharedFleetContext.Provider>;
}

export function useSharedFleetContext() {
  return useContext(SharedFleetContext);
}
