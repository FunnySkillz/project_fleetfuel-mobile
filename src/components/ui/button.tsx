import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import { Pressable, type PressableProps, Text } from 'react-native';

import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'items-center justify-center rounded-xl px-4 py-3 active:opacity-80',
  {
    variants: {
      variant: {
        primary: 'bg-surfaceActive dark:bg-dark-surfaceActive',
        secondary: 'bg-surface dark:bg-dark-surface',
        destructive: 'bg-destructive dark:bg-dark-destructive',
        ghost: 'bg-transparent',
      },
      size: {
        default: 'min-h-11',
        sm: 'min-h-9 px-3 py-2',
        lg: 'min-h-12 px-5 py-3',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'default',
    },
  },
);

const labelVariants = cva('text-sm font-semibold', {
  variants: {
    variant: {
      primary: 'text-text dark:text-dark-text',
      secondary: 'text-text dark:text-dark-text',
      destructive: 'text-white',
      ghost: 'text-text dark:text-dark-text',
    },
  },
  defaultVariants: {
    variant: 'secondary',
  },
});

type ButtonProps = PressableProps &
  VariantProps<typeof buttonVariants> & {
    label: string;
    className?: string;
    textClassName?: string;
  };

export function Button({ label, className, textClassName, variant, size, ...props }: ButtonProps) {
  return (
    <Pressable className={cn(buttonVariants({ variant, size }), className)} {...props}>
      <Text className={cn(labelVariants({ variant }), textClassName)}>{label}</Text>
    </Pressable>
  );
}

