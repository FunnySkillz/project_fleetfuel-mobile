import React from 'react';
import { Text, View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';

import { Button } from './button';
import { type SemanticTone, toneMutedTextClass, toneTextClass } from './tone';

type SectionHeaderProps = ViewProps & {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: SemanticTone;
  className?: string;
};

export function SectionHeader({
  title,
  description,
  actionLabel,
  onAction,
  tone = 'neutral',
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <View className={cn('flex-row items-start justify-between gap-3', className)} {...props}>
      <View className="flex-1 gap-1">
        <Text className={cn('text-2xl font-semibold', toneTextClass[tone])}>{title}</Text>
        {description ? <Text className={cn('text-sm', toneMutedTextClass[tone])}>{description}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="ghost" size="sm" tone={tone} onPress={onAction} />
      ) : null}
    </View>
  );
}
