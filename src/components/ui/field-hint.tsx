import React from 'react';
import { Text, type TextProps } from 'react-native';

import { cn } from '@/lib/cn';

import { type SemanticTone, toneMutedTextClass } from './tone';

type FieldHintProps = TextProps & {
  tone?: SemanticTone;
  className?: string;
};

export function FieldHint({ children, tone = 'neutral', className, ...props }: FieldHintProps) {
  return (
    <Text className={cn('text-xs', toneMutedTextClass[tone], className)} {...props}>
      {children}
    </Text>
  );
}
