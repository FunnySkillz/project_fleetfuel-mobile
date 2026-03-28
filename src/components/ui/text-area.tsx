import React from 'react';
import { type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';

import { Input } from './input';
import { type SemanticTone } from './tone';

type TextAreaProps = TextInputProps & {
  className?: string;
  variant?: 'default' | 'subtle' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  tone?: SemanticTone;
  loading?: boolean;
};

export function TextArea({ className, variant, size, tone, ...props }: TextAreaProps) {
  return (
    <Input
      multiline
      textAlignVertical="top"
      variant={variant}
      size={size}
      tone={tone}
      className={cn('min-h-24', className)}
      {...props}
    />
  );
}
