import { ChevronDown, ChevronUp } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

import { AppText } from './app-text';
import { Card } from './card';

type AccordionSectionProps = {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
};

export function AccordionSection({
  title,
  summary,
  open,
  onToggle,
  children,
  className,
  contentClassName,
  disabled = false,
}: AccordionSectionProps) {
  const theme = useTheme();

  return (
    <Card className={cn('gap-2', className)}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={onToggle}
        style={({ pressed }) => [styles.header, pressed && !disabled ? styles.pressed : null]}>
        <View style={styles.textWrap}>
          <AppText variant="subtitle">{title}</AppText>
          {summary ? (
            <AppText variant="caption" color="secondary" numberOfLines={1}>
              {summary}
            </AppText>
          ) : null}
        </View>
        <View style={styles.iconWrap}>
          {open ? (
            <ChevronUp color={theme.textSecondary} size={18} strokeWidth={2} />
          ) : (
            <ChevronDown color={theme.textSecondary} size={18} strokeWidth={2} />
          )}
        </View>
      </Pressable>
      {open ? <View className={cn('gap-3', contentClassName)}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  iconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.75,
  },
});
