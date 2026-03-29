import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

import { type SemanticTone, toneBorderColor } from './tone';

const inputVariants = cva('rounded-xl border text-base', {
  variants: {
    variant: {
      default: '',
      subtle: '',
      ghost: 'bg-transparent',
    },
    size: {
      sm: 'px-3 py-2 text-sm',
      default: 'px-4 py-3',
      lg: 'px-4 py-3.5 text-base',
    },
    tone: {
      neutral: '',
      success: '',
      warning: '',
      destructive: '',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
    tone: 'neutral',
  },
});

type InputProps = TextInputProps &
  VariantProps<typeof inputVariants> & {
    className?: string;
    tone?: SemanticTone;
    loading?: boolean;
    disabled?: boolean;
  };

export function Input({
  className,
  variant,
  size,
  tone = 'neutral',
  disabled,
  loading = false,
  editable,
  style,
  ...props
}: InputProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading || editable === false;
  const borderColor = toneBorderColor(theme, tone);
  const backgroundColor =
    variant === 'subtle' ? theme.backgroundElement : variant === 'ghost' ? 'transparent' : theme.background;

  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      editable={!isDisabled}
      className={cn(
        inputVariants({ variant, size, tone }),
        isDisabled && 'opacity-60',
        className,
      )}
      style={[{ color: theme.text, backgroundColor, borderColor }, style]}
      {...props}
    />
  );
}
