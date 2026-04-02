import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { VehicleListItem } from '@/data/types';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

import { AppText, Button, EmptyState, Input } from '@/components/ui';

type VehiclePickerFieldProps = {
  vehicles: VehicleListItem[];
  value: string | null;
  onChange: (vehicleId: string) => void;
  onBlur?: () => void;
  placeholder: string;
  searchPlaceholder: string;
  noResultsTitle: string;
  noResultsDescription: string;
  disabled?: boolean;
  loading?: boolean;
};

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function VehiclePickerField({
  vehicles,
  value,
  onChange,
  onBlur,
  placeholder,
  searchPlaceholder,
  noResultsTitle,
  noResultsDescription,
  disabled = false,
  loading = false,
}: VehiclePickerFieldProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedVehicle = useMemo(() => vehicles.find((item) => item.id === value) ?? null, [value, vehicles]);
  const normalizedQuery = normalizeSearch(query);

  const filteredVehicles = useMemo(() => {
    if (!normalizedQuery) {
      return vehicles;
    }

    return vehicles.filter((vehicle) => {
      const haystack = `${vehicle.name} ${vehicle.plate}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, vehicles]);

  const openPicker = () => {
    if (disabled || loading) {
      return;
    }
    setOpen(true);
  };

  const closePicker = () => {
    setOpen(false);
    setQuery('');
    onBlur?.();
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={openPicker} accessibilityRole="button" accessibilityState={{ disabled }}>
        <View pointerEvents="none">
          <Input
            value={selectedVehicle ? `${selectedVehicle.name} (${selectedVehicle.plate})` : ''}
            placeholder={placeholder}
            editable={false}
            loading={loading}
            disabled={disabled}
            variant="subtle"
          />
        </View>
      </Pressable>

      <Modal transparent animationType="slide" visible={open} onRequestClose={closePicker}>
        <Pressable style={styles.backdrop} onPress={closePicker} />
        <View style={[styles.sheet, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
          <View style={styles.sheetHeader}>
            <Button label={t('common.cancel')} variant="ghost" size="sm" onPress={closePicker} />
            <AppText variant="label">{placeholder}</AppText>
            <View style={styles.sheetHeaderSpacer} />
          </View>

          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
            {filteredVehicles.length === 0 ? (
              <EmptyState title={noResultsTitle} description={noResultsDescription} />
            ) : (
              filteredVehicles.map((vehicle) => {
                const isActive = vehicle.id === value;
                return (
                  <Pressable
                    key={vehicle.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => {
                      onChange(vehicle.id);
                      closePicker();
                    }}
                    style={[
                      styles.option,
                      {
                        backgroundColor: isActive ? theme.backgroundSelected : theme.background,
                        borderColor: isActive ? theme.accent : theme.backgroundSelected,
                      },
                    ]}>
                    <AppText variant="label">{vehicle.name}</AppText>
                    <AppText variant="caption" color="secondary">
                      {vehicle.plate}
                    </AppText>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
    maxHeight: '70%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetHeaderSpacer: {
    width: 68,
  },
  list: {
    gap: 8,
    paddingBottom: 8,
  },
  option: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
});
