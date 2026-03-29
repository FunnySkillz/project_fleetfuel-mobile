import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type PressableStateCallbackType,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

import { AppText } from './app-text';
import { type SemanticTone, toneBorderColor, toneTextColor } from './tone';

const chipVariants = cva('rounded-full active:opacity-80 border', {
  variants: {
    variant: {
      solid: '',
      outline: 'bg-transparent',
    },
    size: {
      sm: 'px-2.5 py-1',
      default: 'px-3 py-1.5',
      lg: 'px-3.5 py-2',
    },
    active: {
      true: '',
      false: '',
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
  style,
  ...props
}: ChipProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const toneColor = toneTextColor(theme, tone);
  const borderColor = variant === 'outline' || tone !== 'neutral' ? toneBorderColor(theme, tone) : 'transparent';
  const backgroundColor =
    variant === 'outline'
      ? 'transparent'
      : active
        ? theme.backgroundSelected
        : theme.backgroundElement;
  const baseStyle: ViewStyle = { borderColor, backgroundColor };
  const mergedStyle = (pressableState: PressableStateCallbackType) => {
    const computedStyle = typeof style === 'function' ? style(pressableState) : style;
    return [baseStyle, computedStyle as ViewStyle | undefined];
  };

  return (
    <Pressable
      className={cn(chipVariants({ active, size, variant, tone }), isDisabled && 'opacity-45', className)}
      style={mergedStyle}
      disabled={isDisabled}
      accessibilityState={{ ...(props.accessibilityState ?? {}), disabled: isDisabled }}
      {...props}>
      {loading ? <ActivityIndicator size="small" color={theme.textSecondary} /> : null}
      <AppText
        variant="label"
        className={cn(loading && 'mt-1')}
        style={{ color: tone === 'neutral' ? theme.text : toneColor }}>
        {label}
      </AppText>
    </Pressable>
  );
}
