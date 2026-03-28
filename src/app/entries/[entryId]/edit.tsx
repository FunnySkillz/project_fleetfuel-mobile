import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';

export default function EditEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const params = useLocalSearchParams<{ entryId?: string }>();
  const [notes, setNotes] = useState('');
  const [privateTag, setPrivateTag] = useState('');
  const isDirty = useMemo(() => notes.trim().length > 0 || privateTag.trim().length > 0, [notes, privateTag]);

  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty);

  const handleSave = () => {
    Alert.alert('Changes saved (placeholder)', 'Edit route is now wired with unsaved-changes guard.');
    setNotes('');
    setPrivateTag('');
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
          <ThemedText type="small" themeColor="textSecondary">
            Editing entry: {params.entryId ?? 'unknown'}
          </ThemedText>

          <ThemedText type="smallBold">Private/Business Tag</ThemedText>
          <TextInput
            value={privateTag}
            onChangeText={setPrivateTag}
            placeholder="business"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
            ]}
          />

          <ThemedText type="smallBold">Notes</ThemedText>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Update notes"
            placeholderTextColor={theme.textSecondary}
            multiline
            style={[
              styles.input,
              styles.multiline,
              { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
            ]}
          />

          <Pressable onPress={handleSave}>
            <ThemedView type="backgroundElement" style={styles.primaryAction}>
              <ThemedText type="smallBold">Save Changes</ThemedText>
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
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  primaryAction: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
});
