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

const buttonVariants = cva(
  'flex-row items-center justify-center rounded-xl active:opacity-80 disabled:opacity-45 border',
  {
    variants: {
      variant: {
        primary: '',
        secondary: '',
        destructive: '',
        ghost: 'bg-transparent',
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

type ButtonProps = PressableProps &
  VariantProps<typeof buttonVariants> & {
    label: string;
    loading?: boolean;
    loadingLabel?: string;
    tone?: SemanticTone;
    className?: string;
    textClassName?: string;
    leftIcon?:
      | React.ReactNode
      | ((props: {
          color: string;
          size: number;
        }) => React.ReactNode);
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
  leftIcon,
  style,
  ...props
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const semanticTone = variant === 'destructive' ? 'destructive' : tone;
  const toneBorder = toneBorderColor(theme, semanticTone);
  const toneText = toneTextColor(theme, semanticTone);

  const backgroundColor =
    variant === 'primary'
      ? theme.accent
      : variant === 'destructive'
        ? theme.destructive
        : variant === 'secondary'
          ? theme.backgroundElement
          : 'transparent';

  const borderColor =
    variant === 'primary'
      ? theme.accent
      : variant === 'destructive'
        ? theme.destructive
        : toneBorder;

  const labelColor = variant === 'primary' || variant === 'destructive' ? theme.background : toneText;
  const indicatorColor = labelColor;
  const resolvedLeftIcon =
    typeof leftIcon === 'function' ? leftIcon({ color: labelColor, size: 16 }) : leftIcon;
  const baseStyle: ViewStyle = { backgroundColor, borderColor };

  const mergedStyle = (pressableState: PressableStateCallbackType) => {
    const { pressed } = pressableState;
    const computedStyle = typeof style === 'function' ? style(pressableState) : style;
    return [baseStyle, computedStyle as ViewStyle | undefined, pressed && !isDisabled ? { opacity: 0.88 } : undefined];
  };

  return (
    <Pressable
      className={cn(buttonVariants({ variant, size, tone }), isDisabled && 'opacity-45', className)}
      disabled={isDisabled}
      accessibilityState={{ ...(props.accessibilityState ?? {}), disabled: isDisabled }}
      style={mergedStyle}
      {...props}>
      {loading ? <ActivityIndicator color={indicatorColor} size="small" /> : null}
      {!loading && resolvedLeftIcon ? resolvedLeftIcon : null}
      <AppText
        variant="label"
        className={cn((loading || resolvedLeftIcon) && 'ml-2', textClassName)}
        style={{ color: labelColor }}>
        {loading ? loadingLabel ?? label : label}
      </AppText>
    </Pressable>
  );
}
