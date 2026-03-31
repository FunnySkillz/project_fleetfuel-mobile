import * as LocalAuthentication from 'expo-local-authentication';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { AppText, Button, Card, FormField, Input, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAppPreferences } from '@/hooks/use-app-preferences';
import { useI18n } from '@/hooks/use-i18n';
import { clearPinAsync, hasPinAsync, isValidPin, setPinAsync, verifyPinAsync } from '@/services/pin-auth';

type PinFieldErrors = {
  currentPin?: string;
  newPin?: string;
  confirmPin?: string;
};

export default function SecurityScreen() {
  const { preferences, setAppLockEnabled } = useAppPreferences();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [pinExists, setPinExists] = useState(false);
  const [isSavingAppLock, setIsSavingAppLock] = useState(false);
  const [isConfirmingAppLock, setIsConfirmingAppLock] = useState(false);
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [isRemovingPin, setIsRemovingPin] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<PinFieldErrors>({});
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const loadPinState = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      setPinExists(await hasPinAsync());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('common.unexpectedError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadPinState();
  }, [loadPinState]);

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const confirmEnableAppLock = useCallback(async () => {
    setIsConfirmingAppLock(true);
    try {
      const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);

      if (!hasHardware || !isEnrolled) {
        setErrorMessage(t('settings.security.appLock.biometricUnavailable'));
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('settings.security.appLock.confirmPrompt'),
        cancelLabel: t('common.cancel'),
        disableDeviceFallback: false,
      });

      if (!result.success) {
        setErrorMessage(
          result.error === 'user_cancel'
            ? t('settings.security.appLock.confirmCanceled')
            : t('settings.security.appLock.confirmFailed'),
        );
        return false;
      }

      return true;
    } catch {
      setErrorMessage(t('settings.security.appLock.confirmError'));
      return false;
    } finally {
      setIsConfirmingAppLock(false);
    }
  }, [t]);

  const handleToggleAppLock = async (nextValue: boolean) => {
    if (isSavingAppLock || isConfirmingAppLock) {
      return;
    }

    clearMessages();

    if (nextValue) {
      const confirmed = await confirmEnableAppLock();
      if (!confirmed) {
        return;
      }
    }

    setIsSavingAppLock(true);
    try {
      await setAppLockEnabled(nextValue);
      setSuccessMessage(
        nextValue ? t('settings.security.appLock.enabled') : t('settings.security.appLock.disabled'),
      );
    } catch {
      setErrorMessage(t('settings.security.appLock.saveError'));
    } finally {
      setIsSavingAppLock(false);
    }
  };

  const pinFieldErrors = useMemo<PinFieldErrors>(() => {
    const errors: PinFieldErrors = {};

    if (pinExists && currentPin.trim().length === 0) {
      errors.currentPin = t('settings.security.pin.currentRequired');
    }

    if (!isValidPin(newPin)) {
      errors.newPin = t('settings.security.pin.invalidFormat');
    }

    if (confirmPin.trim().length === 0) {
      errors.confirmPin = t('settings.security.pin.confirmRequired');
    } else if (confirmPin !== newPin) {
      errors.confirmPin = t('settings.security.pin.confirmMismatch');
    }

    return errors;
  }, [confirmPin, currentPin, newPin, pinExists, t]);

  const hasPinErrors = Object.keys(pinFieldErrors).length > 0;

  const handleSavePin = async () => {
    if (isSavingPin || isRemovingPin) {
      return;
    }

    clearMessages();
    setFieldErrors(pinFieldErrors);

    if (hasPinErrors) {
      return;
    }

    setIsSavingPin(true);
    try {
      if (pinExists) {
        const verification = await verifyPinAsync(currentPin);
        if (!verification.success) {
          if (verification.lockedUntilEpochMs) {
            const seconds = Math.max(
              1,
              Math.ceil((verification.lockedUntilEpochMs - Date.now()) / 1000),
            );
            setErrorMessage(t('auth.pinLockedWithSeconds', { seconds }));
          } else {
            setErrorMessage(t('settings.security.pin.currentIncorrect'));
          }
          return;
        }
      }

      await setPinAsync(newPin);
      setPinExists(true);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setFieldErrors({});
      setSuccessMessage(t('settings.security.pin.saved'));
    } catch {
      setErrorMessage(t('settings.security.pin.saveError'));
    } finally {
      setIsSavingPin(false);
    }
  };

  const handleRemovePin = async () => {
    if (isSavingPin || isRemovingPin || !pinExists) {
      return;
    }

    clearMessages();

    if (currentPin.trim().length === 0) {
      setFieldErrors({ currentPin: t('settings.security.pin.currentRequired') });
      return;
    }

    setIsRemovingPin(true);
    try {
      const verification = await verifyPinAsync(currentPin);
      if (!verification.success) {
        if (verification.lockedUntilEpochMs) {
          const seconds = Math.max(
            1,
            Math.ceil((verification.lockedUntilEpochMs - Date.now()) / 1000),
          );
          setErrorMessage(t('auth.pinLockedWithSeconds', { seconds }));
        } else {
          setErrorMessage(t('settings.security.pin.currentIncorrect'));
        }
        return;
      }

      await clearPinAsync();
      await setAppLockEnabled(false);
      setPinExists(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setFieldErrors({});
      setSuccessMessage(t('settings.security.pin.removed'));
    } catch {
      setErrorMessage(t('settings.security.pin.removeError'));
    } finally {
      setIsRemovingPin(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <SectionHeader title={t('settings.security.title')} description={t('settings.security.description')} />

          {loading ? (
            <Card className="gap-2">
              <View style={styles.loadingRow}>
                <ActivityIndicator />
                <AppText variant="caption" color="secondary">
                  {t('settings.security.loading')}
                </AppText>
              </View>
            </Card>
          ) : (
            <>
              <Card className="gap-3">
                <AppText variant="label">{t('settings.security.appLock.title')}</AppText>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleText}>
                    <AppText variant="caption" color="secondary">
                      {t('settings.security.appLock.toggleHint')}
                    </AppText>
                  </View>
                  <Switch
                    value={preferences.appLockEnabled}
                    onValueChange={(value) => {
                      void handleToggleAppLock(value);
                    }}
                    disabled={isSavingAppLock || isConfirmingAppLock}
                  />
                </View>
              </Card>

              <Card className="gap-3">
                <AppText variant="label">{t('settings.security.pin.title')}</AppText>
                <AppText variant="caption" color="secondary">
                  {pinExists ? t('settings.security.pin.configured') : t('settings.security.pin.notConfigured')}
                </AppText>

                {pinExists ? (
                  <FormField
                    label={t('settings.security.pin.currentLabel')}
                    error={fieldErrors.currentPin ?? null}>
                    <Input
                      value={currentPin}
                      onChangeText={(value) => {
                        setCurrentPin(value);
                        if (fieldErrors.currentPin) {
                          setFieldErrors((current) => ({ ...current, currentPin: undefined }));
                        }
                      }}
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={6}
                      autoComplete="off"
                      textContentType="oneTimeCode"
                      autoCorrect={false}
                      spellCheck={false}
                      placeholder={t('settings.security.pin.currentPlaceholder')}
                    />
                  </FormField>
                ) : null}

                <FormField label={t('settings.security.pin.newLabel')} error={fieldErrors.newPin ?? null}>
                  <Input
                    value={newPin}
                    onChangeText={(value) => {
                      setNewPin(value);
                      if (fieldErrors.newPin) {
                        setFieldErrors((current) => ({ ...current, newPin: undefined }));
                      }
                    }}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                    autoComplete="off"
                    textContentType="oneTimeCode"
                    autoCorrect={false}
                    spellCheck={false}
                    placeholder={pinExists ? t('settings.security.pin.newPlaceholder') : t('settings.security.pin.firstPlaceholder')}
                  />
                </FormField>

                <FormField label={t('settings.security.pin.confirmLabel')} error={fieldErrors.confirmPin ?? null}>
                  <Input
                    value={confirmPin}
                    onChangeText={(value) => {
                      setConfirmPin(value);
                      if (fieldErrors.confirmPin) {
                        setFieldErrors((current) => ({ ...current, confirmPin: undefined }));
                      }
                    }}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={6}
                    autoComplete="off"
                    textContentType="oneTimeCode"
                    autoCorrect={false}
                    spellCheck={false}
                    placeholder={t('settings.security.pin.confirmPlaceholder')}
                  />
                </FormField>

                <View style={styles.pinActions}>
                  <Button
                    label={
                      isSavingPin
                        ? t('settings.security.pin.saving')
                        : pinExists
                          ? t('settings.security.pin.change')
                          : t('settings.security.pin.set')
                    }
                    variant="secondary"
                    loading={isSavingPin}
                    disabled={isRemovingPin}
                    onPress={() => {
                      void handleSavePin();
                    }}
                  />

                  {pinExists ? (
                    <Button
                      label={isRemovingPin ? t('settings.security.pin.removing') : t('settings.security.pin.remove')}
                      variant="destructive"
                      loading={isRemovingPin}
                      disabled={isSavingPin}
                      onPress={() => {
                        void handleRemovePin();
                      }}
                    />
                  ) : null}
                </View>
              </Card>

              {errorMessage ? (
                <Card variant="outline" tone="destructive">
                  <AppText variant="caption" color="destructive">{errorMessage}</AppText>
                </Card>
              ) : null}

              {successMessage ? (
                <Card variant="outline" tone="success">
                  <AppText variant="caption" color="success">{successMessage}</AppText>
                </Card>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  toggleText: {
    flex: 1,
  },
  pinActions: {
    gap: Spacing.two,
  },
});
