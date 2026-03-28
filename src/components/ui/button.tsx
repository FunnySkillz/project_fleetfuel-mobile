import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import { ActivityIndicator, Pressable, type PressableProps, Text, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

import { type SemanticTone, toneBorderClass } from './tone';

const buttonVariants = cva(
  'flex-row items-center justify-center rounded-xl active:opacity-80 disabled:opacity-45',
  {
    variants: {
      variant: {
        primary: 'bg-accent dark:bg-dark-accent',
        secondary: 'bg-surface dark:bg-dark-surface',
        destructive: 'bg-destructive dark:bg-dark-destructive',
        ghost: 'border bg-transparent',
      },
      size: {
        default: 'min-h-11 px-4 py-3',
        sm: 'min-h-9 px-3 py-2',
        lg: 'min-h-12 px-5 py-3',
      },
      tone: {
        neutral: '',
        success: '',
        warning: '',
        destructive: '',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'default',
      tone: 'neutral',
    },
  },
);

const labelVariants = cva('text-sm font-semibold', {
  variants: {
    variant: {
      primary: 'text-white',
      secondary: 'text-text dark:text-dark-text',
      destructive: 'text-white',
      ghost: 'text-text dark:text-dark-text',
    },
  },
  defaultVariants: {
    variant: 'secondary',
  },
});

type ButtonProps = PressableProps &
  VariantProps<typeof buttonVariants> & {
    label: string;
    loading?: boolean;
    loadingLabel?: string;
    tone?: SemanticTone;
    className?: string;
    textClassName?: string;
  };

export function Button({
  label,
  className,
  textClassName,
  variant,
  size,
  tone = 'neutral',
  loading = false,
  loadingLabel,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const indicatorColor =
    variant === 'primary' || variant === 'destructive' ? theme.background : theme.text;
  const toneBorder = variant === 'ghost' ? toneBorderClass[tone] : tone !== 'neutral' ? toneBorderClass[tone] : '';

  const mergedStyle = typeof style === 'function' ? style : ({ pressed }: { pressed: boolean }) =>
    [style as ViewStyle | undefined, pressed && !isDisabled ? { opacity: 0.88 } : undefined];

  return (
    <Pressable
      className={cn(buttonVariants({ variant, size, tone }), toneBorder, isDisabled && 'opacity-45', className)}
      disabled={isDisabled}
      accessibilityState={{ ...(props.accessibilityState ?? {}), disabled: isDisabled }}
      style={mergedStyle}
      {...props}>
      {loading ? <ActivityIndicator color={indicatorColor} size="small" /> : null}
      <Text className={cn(labelVariants({ variant }), loading && 'ml-2', textClassName)}>
        {loading ? loadingLabel ?? label : label}
      </Text>
    </Pressable>
  );
}
