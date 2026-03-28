import React from 'react';
import { type TextInputProps } from 'react-native';

import { Input } from './input';
import { type SemanticTone } from './tone';

type DateTimeFieldMode = 'date' | 'time' | 'datetime';

type DateTimeFieldProps = Omit<TextInputProps, 'keyboardType'> & {
  mode?: DateTimeFieldMode;
  className?: string;
  variant?: 'default' | 'subtle' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  tone?: SemanticTone;
  loading?: boolean;
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

export function DateTimeField({
  mode = 'date',
  placeholder,
  autoCapitalize,
  autoCorrect,
  variant,
  size,
  tone,
  loading,
  ...props
}: DateTimeFieldProps) {
  return (
    <Input
      placeholder={placeholder ?? defaultPlaceholder(mode)}
      keyboardType="numbers-and-punctuation"
      autoCapitalize={autoCapitalize ?? 'none'}
      autoCorrect={autoCorrect ?? false}
      variant={variant}
      size={size}
      tone={tone}
      loading={loading}
      {...props}
    />
  );
}
