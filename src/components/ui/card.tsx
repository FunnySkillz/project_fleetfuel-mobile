import React from 'react';
import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';

type CardProps = ViewProps & {
  className?: string;
};

export function Card({ className, ...props }: CardProps) {
  return <View className={cn('rounded-2xl bg-surface p-4 dark:bg-dark-surface', className)} {...props} />;
}

