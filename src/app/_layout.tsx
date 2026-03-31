import * as DocumentPicker from 'expo-document-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, StyleSheet, View, type AppStateStatus } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppLockGate } from '@/components/app-lock-gate';
import { ThemedView } from '@/components/themed-view';
import { AppText, Button, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { checkDatabaseHealth } from '@/data/db';
import { useI18n } from '@/hooks/use-i18n';
import { useAppPreferences } from '@/hooks/use-app-preferences';
import { AppPreferencesProvider } from '@/providers/app-preferences-provider';
import { preflightRestore, restoreBackup } from '@/services/backup/backup-restore';
import { hasPinAsync, verifyPinAsync } from '@/services/pin-auth';

export default function RootLayout() {
  return (
    <AppPreferencesProvider>
      <RootNavigator />
    </AppPreferencesProvider>
  );
}

type HealthStatus = 'checking' | 'healthy' | 'recoverable_error';

function RootNavigator() {
  const {
    resolvedTheme,
    reloadPreferences,
    isHydrated,
    preferences,
    setAppLockEnabled,
  } = useAppPreferences();
  const { t } = useI18n();

  const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking');
  const [healthError, setHealthError] = useState<string | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [pinEnabled, setPinEnabled] = useState(false);
  const [lockBootstrapped, setLockBootstrapped] = useState(false);
  const authInFlightRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const shouldAuthenticateOnNextActiveRef = useRef(false);

  const runHealthCheck = useCallback(async () => {
    setHealthStatus('checking');
    setHealthError(null);

    try {
      await checkDatabaseHealth();
      setHealthStatus('healthy');
    } catch (error) {
      setHealthStatus('recoverable_error');
      setHealthError(error instanceof Error ? error.message : t('common.unexpectedError'));
    }
  }, [t]);

  useEffect(() => {
    void runHealthCheck();
  }, [runHealthCheck]);

  const refreshPinAvailability = useCallback(async () => {
    const hasPin = await hasPinAsync();
    setPinEnabled(hasPin);
    return hasPin;
  }, []);

  const autoDisableLockWithWarning = useCallback(async () => {
    await setAppLockEnabled(false);
    setIsUnlocked(true);
    setPinEnabled(false);
    setPinValue('');
    setAuthError(t('auth.lockAutoDisabledNoMethod'));
    Alert.alert(t('settings.security.autoDisabledTitle'), t('auth.lockAutoDisabledNoMethod'));
  }, [setAppLockEnabled, t]);

  const authenticate = useCallback(async () => {
    if (authInFlightRef.current) {
      return;
    }

    authInFlightRef.current = true;
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const [hasHardware, isEnrolled, hasPin] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        refreshPinAvailability(),
      ]);

      if (!hasHardware || !isEnrolled) {
        if (hasPin) {
          setIsUnlocked(false);
          setAuthError(t('auth.noBiometricUsePin'));
          return;
        }

        await autoDisableLockWithWarning();
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('auth.unlockPrompt'),
        cancelLabel: t('common.cancel'),
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsUnlocked(true);
        setAuthError(null);
        setPinValue('');
        return;
      }

      setIsUnlocked(false);
      setAuthError(
        result.error === 'user_cancel' ? t('auth.canceledUseFaceOrPin') : t('auth.failedRetry'),
      );
    } catch {
      setIsUnlocked(false);
      setAuthError(t('auth.failedRetry'));
    } finally {
      authInFlightRef.current = false;
      setIsAuthenticating(false);
    }
  }, [autoDisableLockWithWarning, refreshPinAvailability, t]);

  const handlePinSubmit = useCallback(async () => {
    if (!pinEnabled) {
      setAuthError(t('auth.pinFallbackNotConfigured'));
      return;
    }

    try {
      const result = await verifyPinAsync(pinValue);
      if (result.success) {
        setIsUnlocked(true);
        setAuthError(null);
        setPinValue('');
        return;
      }

      if (result.lockedUntilEpochMs) {
        const seconds = Math.max(1, Math.ceil((result.lockedUntilEpochMs - Date.now()) / 1000));
        setAuthError(t('auth.pinLockedWithSeconds', { seconds }));
      } else {
        setAuthError(t('auth.pinIncorrectWithRemaining', { remaining: result.remainingAttempts }));
      }
    } catch {
      setAuthError(t('auth.pinVerifyFailed'));
    }
  }, [pinEnabled, pinValue, t]);

  useEffect(() => {
    if (healthStatus !== 'healthy') {
      setLockBootstrapped(false);
      return;
    }

    if (!isHydrated || lockBootstrapped) {
      return;
    }

    setLockBootstrapped(true);

    if (!preferences.appLockEnabled) {
      setIsUnlocked(true);
      setAuthError(null);
      setPinValue('');
      void refreshPinAvailability();
      return;
    }

    setIsUnlocked(false);
    void refreshPinAvailability();
    void authenticate();
  }, [
    authenticate,
    healthStatus,
    isHydrated,
    lockBootstrapped,
    preferences.appLockEnabled,
    refreshPinAvailability,
  ]);

  useEffect(() => {
    if (!lockBootstrapped) {
      return;
    }

    if (!preferences.appLockEnabled) {
      shouldAuthenticateOnNextActiveRef.current = false;
      setIsUnlocked(true);
      setAuthError(null);
      setPinValue('');
      void refreshPinAvailability();
      return;
    }

    void refreshPinAvailability();
  }, [lockBootstrapped, preferences.appLockEnabled, refreshPinAvailability]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previous = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background') {
        if (healthStatus === 'healthy' && lockBootstrapped && preferences.appLockEnabled) {
          shouldAuthenticateOnNextActiveRef.current = true;
          setIsUnlocked(false);
        }
        return;
      }

      const becameActive = previous !== 'active' && nextState === 'active';
      if (!becameActive || !shouldAuthenticateOnNextActiveRef.current) {
        return;
      }

      shouldAuthenticateOnNextActiveRef.current = false;
      if (healthStatus === 'healthy' && lockBootstrapped && preferences.appLockEnabled) {
        void authenticate();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [authenticate, healthStatus, lockBootstrapped, preferences.appLockEnabled]);

  const promptConfirmRestore = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      Alert.alert(t('recovery.restoreConfirmTitle'), t('recovery.restoreConfirmMessage'), [
        {
          text: t('common.cancel'),
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: t('recovery.restoreConfirmAction'),
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ]);
    });
  }, [t]);

  const handleRestoreFromBackup = useCallback(async () => {
    if (recoveryBusy) {
      return;
    }

    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (picked.canceled || picked.assets.length === 0) {
        return;
      }

      setRecoveryBusy(true);
      const backupUri = picked.assets[0].uri;
      const preflight = await preflightRestore(backupUri);
      if (!preflight.ok) {
        Alert.alert(
          t('recovery.invalidBackupTitle'),
          preflight.errors.join('\n') || t('recovery.invalidBackupFallback'),
        );
        return;
      }

      const confirmed = await promptConfirmRestore();
      if (!confirmed) {
        return;
      }

      await restoreBackup(backupUri);
      await reloadPreferences();
      await runHealthCheck();
    } catch (error) {
      Alert.alert(
        t('recovery.restoreFailedTitle'),
        error instanceof Error ? error.message : t('common.unexpectedError'),
      );
    } finally {
      setRecoveryBusy(false);
    }
  }, [promptConfirmRestore, recoveryBusy, reloadPreferences, runHealthCheck, t]);

  return (
    <ThemeProvider value={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />

      {healthStatus === 'healthy' ? (
        !isHydrated ? (
          <RecoveryGate
            isLoading
            error={null}
            recovering={false}
            onRetry={() => {}}
            onRestore={() => {}}
          />
        ) : preferences.appLockEnabled && !isUnlocked ? (
          <AppLockGate
            isAuthenticating={isAuthenticating}
            errorMessage={authError}
            pinEnabled={pinEnabled}
            pinValue={pinValue}
            onPinValueChange={setPinValue}
            onPinSubmit={() => {
              void handlePinSubmit();
            }}
            onUseBiometric={() => {
              void authenticate();
            }}
            onCancel={() => {
              setIsUnlocked(false);
              setAuthError(t('auth.canceledUseFaceOrPin'));
            }}
          />
        ) : (
          <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="vehicles/new" options={{ title: t('root.addVehicle') }} />
            <Stack.Screen name="vehicles/[vehicleId]" options={{ title: t('root.vehicleDetail') }} />
            <Stack.Screen name="vehicles/[vehicleId]/edit" options={{ title: t('root.editVehicle') }} />
            <Stack.Screen name="trips/new" options={{ title: t('root.addTrip') }} />
            <Stack.Screen name="fuel/new" options={{ title: t('root.addFuelEntry') }} />
            <Stack.Screen name="entries/[entryId]" options={{ title: t('root.entryDetail') }} />
            <Stack.Screen name="entries/[entryId]/edit" options={{ title: t('root.editEntry') }} />
            <Stack.Screen name="logs/export" options={{ title: t('root.exportLogs') }} />
            <Stack.Screen name="settings/appearance" options={{ title: t('root.appearance') }} />
            <Stack.Screen name="settings/security" options={{ title: t('root.security') }} />
            <Stack.Screen name="settings/backup-restore" options={{ title: t('root.backupRestore') }} />
          </Stack>
        )
      ) : (
        <RecoveryGate
          isLoading={healthStatus === 'checking'}
          error={healthError}
          recovering={recoveryBusy}
          onRetry={() => {
            void runHealthCheck();
          }}
          onRestore={() => {
            void handleRestoreFromBackup();
          }}
        />
      )}
    </ThemeProvider>
  );
}

type RecoveryGateProps = {
  isLoading: boolean;
  error: string | null;
  recovering: boolean;
  onRetry: () => void;
  onRestore: () => void;
};

function RecoveryGate({ isLoading, error, recovering, onRetry, onRestore }: RecoveryGateProps) {
  const { t } = useI18n();

  return (
    <ThemedView style={styles.recoveryContainer}>
      <View style={styles.recoveryContent}>
        <Card className="gap-2">
          <AppText variant="subtitle">{t('recovery.title')}</AppText>
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
              <AppText variant="caption" color="secondary">{t('recovery.checking')}</AppText>
            </View>
          ) : (
            <AppText variant="caption" color="destructive">
              {error ?? t('recovery.errorFallback')}
            </AppText>
          )}

          <Button
            label={t('common.retry')}
            variant="secondary"
            disabled={recovering || isLoading}
            onPress={onRetry}
          />
          <Button
            label={recovering ? t('recovery.restoring') : t('recovery.restoreAction')}
            variant="destructive"
            loading={recovering}
            disabled={isLoading}
            onPress={onRestore}
          />
        </Card>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  recoveryContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  recoveryContent: {
    width: '100%',
    maxWidth: 420,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
