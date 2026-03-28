import React from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

type InputProps = TextInputProps & {
  className?: string;
};

export function Input({ className, ...props }: InputProps) {
  const theme = useTheme();

  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      className={cn(
        'rounded-xl border border-surface bg-background px-4 py-3 text-base text-text dark:border-dark-surface dark:bg-dark-background dark:text-dark-text',
        className,
      )}
      {...props}
    />
  );
}

