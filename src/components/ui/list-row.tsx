import { cva, type VariantProps } from 'class-variance-authority';
import React, { type ReactNode } from 'react';
import { Pressable, Text, View, type PressableProps } from 'react-native';

import { cn } from '@/lib/cn';

import { type SemanticTone, toneBorderClass, toneMutedTextClass, toneTextClass } from './tone';

const rowVariants = cva('rounded-xl border active:opacity-80', {
  variants: {
    variant: {
      elevated: 'bg-surface dark:bg-dark-surface',
      outline: 'bg-background dark:bg-dark-background',
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
  ...props
}: ListRowProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      className={cn(
        rowVariants({ variant, size, tone }),
        toneBorderClass[tone],
        isDisabled && 'opacity-45',
        className,
      )}
      disabled={isDisabled}
      accessibilityState={{ ...(props.accessibilityState ?? {}), disabled: isDisabled }}
      {...props}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Text className={cn('text-sm font-semibold', toneTextClass[tone], titleClassName)}>{title}</Text>
          {subtitle ? (
            <Text className={cn('text-xs', toneMutedTextClass[tone], subtitleClassName)}>{subtitle}</Text>
          ) : null}
        </View>
        <View className="items-end gap-0.5">
          {meta ? <Text className={cn('text-xs', toneMutedTextClass[tone], metaClassName)}>{meta}</Text> : null}
          {trailing ?? <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">{'>'}</Text>}
        </View>
      </View>
    </Pressable>
  );
}
