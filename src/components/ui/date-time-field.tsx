import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

import { AppText } from './app-text';
import { Button } from './button';
import { Input } from './input';
import { type SemanticTone } from './tone';

type DateTimeFieldMode = 'date' | 'time' | 'datetime';

type DateTimeFieldProps = {
  mode?: DateTimeFieldMode;
  value?: string;
  onChangeText?: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  variant?: 'default' | 'subtle' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  tone?: SemanticTone;
  loading?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  onClear?: () => void;
};

function defaultPlaceholder(mode: DateTimeFieldMode) {
  if (mode === 'time') {
    return '08:30';
  }
  if (mode === 'datetime') {
    return '2026-03-28 08:30';
  }

  return '2026-03-28';
}

function parseDateValue(mode: DateTimeFieldMode, value?: string) {
  if (!value || value.trim().length === 0) {
    return new Date();
  }

  if (mode === 'time') {
    const match = value.trim().match(/^(\d{2}):(\d{2})$/);
    if (!match) {
      return new Date();
    }

    const parsed = new Date();
    parsed.setHours(Number.parseInt(match[1], 10), Number.parseInt(match[2], 10), 0, 0);
    return parsed;
  }

  if (mode === 'datetime') {
    const parsed = new Date(value.trim().replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  const parsed = new Date(`${value.trim()}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateValue(mode: DateTimeFieldMode, value: Date) {
  if (mode === 'time') {
    return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }

  const date = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  if (mode === 'datetime') {
    return `${date} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }

  return date;
}

function pickerMode(mode: DateTimeFieldMode): 'date' | 'time' | 'datetime' {
  if (mode === 'datetime') {
    return Platform.OS === 'ios' ? 'datetime' : 'date';
  }

  return mode;
}

export function DateTimeField({
  mode = 'date',
  value,
  onChangeText,
  onBlur,
  placeholder,
  className,
  variant,
  size,
  tone,
  loading = false,
  disabled = false,
  clearable = false,
  onClear,
}: DateTimeFieldProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState<Date>(() => parseDateValue(mode, value));
  const resolvedPickerMode = pickerMode(mode);

  const displayValue = useMemo(() => value ?? '', [value]);

  const closePicker = () => {
    setOpen(false);
    onBlur?.();
  };

  const openPicker = () => {
    if (disabled || loading) {
      return;
    }

    setDraftValue(parseDateValue(mode, value));
    setOpen(true);
  };

  const applyValue = (nextValue: Date) => {
    onChangeText?.(formatDateValue(mode, nextValue));
  };

  const handleAndroidChange = (event: DateTimePickerEvent, selectedValue?: Date) => {
    if (event.type === 'dismissed') {
      closePicker();
      return;
    }

    if (selectedValue) {
      applyValue(selectedValue);
    }

    closePicker();
  };

  const handleIosChange = (_event: DateTimePickerEvent, selectedValue?: Date) => {
    if (selectedValue) {
      setDraftValue(selectedValue);
    }
  };

  const confirmIosSelection = () => {
    applyValue(draftValue);
    closePicker();
  };

  const clearValue = () => {
    onClear?.();
    onBlur?.();
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={openPicker} accessibilityRole="button" accessibilityLabel={placeholder ?? t('common.selectDate')}>
        <View pointerEvents="none">
          <Input
            value={displayValue}
            placeholder={placeholder ?? defaultPlaceholder(mode)}
            editable={false}
            className={className}
            variant={variant}
            size={size}
            tone={tone}
            loading={loading}
            disabled={disabled}
          />
        </View>
      </Pressable>

      {clearable && displayValue.trim().length > 0 ? (
        <Button
          label={t('common.clear')}
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={disabled || loading}
          onPress={clearValue}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal transparent animationType="slide" visible={open} onRequestClose={closePicker}>
          <Pressable style={styles.backdrop} onPress={closePicker} />
          <View style={[styles.sheet, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
            <View style={styles.sheetHeader}>
              <Button label={t('common.cancel')} variant="ghost" size="sm" onPress={closePicker} />
              <AppText variant="label">{mode === 'time' ? t('common.selectTime') : t('common.selectDate')}</AppText>
              <Button label={t('common.done')} variant="ghost" size="sm" onPress={confirmIosSelection} />
            </View>
            <DateTimePicker
              mode={resolvedPickerMode}
              value={draftValue}
              display="spinner"
              onChange={handleIosChange}
              textColor={theme.text}
            />
          </View>
        </Modal>
      ) : null}

      {Platform.OS !== 'ios' && open ? (
        <DateTimePicker
          mode={resolvedPickerMode}
          value={parseDateValue(mode, value)}
          display="default"
          onChange={handleAndroidChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

