import { Check, Pencil, Trash2 } from 'lucide-react-native';
import React from 'react';

type ActionIconName = 'save' | 'edit' | 'delete';

type ActionIconProps = {
  name: ActionIconName;
  color: string;
  size?: number;
  strokeWidth?: number;
};

const actionIcons = {
  save: Check,
  edit: Pencil,
  delete: Trash2,
} as const;

export function ActionIcon({ name, color, size = 16, strokeWidth = 2 }: ActionIconProps) {
  const Icon = actionIcons[name];
  return <Icon color={color} size={size} strokeWidth={strokeWidth} />;
}

