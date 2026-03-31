import { Picker } from '@react-native-picker/picker';
import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

import { AppText } from './app-text';
import { Button } from './button';
import { Input } from './input';
import { type SemanticTone } from './tone';

type YearPickerFieldProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  minYear: number;
  maxYear: number;
  placeholder?: string;
  className?: string;
  variant?: 'default' | 'subtle' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  tone?: SemanticTone;
  loading?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  onBlur?: () => void;
};

export function YearPickerField({
  value,
  onChange,
  minYear,
  maxYear,
  placeholder,
  className,
  variant,
  size,
  tone,
  loading = false,
  disabled = false,
  clearable = false,
  onBlur,
}: YearPickerFieldProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draftYear, setDraftYear] = useState<number>(value ?? maxYear);

  const years = useMemo(() => {
    const values: number[] = [];
    for (let year = maxYear; year >= minYear; year -= 1) {
      values.push(year);
    }
    return values;
  }, [maxYear, minYear]);

  const openPicker = () => {
    if (disabled || loading) {
      return;
    }

    setDraftYear(value ?? maxYear);
    setOpen(true);
  };

  const closePicker = () => {
    setOpen(false);
    onBlur?.();
  };

  const confirmSelection = () => {
    onChange(draftYear);
    closePicker();
  };

  const clearSelection = () => {
    onChange(null);
    onBlur?.();
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={openPicker} accessibilityRole="button" accessibilityLabel={placeholder ?? t('vehicleForm.field.year')}>
        <View pointerEvents="none">
          <Input
            value={value === null ? '' : String(value)}
            placeholder={placeholder}
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

      {clearable && value !== null ? (
        <Button
          label={t('common.clear')}
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={disabled || loading}
          onPress={clearSelection}
        />
      ) : null}

      <Modal transparent animationType="slide" visible={open} onRequestClose={closePicker}>
        <Pressable style={styles.backdrop} onPress={closePicker} />
        <View style={[styles.sheet, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
          <View style={styles.sheetHeader}>
            <Button label={t('common.cancel')} variant="ghost" size="sm" onPress={closePicker} />
            <AppText variant="label">{t('vehicleForm.field.year')}</AppText>
            <Button label={t('common.done')} variant="ghost" size="sm" onPress={confirmSelection} />
          </View>
          <Picker
            selectedValue={draftYear}
            onValueChange={(next) => {
              if (typeof next === 'number') {
                setDraftYear(next);
              }
            }}
            itemStyle={Platform.OS === 'ios' ? { color: theme.text } : undefined}>
            {years.map((year) => (
              <Picker.Item key={year} label={String(year)} value={year} />
            ))}
          </Picker>
        </View>
      </Modal>
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

