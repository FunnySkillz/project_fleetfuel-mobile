import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { logsRepo } from '@/data/repositories';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';

type ExportRouteParams = {
  type?: 'all' | 'trip' | 'fuel';
  vehicleId?: string;
  search?: string;
};

function isValidDayDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function ExportLogsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const params = useLocalSearchParams<ExportRouteParams>();

  const routeType = params.type === 'trip' || params.type === 'fuel' ? params.type : 'all';
  const routeVehicleId = (params.vehicleId ?? '').trim();
  const routeSearch = (params.search ?? '').trim();

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [includeReceipts, setIncludeReceipts] = useState(false);
  const [onlyBusiness, setOnlyBusiness] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastResultCount, setLastResultCount] = useState<number | null>(null);

  const isDirty = useMemo(() => {
    return (
      fromDate.trim().length > 0 ||
      toDate.trim().length > 0 ||
      includeReceipts !== false ||
      onlyBusiness !== false ||
      exporting
    );
  }, [exporting, fromDate, includeReceipts, onlyBusiness, toDate]);
  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty);

  const validateDates = () => {
    if (fromDate.trim().length > 0 && !isValidDayDate(fromDate.trim())) {
      return 'From date must use YYYY-MM-DD.';
    }
    if (toDate.trim().length > 0 && !isValidDayDate(toDate.trim())) {
      return 'To date must use YYYY-MM-DD.';
    }

    if (fromDate.trim().length > 0 && toDate.trim().length > 0 && fromDate.trim() > toDate.trim()) {
      return 'From date must be earlier than or equal to To date.';
    }

    return null;
  };

  const runExport = async () => {
    if (exporting) {
      return;
    }

    const validationError = validateDates();
    if (validationError) {
      Alert.alert('Invalid date range', validationError);
      return;
    }

    setExporting(true);
    try {
      const entries = await logsRepo.list({
        type: routeType,
        vehicleId: routeVehicleId.length > 0 ? routeVehicleId : null,
        search: routeSearch,
        fromDate: fromDate.trim() || null,
        toDate: toDate.trim() || null,
        businessOnly: onlyBusiness,
      });

      setLastResultCount(entries.length);
      Alert.alert(
        'Export dataset prepared',
        `${entries.length} entries matched your filters. Include receipts: ${includeReceipts ? 'yes' : 'no'}.`,
      );
      allowNextNavigation();
      router.back();
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Unexpected error.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}>
          <ThemedView type="backgroundElement" style={styles.infoCard}>
            <ThemedText type="smallBold">Active Logs Filters</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Type: {routeType}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Vehicle: {routeVehicleId.length > 0 ? routeVehicleId : 'all'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Search: {routeSearch.length > 0 ? routeSearch : 'none'}
            </ThemedText>
            {lastResultCount !== null ? (
              <ThemedText type="small" themeColor="textSecondary">
                Last run: {lastResultCount} entries
              </ThemedText>
            ) : null}
          </ThemedView>

          <ThemedText type="smallBold">From date (optional)</ThemedText>
          <TextInput
            value={fromDate}
            onChangeText={(value) => setFromDate(value.replace(/[^\d-]/g, '').slice(0, 10))}
            placeholder="2026-01-01"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
            ]}
          />

          <ThemedText type="smallBold">To date (optional)</ThemedText>
          <TextInput
            value={toDate}
            onChangeText={(value) => setToDate(value.replace(/[^\d-]/g, '').slice(0, 10))}
            placeholder="2026-12-31"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
            ]}
          />

          <View style={styles.toggleRow}>
            <Pressable onPress={() => setIncludeReceipts((value) => !value)}>
              <ThemedView type={includeReceipts ? 'backgroundSelected' : 'backgroundElement'} style={styles.toggleChip}>
                <ThemedText type="small">Include receipts</ThemedText>
              </ThemedView>
            </Pressable>

            <Pressable onPress={() => setOnlyBusiness((value) => !value)}>
              <ThemedView type={onlyBusiness ? 'backgroundSelected' : 'backgroundElement'} style={styles.toggleChip}>
                <ThemedText type="small">Business only</ThemedText>
              </ThemedView>
            </Pressable>
          </View>

          <Pressable onPress={() => void runExport()} disabled={exporting}>
            <ThemedView type="backgroundElement" style={[styles.primaryAction, exporting && styles.disabledAction]}>
              <ThemedText type="smallBold">{exporting ? 'Preparing Export...' : 'Generate Export'}</ThemedText>
            </ThemedView>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  infoCard: {
    borderRadius: Spacing.two,
    padding: Spacing.two,
    gap: Spacing.half,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    flexWrap: 'wrap',
    marginTop: Spacing.one,
  },
  toggleChip: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  primaryAction: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  disabledAction: {
    opacity: 0.45,
  },
});
