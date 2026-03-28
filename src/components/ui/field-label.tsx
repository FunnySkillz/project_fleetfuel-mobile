import React from 'react';
import { Text, type TextProps } from 'react-native';

import { cn } from '@/lib/cn';

import { type SemanticTone, toneTextClass } from './tone';

type FieldLabelProps = TextProps & {
  required?: boolean;
  tone?: SemanticTone;
  className?: string;
};

export function FieldLabel({ children, required = false, tone = 'neutral', className, ...props }: FieldLabelProps) {
  return (
    <Text className={cn('text-sm font-semibold', toneTextClass[tone], className)} {...props}>
      {children}
      {required ? <Text className="text-destructive dark:text-dark-destructive"> *</Text> : null}
    </Text>
  );
}
