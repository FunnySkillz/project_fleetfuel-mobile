import React from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

import { AppText } from './app-text';
import { Button } from './button';
import { Card } from './card';
import { type SemanticTone, toneMutedTextColor, toneTextColor } from './tone';

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
  const theme = useTheme();
  const titleColor = toneTextColor(theme, tone);
  const mutedColor = toneMutedTextColor(theme, tone);

  return (
    <Card tone={tone} className={cn('gap-2', className)} {...props}>
      <AppText variant="label" style={{ color: titleColor }}>
        {title}
      </AppText>
      {description ? (
        <AppText variant="caption" style={{ color: mutedColor }}>
          {description}
        </AppText>
      ) : null}
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
