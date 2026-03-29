import React from 'react';
import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

type AppTextVariant = 'body' | 'label' | 'title' | 'subtitle' | 'caption' | 'code';
type AppTextColor = 'primary' | 'secondary' | 'success' | 'warning' | 'destructive';

const variantClassName: Record<AppTextVariant, string> = {
  body: 'text-sm',
  label: 'text-sm font-semibold',
  title: 'text-2xl font-semibold',
  subtitle: 'text-base font-semibold',
  caption: 'text-xs',
  code: 'text-xs font-medium',
};

type AppTextProps = TextProps & {
  variant?: AppTextVariant;
  color?: AppTextColor;
  className?: string;
};

export function AppText({
  variant = 'body',
  color = 'primary',
  className,
  style,
  ...props
}: AppTextProps) {
  const theme = useTheme();
  const resolvedColor =
    color === 'secondary'
      ? theme.textSecondary
      : color === 'success'
        ? theme.success
        : color === 'warning'
          ? theme.warning
          : color === 'destructive'
            ? theme.destructive
            : theme.text;

  return (
    <Text
      className={cn(variantClassName[variant], className)}
      style={[{ color: resolvedColor }, style]}
      {...props}
    />
  );
}
