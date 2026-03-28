import React from 'react';
import { Text, type TextProps } from 'react-native';

import { cn } from '@/lib/cn';

type FieldErrorProps = TextProps & {
  className?: string;
};

export function FieldError({ children, className, ...props }: FieldErrorProps) {
  if (!children) {
    return null;
  }

  return (
    <Text className={cn('text-xs text-destructive dark:text-dark-destructive', className)} {...props}>
      {children}
    </Text>
  );
}
