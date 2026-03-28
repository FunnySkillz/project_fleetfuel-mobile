import React from 'react';
import { Text, View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';

import { Button } from './button';
import { Card } from './card';
import { type SemanticTone, toneMutedTextClass, toneTextClass } from './tone';

type EmptyStateProps = ViewProps & {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
  tone?: SemanticTone;
  className?: string;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  loading,
  tone = 'neutral',
  className,
  ...props
}: EmptyStateProps) {
  return (
    <Card tone={tone} className={cn('gap-2', className)} {...props}>
      <Text className={cn('text-sm font-semibold', toneTextClass[tone])}>{title}</Text>
      {description ? <Text className={cn('text-xs', toneMutedTextClass[tone])}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <View className="pt-1">
          <Button
            label={actionLabel}
            variant="ghost"
            tone={tone}
            size="sm"
            loading={loading}
            disabled={loading}
            onPress={onAction}
            className="self-start"
          />
        </View>
      ) : null}
    </Card>
  );
}
