import React from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

import { AppText } from './app-text';
import { Button } from './button';
import { type SemanticTone, toneMutedTextColor, toneTextColor } from './tone';

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
  const theme = useTheme();
  const titleColor = toneTextColor(theme, tone);
  const mutedColor = toneMutedTextColor(theme, tone);

  return (
    <View className={cn('flex-row items-start justify-between gap-3', className)} {...props}>
      <View className="flex-1 gap-1">
        <AppText variant="title" style={{ color: titleColor }}>
          {title}
        </AppText>
        {description ? (
          <AppText variant="body" style={{ color: mutedColor }}>
            {description}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="ghost" size="sm" tone={tone} onPress={onAction} />
      ) : null}
    </View>
  );
}
