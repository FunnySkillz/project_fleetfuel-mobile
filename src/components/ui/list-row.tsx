import { cva, type VariantProps } from 'class-variance-authority';
import React, { type ReactNode } from 'react';
import {
  Pressable,
  View,
  type PressableProps,
  type PressableStateCallbackType,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

import { AppText } from './app-text';
import { type SemanticTone, toneBorderColor, toneMutedTextColor, toneTextColor } from './tone';

const rowVariants = cva('rounded-xl border active:opacity-80', {
  variants: {
    variant: {
      elevated: '',
      outline: '',
      ghost: 'border-transparent bg-transparent',
    },
    size: {
      sm: 'px-3 py-2',
      default: 'px-4 py-3',
      lg: 'px-4 py-4',
    },
    tone: {
      neutral: '',
      success: '',
      warning: '',
      destructive: '',
    },
  },
  defaultVariants: {
    variant: 'elevated',
    size: 'default',
    tone: 'neutral',
  },
});

type ListRowProps = PressableProps &
  VariantProps<typeof rowVariants> & {
    title: string;
    subtitle?: string;
    meta?: string;
    trailing?: ReactNode;
    tone?: SemanticTone;
    disabled?: boolean;
    loading?: boolean;
    className?: string;
    titleClassName?: string;
    subtitleClassName?: string;
    metaClassName?: string;
  };

export function ListRow({
  title,
  subtitle,
  meta,
  trailing,
  variant,
  size,
  tone = 'neutral',
  disabled,
  loading,
  className,
  titleClassName,
  subtitleClassName,
  metaClassName,
  style,
  ...props
}: ListRowProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const borderColor = toneBorderColor(theme, tone);
  const backgroundColor =
    variant === 'ghost'
      ? 'transparent'
      : variant === 'outline'
        ? theme.background
        : theme.backgroundElement;
  const titleColor = toneTextColor(theme, tone);
  const mutedColor = toneMutedTextColor(theme, tone);
  const baseStyle: ViewStyle = { borderColor, backgroundColor };
  const mergedStyle = (pressableState: PressableStateCallbackType) => {
    const computedStyle = typeof style === 'function' ? style(pressableState) : style;
    return [baseStyle, computedStyle as ViewStyle | undefined];
  };

  return (
    <Pressable
      className={cn(
        rowVariants({ variant, size, tone }),
        isDisabled && 'opacity-45',
        className,
      )}
      style={mergedStyle}
      disabled={isDisabled}
      accessibilityState={{ ...(props.accessibilityState ?? {}), disabled: isDisabled }}
      {...props}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <AppText
            variant="label"
            className={titleClassName}
            style={{ color: titleColor }}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText
              variant="caption"
              className={subtitleClassName}
              style={{ color: mutedColor }}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <View className="items-end gap-0.5">
          {meta ? (
            <AppText
              variant="caption"
              className={metaClassName}
              style={{ color: mutedColor }}>
              {meta}
            </AppText>
          ) : null}
          {trailing ?? (
            <AppText variant="caption" color="secondary">
              {'>'}
            </AppText>
          )}
        </View>
      </View>
    </Pressable>
  );
}
