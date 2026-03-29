import React from 'react';
import { type TextProps } from 'react-native';

import { AppText } from './app-text';

type FieldErrorProps = TextProps & {
  className?: string;
};

export function FieldError({ children, className, ...props }: FieldErrorProps) {
  if (!children) {
    return null;
  }

  return (
    <AppText variant="caption" color="destructive" className={className} {...props}>
      {children}
    </AppText>
  );
}
