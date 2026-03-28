import React, { type ReactNode } from 'react';
import { Pressable, Text, View, type PressableProps } from 'react-native';

import { cn } from '@/lib/cn';

import { Card } from './card';
import { type SemanticTone, toneMutedTextClass, toneTextClass } from './tone';

type ActionRowProps = PressableProps & {
  label: string;
  description?: string;
  trailing?: ReactNode;
  tone?: SemanticTone;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
};

export function ActionRow({
  label,
  description,
  trailing,
  tone = 'neutral',
  className,
  disabled,
  loading,
  onPress,
  ...props
}: ActionRowProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityState={{ ...(props.accessibilityState ?? {}), disabled: isDisabled }}
      className={cn(isDisabled && 'opacity-45', className)}
      {...props}>
      <Card variant="outline" tone={tone} className="w-full">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 gap-0.5">
            <Text className={cn('text-sm font-semibold', toneTextClass[tone])}>{label}</Text>
            {description ? <Text className={cn('text-xs', toneMutedTextClass[tone])}>{description}</Text> : null}
          </View>
          {trailing ?? <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">{'>'}</Text>}
        </View>
      </Card>
    </Pressable>
  );
}
