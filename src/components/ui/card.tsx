import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';

import { type SemanticTone, toneBorderClass } from './tone';

const cardVariants = cva('rounded-2xl border p-4', {
  variants: {
    variant: {
      elevated: 'bg-surface dark:bg-dark-surface',
      subtle: 'border-transparent bg-surface dark:bg-dark-surface',
      outline: 'bg-background dark:bg-dark-background',
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

export function Card({ className, variant, size, tone = 'neutral', ...props }: CardProps) {
  return <View className={cn(cardVariants({ variant, size, tone }), toneBorderClass[tone], className)} {...props} />;
}
