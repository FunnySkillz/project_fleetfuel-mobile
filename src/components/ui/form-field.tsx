import React, { type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/cn';

import { FieldError } from './field-error';
import { FieldHint } from './field-hint';
import { FieldLabel } from './field-label';
import { type SemanticTone } from './tone';

type FormFieldProps = ViewProps & {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  tone?: SemanticTone;
  className?: string;
  contentClassName?: string;
  labelClassName?: string;
  hintClassName?: string;
  errorClassName?: string;
  children: ReactNode;
};

export function FormField({
  label,
  required = false,
  hint,
  error,
  tone = 'neutral',
  className,
  contentClassName,
  labelClassName,
  hintClassName,
  errorClassName,
  children,
  ...props
}: FormFieldProps) {
  const resolvedTone = error ? 'destructive' : tone;

  return (
    <View className={cn('gap-1.5', className)} {...props}>
      {label ? (
        <FieldLabel required={required} tone={resolvedTone} className={labelClassName}>
          {label}
        </FieldLabel>
      ) : null}
      <View className={contentClassName}>{children}</View>
      {error ? <FieldError className={errorClassName}>{error}</FieldError> : null}
      {hint ? <FieldHint tone={resolvedTone} className={hintClassName}>{hint}</FieldHint> : null}
    </View>
  );
}
