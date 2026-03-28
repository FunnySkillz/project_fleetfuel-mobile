export type SemanticTone = 'neutral' | 'success' | 'warning' | 'destructive';

export const toneTextClass: Record<SemanticTone, string> = {
  neutral: 'text-text dark:text-dark-text',
  success: 'text-success dark:text-dark-success',
  warning: 'text-warning dark:text-dark-warning',
  destructive: 'text-destructive dark:text-dark-destructive',
};

export const toneMutedTextClass: Record<SemanticTone, string> = {
  neutral: 'text-textSecondary dark:text-dark-textSecondary',
  success: 'text-success dark:text-dark-success',
  warning: 'text-warning dark:text-dark-warning',
  destructive: 'text-destructive dark:text-dark-destructive',
};

export const toneBorderClass: Record<SemanticTone, string> = {
  neutral: 'border-surface dark:border-dark-surface',
  success: 'border-success dark:border-dark-success',
  warning: 'border-warning dark:border-dark-warning',
  destructive: 'border-destructive dark:border-dark-destructive',
};
