import React from 'react';
import { type TextProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

import { AppText } from './app-text';
import { type SemanticTone, toneMutedTextColor } from './tone';

type FieldHintProps = TextProps & {
  tone?: SemanticTone;
  className?: string;
};

export function FieldHint({ children, tone = 'neutral', className, style, ...props }: FieldHintProps) {
  const theme = useTheme();

  return (
    <AppText
      variant="caption"
      className={cn(className)}
      style={[{ color: toneMutedTextColor(theme, tone) }, style]}
      {...props}>
      {children}
    </AppText>
  );
}
