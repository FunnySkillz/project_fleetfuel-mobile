import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

import { type SemanticTone, toneBorderClass } from './tone';

const inputVariants = cva(
  'rounded-xl border text-base text-text dark:text-dark-text',
  {
    variants: {
      variant: {
        default: 'bg-background dark:bg-dark-background',
        subtle: 'bg-surface dark:bg-dark-surface',
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
  },
);

type InputProps = TextInputProps &
  VariantProps<typeof inputVariants> & {
    className?: string;
    tone?: SemanticTone;
    loading?: boolean;
    disabled?: boolean;
  };

export function Input({ className, variant, size, tone = 'neutral', disabled, loading = false, editable, ...props }: InputProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading || editable === false;

  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      editable={!isDisabled}
      className={cn(
        inputVariants({ variant, size, tone }),
        toneBorderClass[tone],
        isDisabled && 'opacity-60',
        className,
      )}
      {...props}
    />
  );
}
