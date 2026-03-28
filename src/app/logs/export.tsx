import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';

export default function ExportLogsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [includeReceipts, setIncludeReceipts] = useState(false);
  const [onlyBusiness, setOnlyBusiness] = useState(false);

  const isDirty = useMemo(() => {
    return (
      fromDate.trim().length > 0 || toDate.trim().length > 0 || includeReceipts !== false || onlyBusiness !== false
    );
  }, [fromDate, includeReceipts, onlyBusiness, toDate]);
  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty);

  const runExport = () => {
    Alert.alert('Export generated (placeholder)', 'MVP export route is under Logs by design.');
    setFromDate('');
    setToDate('');
    setIncludeReceipts(false);
    setOnlyBusiness(false);
    allowNextNavigation();
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}>
          <ThemedText type="smallBold">From date (optional)</ThemedText>
          <TextInput
            value={fromDate}
            onChangeText={setFromDate}
            placeholder="2026-01-01"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
            ]}
          />

          <ThemedText type="smallBold">To date (optional)</ThemedText>
          <TextInput
            value={toDate}
            onChangeText={setToDate}
            placeholder="2026-12-31"
            placeholderTextColor={theme.textSecondary}
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

          <Pressable onPress={runExport}>
            <ThemedView type="backgroundElement" style={styles.primaryAction}>
              <ThemedText type="smallBold">Generate Export</ThemedText>
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
});
