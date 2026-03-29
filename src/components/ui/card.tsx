import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

import { type SemanticTone, toneBorderColor } from './tone';

const cardVariants = cva('rounded-2xl border', {
  variants: {
    variant: {
      elevated: '',
      subtle: '',
      outline: '',
    },
    size: {
      sm: 'p-3',
      default: 'p-4',
      lg: 'p-5',
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

type CardProps = ViewProps &
  VariantProps<typeof cardVariants> & {
    tone?: SemanticTone;
    className?: string;
  };

export function Card({ className, variant, size, tone = 'neutral', style, ...props }: CardProps) {
  const theme = useTheme();
  const toneBorder = toneBorderColor(theme, tone);
  const surfaceColor =
    variant === 'subtle'
      ? theme.backgroundSelected
      : variant === 'outline'
        ? theme.background
        : theme.backgroundElement;
  const borderColor = variant === 'subtle' && tone === 'neutral' ? 'transparent' : toneBorder;

  return (
    <View
      className={cn(cardVariants({ variant, size, tone }), className)}
      style={[{ backgroundColor: surfaceColor, borderColor }, style]}
      {...props}
    />
  );
}
