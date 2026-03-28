import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

import { type SemanticTone, toneBorderClass } from './tone';

const chipVariants = cva('rounded-full active:opacity-80', {
  variants: {
    variant: {
      solid: '',
      outline: 'border bg-transparent',
    },
    size: {
      sm: 'px-2.5 py-1',
      default: 'px-3 py-1.5',
      lg: 'px-3.5 py-2',
    },
    active: {
      true: 'bg-surfaceActive dark:bg-dark-surfaceActive',
      false: 'bg-surface dark:bg-dark-surface',
    },
    tone: {
      neutral: '',
      success: '',
      warning: '',
      destructive: '',
    },
  },
  defaultVariants: {
    variant: 'solid',
    size: 'default',
    active: false,
    tone: 'neutral',
  },
});

type ChipProps = PressableProps &
  VariantProps<typeof chipVariants> & {
  label: string;
  active?: boolean;
  loading?: boolean;
  tone?: SemanticTone;
  className?: string;
};

export function Chip({
  label,
  active = false,
  className,
  loading = false,
  disabled,
  size,
  variant,
  tone = 'neutral',
  ...props
}: ChipProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const toneBorder = variant === 'outline' ? toneBorderClass[tone] : tone !== 'neutral' ? toneBorderClass[tone] : '';

  return (
    <Pressable
      className={cn(chipVariants({ active, size, variant, tone }), toneBorder, isDisabled && 'opacity-45', className)}
      disabled={isDisabled}
      accessibilityState={{ ...(props.accessibilityState ?? {}), disabled: isDisabled }}
      {...props}>
      {loading ? <ActivityIndicator size="small" color={theme.textSecondary} /> : null}
      <Text className={cn('text-sm font-medium text-text dark:text-dark-text', loading && 'mt-1')}>{label}</Text>
    </Pressable>
  );
}
