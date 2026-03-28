import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function EntryDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    entryId?: string;
    type?: 'trip' | 'fuel';
    vehicleName?: string;
    summary?: string;
  }>();

  const entryId = params.entryId ?? 'unknown';
  const entryType = params.type ?? 'trip';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="small" themeColor="textSecondary">
              Entry ID
            </ThemedText>
            <ThemedText type="smallBold">{entryId}</ThemedText>

            <ThemedText type="small" themeColor="textSecondary">
              Type
            </ThemedText>
            <ThemedText type="smallBold">{entryType === 'trip' ? 'Trip' : 'Fuel'}</ThemedText>

            <ThemedText type="small" themeColor="textSecondary">
              Vehicle
            </ThemedText>
            <ThemedText type="smallBold">{params.vehicleName ?? 'Unknown vehicle'}</ThemedText>

            <ThemedText type="small" themeColor="textSecondary">
              Summary
            </ThemedText>
            <ThemedText>{params.summary ?? 'No summary available yet.'}</ThemedText>
          </ThemedView>

          <Pressable
            onPress={() =>
              router.push({
                pathname: '/entries/[entryId]/edit',
                params: { entryId },
              })
            }>
            <ThemedView type="backgroundElement" style={styles.actionCard}>
              <ThemedText type="smallBold">Edit Entry</ThemedText>
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
    gap: Spacing.three,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  actionCard: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
