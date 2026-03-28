import React from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';

import { cn } from '@/lib/cn';

type ChipProps = PressableProps & {
  label: string;
  active?: boolean;
  className?: string;
};

export function Chip({ label, active = false, className, ...props }: ChipProps) {
  return (
    <Pressable
      className={cn(
        'rounded-full px-3 py-1.5 active:opacity-80',
        active ? 'bg-surfaceActive dark:bg-dark-surfaceActive' : 'bg-surface dark:bg-dark-surface',
        className,
      )}
      {...props}>
      <Text className="text-sm font-medium text-text dark:text-dark-text">{label}</Text>
    </Pressable>
  );
}

