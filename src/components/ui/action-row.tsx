import React, { type ReactNode } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

import { AppText } from './app-text';
import { Card } from './card';
import { type SemanticTone, toneMutedTextColor, toneTextColor } from './tone';

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
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const toneColor = toneTextColor(theme, tone);
  const mutedColor = toneMutedTextColor(theme, tone);

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
            <AppText variant="label" style={{ color: toneColor }}>
              {label}
            </AppText>
            {description ? (
              <AppText variant="caption" style={{ color: mutedColor }}>
                {description}
              </AppText>
            ) : null}
          </View>
          {trailing ?? (
            <AppText variant="caption" color="secondary">
              {'>'}
            </AppText>
          )}
        </View>
      </Card>
    </Pressable>
  );
}
