import { useIsFocused } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Button, Card, FormField, Input, SectionHeader, SelectField, TextArea } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { entriesRepo } from '@/data/repositories';
import type { EntryDetail, TripPrivateTag } from '@/data/types';
import { useI18n } from '@/hooks/use-i18n';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { trimmedLength } from '@/utils/form-input';

const NOTES_MAX = 500;

type EditEntryErrors = {
  notes?: string;
  privateTag?: string;
};

function normalizeNotes(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export default function EditEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ entryId?: string }>();
  const { t } = useI18n();
  const entryId = (params.entryId ?? '').trim();

  const initialStateRef = useRef<{ notes: string; privateTag: TripPrivateTag }>({ notes: '', privateTag: null });

  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [notes, setNotes] = useState('');
  const [privateTag, setPrivateTag] = useState<TripPrivateTag>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState({ notes: false, privateTag: false });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadEntry = useCallback(async () => {
    if (!entryId) {
      setStatus('error');
      setErrorMessage(t('entryEdit.errorMissingId'));
      setEntry(null);
      return;
    }

    setStatus((previous) => (previous === 'ready' ? 'ready' : 'loading'));
    setErrorMessage(null);

    try {
      const data = await entriesRepo.getById(entryId);
      if (!data) {
        setStatus('error');
        setErrorMessage(t('entryEdit.errorNotFound'));
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
      setTouched({ notes: false, privateTag: false });
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : t('entryEdit.errorLoadFailedFallback'));
      setEntry(null);
    }
  }, [entryId, t]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void loadEntry();
  }, [isFocused, loadEntry]);

  const errors = useMemo<EditEntryErrors>(() => {
    const result: EditEntryErrors = {};

    if (trimmedLength(notes) > NOTES_MAX) {
      result.notes = t('entryEdit.errorNotesMax', { max: NOTES_MAX });
    }

    if (entry?.type === 'trip' && privateTag === null) {
      result.privateTag = t('entryEdit.errorClassificationRequired');
    }

    return result;
  }, [entry?.type, notes, privateTag, t]);

  const normalizedNotes = normalizeNotes(notes);
  const isDirty =
    normalizedNotes !== initialStateRef.current.notes ||
    (entry?.type === 'trip' && privateTag !== initialStateRef.current.privateTag) ||
    saving;
  const { allowNextNavigation } = useUnsavedChangesGuard(Boolean(isDirty));

  const isValid = !errors.notes && !errors.privateTag;
  const canSubmit = status === 'ready' && !saving && isValid && Boolean(entry) && Boolean(isDirty);
  const showNotesError = (submitAttempted || touched.notes) && Boolean(errors.notes);

  const handleSave = async () => {
    if (!entry || !canSubmit) {
      return;
    }

    setSubmitAttempted(true);
    setTouched({ notes: true, privateTag: true });

    if (!isValid) {
      Alert.alert(t('common.checkFormTitle'), t('common.fixValidationErrors'));
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
      Alert.alert(t('entryEdit.saveFailedTitle'), error instanceof Error ? error.message : t('common.unexpectedError'));
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
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}> 
          <SectionHeader title={t('entryEdit.title')} description={entry ? t('entryEdit.descriptionLoaded', { id: entry.id }) : t('entryEdit.descriptionLoading')} />

          {status === 'loading' ? (
            <Card>
              <Input value={t('entryEdit.loading')} editable={false} variant="subtle" />
            </Card>
          ) : status === 'error' || !entry ? (
            <Card tone="destructive" className="gap-2">
              <FormField label={t('entryEdit.loadErrorLabel')} error={errorMessage ?? t('common.unexpectedError')}>
                <Input value={t('entryEdit.errorLoadTitle')} editable={false} variant="subtle" tone="destructive" />
              </FormField>
              <Button label={t('common.retry')} variant="ghost" tone="destructive" onPress={() => void loadEntry()} className="self-start" />
            </Card>
          ) : (
            <Card className="gap-3">
              {entry.type === 'trip' ? (
                <FormField
                  label={t('entryEdit.classificationLabel')}
                  required
                  hint={privateTag === null ? t('entryEdit.classificationHintLegacy') : undefined}
                  error={(submitAttempted || touched.privateTag) ? errors.privateTag : null}>
                  <SelectField
                    options={[
                      { value: 'business', label: t('tripForm.classification.business') },
                      { value: 'private', label: t('tripForm.classification.private') },
                    ]}
                    value={privateTag}
                    onChange={(value) => {
                      setPrivateTag(value as Exclude<TripPrivateTag, null>);
                      setTouched((prev) => ({ ...prev, privateTag: true }));
                    }}
                  />
                </FormField>
              ) : null}

              <FormField
                label={t('entryEdit.notesLabel')}
                hint={`${trimmedLength(notes)}/${NOTES_MAX}`}
                error={showNotesError ? errors.notes : null}>
                <TextArea
                  value={notes}
                  onChangeText={(value) => setNotes(value.slice(0, NOTES_MAX))}
                  onBlur={() => setTouched((prev) => ({ ...prev, notes: true }))}
                  placeholder={t('entryEdit.notesPlaceholder')}
                  autoCapitalize="sentences"
                  tone={showNotesError ? 'destructive' : 'neutral'}
                />
              </FormField>
            </Card>
          )}

          <Button
            label={t('entryEdit.saveAction')}
            variant="primary"
            loading={saving}
            loadingLabel={t('entryEdit.saving')}
            disabled={!canSubmit}
            onPress={() => void handleSave()}
          />
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
});

