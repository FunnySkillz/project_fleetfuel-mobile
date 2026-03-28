import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { entriesRepo } from '@/data/repositories';
import type { EntryDetail, TripPrivateTag } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { trimmedLength } from '@/utils/form-input';

const NOTES_MAX = 500;

type EditEntryErrors = {
  notes?: string;
};

function normalizeNotes(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export default function EditEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ entryId?: string }>();
  const entryId = (params.entryId ?? '').trim();

  const initialStateRef = useRef<{ notes: string; privateTag: TripPrivateTag }>({ notes: '', privateTag: null });

  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [notes, setNotes] = useState('');
  const [privateTag, setPrivateTag] = useState<TripPrivateTag>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({ notes: false });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadEntry = useCallback(async () => {
    if (!entryId) {
      setStatus('error');
      setErrorMessage('Missing entry id.');
      setEntry(null);
      return;
    }

    setStatus((previous) => (previous === 'ready' ? 'ready' : 'loading'));
    setErrorMessage(null);

    try {
      const data = await entriesRepo.getById(entryId);
      if (!data) {
        setStatus('error');
        setErrorMessage('Entry not found. It may have been deleted.');
        setEntry(null);
        return;
      }

      const nextNotes = data.notes ?? '';
      const nextPrivateTag = data.type === 'trip' ? data.privateTag : null;

      initialStateRef.current = {
        notes: normalizeNotes(nextNotes),
        privateTag: nextPrivateTag,
      };

      setEntry(data);
      setNotes(nextNotes);
      setPrivateTag(nextPrivateTag);
      setSubmitAttempted(false);
      setTouched({ notes: false });
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load entry.');
      setEntry(null);
    }
  }, [entryId]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void loadEntry();
  }, [isFocused, loadEntry]);

  const errors = useMemo<EditEntryErrors>(() => {
    const result: EditEntryErrors = {};

    if (trimmedLength(notes) > NOTES_MAX) {
      result.notes = `Notes must be at most ${NOTES_MAX} characters.`;
    }

    return result;
  }, [notes]);

  const normalizedNotes = normalizeNotes(notes);
  const isDirty =
    normalizedNotes !== initialStateRef.current.notes ||
    (entry?.type === 'trip' && privateTag !== initialStateRef.current.privateTag) ||
    saving;
  const { allowNextNavigation } = useUnsavedChangesGuard(Boolean(isDirty));

  const isValid = !errors.notes;
  const canSubmit = status === 'ready' && !saving && isValid && Boolean(entry) && Boolean(isDirty);
  const showNotesError = (submitAttempted || touched.notes) && Boolean(errors.notes);

  const handleSave = async () => {
    if (!entry || !canSubmit) {
      return;
    }

    setSubmitAttempted(true);
    setTouched({ notes: true });

    if (!isValid) {
      Alert.alert('Check form', 'Please fix validation errors before saving.');
      return;
    }

    setSaving(true);
    try {
      await entriesRepo.updateEditableFields(entry.id, {
        notes: normalizedNotes.length > 0 ? normalizedNotes : null,
        privateTag: entry.type === 'trip' ? privateTag : undefined,
      });

      allowNextNavigation();
      router.back();
    } catch (error) {
      Alert.alert('Could not save changes', error instanceof Error ? error.message : 'Unexpected error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}>
          {status === 'loading' ? (
            <ThemedView type="backgroundElement" style={styles.statusCard}>
              <ThemedText type="small" themeColor="textSecondary">
                Loading entry...
              </ThemedText>
            </ThemedView>
          ) : status === 'error' || !entry ? (
            <ThemedView type="backgroundElement" style={styles.statusCard}>
              <ThemedText type="smallBold">Could not load entry</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {errorMessage ?? 'Unexpected error.'}
              </ThemedText>
              <Pressable onPress={() => void loadEntry()}>
                <ThemedText type="link">Retry</ThemedText>
              </Pressable>
            </ThemedView>
          ) : (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Editing entry: {entry.id}
              </ThemedText>

              {entry.type === 'trip' ? (
                <>
                  <ThemedText type="smallBold">Private/Business Tag</ThemedText>
                  <View style={styles.tagRow}>
                    <Pressable onPress={() => setPrivateTag(null)}>
                      <ThemedView type={privateTag === null ? 'backgroundSelected' : 'backgroundElement'} style={styles.tagChip}>
                        <ThemedText type="small">None</ThemedText>
                      </ThemedView>
                    </Pressable>
                    <Pressable onPress={() => setPrivateTag('business')}>
                      <ThemedView
                        type={privateTag === 'business' ? 'backgroundSelected' : 'backgroundElement'}
                        style={styles.tagChip}>
                        <ThemedText type="small">Business</ThemedText>
                      </ThemedView>
                    </Pressable>
                    <Pressable onPress={() => setPrivateTag('private')}>
                      <ThemedView
                        type={privateTag === 'private' ? 'backgroundSelected' : 'backgroundElement'}
                        style={styles.tagChip}>
                        <ThemedText type="small">Private</ThemedText>
                      </ThemedView>
                    </Pressable>
                  </View>
                </>
              ) : null}

              <ThemedText type="smallBold">Notes</ThemedText>
              <TextInput
                value={notes}
                onChangeText={(value) => setNotes(value.slice(0, NOTES_MAX))}
                onBlur={() => setTouched({ notes: true })}
                placeholder="Update notes"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="sentences"
                multiline
                style={[
                  styles.input,
                  styles.multiline,
                  { color: theme.text, borderColor: theme.backgroundElement, backgroundColor: theme.background },
                  showNotesError && { borderColor: theme.destructive },
                ]}
              />
              <ThemedText type="small" themeColor="textSecondary" style={styles.counterText}>
                {trimmedLength(notes)}/{NOTES_MAX}
              </ThemedText>
              {showNotesError ? (
                <ThemedText type="small" style={[styles.errorText, { color: theme.destructive }]}>
                  {errors.notes}
                </ThemedText>
              ) : null}

              <Pressable onPress={() => void handleSave()} disabled={!canSubmit}>
                <ThemedView type="backgroundElement" style={[styles.primaryAction, !canSubmit && styles.disabledAction]}>
                  <ThemedText type="smallBold">{saving ? 'Saving...' : 'Save Changes'}</ThemedText>
                </ThemedView>
              </Pressable>
            </>
          )}
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
  statusCard: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  tagRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    flexWrap: 'wrap',
  },
  tagChip: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
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
  counterText: {
    textAlign: 'right',
    marginTop: -4,
  },
  errorText: {},
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
