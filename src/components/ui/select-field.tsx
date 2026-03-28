import React from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/cn';

import { Chip } from './chip';
import { type SemanticTone } from './tone';

export type SelectFieldOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectFieldProps = {
  options: SelectFieldOption[];
  value?: string | null;
  values?: string[];
  onChange?: (value: string) => void;
  onToggle?: (value: string) => void;
  multi?: boolean;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'solid' | 'outline';
  size?: 'sm' | 'default' | 'lg';
  tone?: SemanticTone;
  className?: string;
  optionClassName?: string;
};

export function SelectField({
  options,
  value,
  values,
  onChange,
  onToggle,
  multi = false,
  disabled = false,
  loading = false,
  variant = 'solid',
  size = 'default',
  tone = 'neutral',
  className,
  optionClassName,
}: SelectFieldProps) {
  const selectedValues = values ?? (value ? [value] : []);

  return (
    <View className={cn('flex-row flex-wrap gap-2', className)}>
      {options.map((option) => {
        const active = selectedValues.includes(option.value);
        const optionDisabled = disabled || loading || option.disabled;

        return (
          <Chip
            key={option.value}
            label={option.label}
            active={active}
            variant={variant}
            size={size}
            tone={tone}
            disabled={optionDisabled}
            loading={loading && active}
            className={optionClassName}
            onPress={() => {
              if (optionDisabled) {
                return;
              }

              if (multi) {
                onToggle?.(option.value);
                return;
              }

              onChange?.(option.value);
            }}
          />
        );
      })}
    </View>
  );
}
