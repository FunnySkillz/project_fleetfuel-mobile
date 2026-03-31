import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { AppText, Button, Card, Input } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

type AppLockGateProps = {
  isAuthenticating: boolean;
  errorMessage: string | null;
  pinEnabled: boolean;
  pinValue: string;
  onPinValueChange: (value: string) => void;
  onPinSubmit: () => void;
  onUseBiometric: () => void;
  onCancel: () => void;
};

export function AppLockGate({
  isAuthenticating,
  errorMessage,
  pinEnabled,
  pinValue,
  onPinValueChange,
  onPinSubmit,
  onUseBiometric,
  onCancel,
}: AppLockGateProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ThemedView style={[styles.container, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}>
        <View style={styles.content}>
          <Card className="gap-3" style={styles.card}>
            <AppText variant="subtitle" className="text-center">
              {t('appLock.title')}
            </AppText>
            <AppText variant="caption" color="secondary" className="text-center">
              {t('appLock.subtitle')}
            </AppText>

            {pinEnabled ? (
              <View style={styles.pinWrap}>
                <Input
                  value={pinValue}
                  onChangeText={onPinValueChange}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  placeholder={t('appLock.pinPlaceholder')}
                  style={styles.pinInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={onPinSubmit}
                  textContentType="oneTimeCode"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  testID="app-lock-pin-input"
                />

                {errorMessage ? (
                  <AppText variant="caption" color="destructive" testID="app-lock-error">
                    {errorMessage}
                  </AppText>
                ) : null}

                <Button
                  label={t('appLock.unlock')}
                  variant="primary"
                  onPress={onPinSubmit}
                  disabled={isAuthenticating}
                  testID="app-lock-unlock"
                />
              </View>
            ) : null}

            {!pinEnabled && errorMessage ? (
              <AppText variant="caption" color="destructive" testID="app-lock-error">
                {errorMessage}
              </AppText>
            ) : null}

            {pinEnabled ? (
              <View style={styles.orRow}>
                <View style={[styles.orLine, { backgroundColor: theme.backgroundSelected }]} />
                <AppText variant="caption" color="secondary">
                  {t('appLock.or')}
                </AppText>
                <View style={[styles.orLine, { backgroundColor: theme.backgroundSelected }]} />
              </View>
            ) : null}

            <View style={styles.actionWrap}>
              <Button
                label={isAuthenticating ? t('appLock.authenticating') : t('appLock.useBiometric')}
                variant="secondary"
                onPress={onUseBiometric}
                disabled={isAuthenticating}
                testID="app-lock-use-biometric"
              />
              <Button
                label={t('appLock.cancel')}
                variant="ghost"
                onPress={onCancel}
                testID="app-lock-cancel"
              />
            </View>
          </Card>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  content: {
    width: '100%',
    maxWidth: 520,
  },
  card: {
    width: '100%',
  },
  pinWrap: {
    gap: Spacing.two,
  },
  pinInput: {
    letterSpacing: 1.2,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  actionWrap: {
    gap: Spacing.two,
  },
});
