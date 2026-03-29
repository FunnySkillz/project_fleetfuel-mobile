import React from 'react';
import { type TextProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

import { AppText } from './app-text';
import { type SemanticTone, toneTextColor } from './tone';

type FieldLabelProps = TextProps & {
  required?: boolean;
  tone?: SemanticTone;
  className?: string;
};

export function FieldLabel({ children, required = false, tone = 'neutral', className, style, ...props }: FieldLabelProps) {
  const theme = useTheme();

  return (
    <AppText
      variant="label"
      className={cn(className)}
      style={[{ color: toneTextColor(theme, tone) }, style]}
      {...props}>
      {children}
      {required ? (
        <AppText variant="label" color="destructive">
          {' '}
          *
        </AppText>
      ) : null}
    </AppText>
  );
}
