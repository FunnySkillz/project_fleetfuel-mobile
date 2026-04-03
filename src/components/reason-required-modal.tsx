import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

import { AppText, Button, Card, TextArea } from './ui';

const DEFAULT_MIN_LENGTH = 5;
const DEFAULT_MAX_LENGTH = 300;

type ReasonRequiredModalProps = {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  initialValue?: string;
  minLength?: number;
  maxLength?: number;
};

function normalizeReasonInput(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function ReasonRequiredModal({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel,
  submitting = false,
  onCancel,
  onConfirm,
  initialValue = '',
  minLength = DEFAULT_MIN_LENGTH,
  maxLength = DEFAULT_MAX_LENGTH,
}: ReasonRequiredModalProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [reason, setReason] = useState(initialValue);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setReason(initialValue);
    setTouched(false);
  }, [initialValue, visible]);

  const normalized = useMemo(() => normalizeReasonInput(reason), [reason]);
  const errorMessage = useMemo(() => {
    if (normalized.length === 0) {
      return t('audit.reason.errorRequired');
    }
    if (normalized.length < minLength) {
      return t('audit.reason.errorMin', { min: minLength });
    }
    if (normalized.length > maxLength) {
      return t('audit.reason.errorMax', { max: maxLength });
    }
    return null;
  }, [maxLength, minLength, normalized.length, t]);
  const canConfirm = !errorMessage && !submitting;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          style={styles.dialogWrap}>
          <Card style={[styles.dialog, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
            <View style={styles.header}>
              <AppText variant="subtitle">{title}</AppText>
              {description ? (
                <AppText variant="caption" color="secondary">
                  {description}
                </AppText>
              ) : null}
            </View>

            <View style={styles.fieldWrap}>
              <AppText variant="label">{t('audit.reason.label')}</AppText>
              <TextArea
                value={reason}
                onChangeText={(value) => setReason(value.slice(0, maxLength))}
                onBlur={() => setTouched(true)}
                placeholder={t('audit.reason.placeholder')}
                autoCapitalize="sentences"
                maxLength={maxLength}
                editable={!submitting}
                tone={touched && errorMessage ? 'destructive' : 'neutral'}
              />
              <View style={styles.metaRow}>
                <AppText variant="caption" color={touched && errorMessage ? 'destructive' : 'secondary'}>
                  {t('common.charCount', { current: normalized.length, max: maxLength })}
                </AppText>
              </View>
              {touched && errorMessage ? (
                <AppText variant="caption" color="destructive">
                  {errorMessage}
                </AppText>
              ) : null}
            </View>

            <View style={styles.actions}>
              <Button
                label={cancelLabel ?? t('common.cancel')}
                variant="ghost"
                disabled={submitting}
                onPress={onCancel}
                className="flex-1"
              />
              <Button
                label={confirmLabel}
                variant="primary"
                disabled={!canConfirm}
                loading={submitting}
                onPress={() => {
                  setTouched(true);
                  if (errorMessage) {
                    return;
                  }
                  onConfirm(normalized);
                }}
                className="flex-1"
              />
            </View>
          </Card>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  dialogWrap: {
    width: '100%',
    alignSelf: 'center',
    maxWidth: 520,
  },
  dialog: {
    gap: 12,
  },
  header: {
    gap: 4,
  },
  fieldWrap: {
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});

