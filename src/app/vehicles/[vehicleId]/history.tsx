import { useIsFocused } from '@react-navigation/native';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { AppText, Card, EmptyState, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { changeHistoryRepo, vehiclesRepo } from '@/data/repositories';
import type { ChangeFieldDiff, ChangeHistoryRecord } from '@/data/types';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

function formatDateTime(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }

  return `${parsed.toISOString().slice(0, 10)} ${parsed.toISOString().slice(11, 16)} UTC`;
}

function toDisplayValue(value: unknown, fallback: string) {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'string') {
    return value.length > 0 ? value : fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function summarizeChangedFields(changedFields: ChangeFieldDiff[], fallback: string) {
  if (changedFields.length === 0) {
    return fallback;
  }

  const names = changedFields.map((field) => field.field);
  if (names.length <= 3) {
    return names.join(', ');
  }

  return `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
}

export default function VehicleHistoryScreen() {
  const isFocused = useIsFocused();
  const theme = useTheme();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ vehicleId?: string | string[] }>();
  const vehicleId = useMemo(() => {
    if (typeof params.vehicleId === 'string') {
      return params.vehicleId.trim();
    }
    if (Array.isArray(params.vehicleId)) {
      return params.vehicleId.map((entry) => entry.trim()).find((entry) => entry.length > 0) ?? '';
    }
    return '';
  }, [params.vehicleId]);

  const [vehicleName, setVehicleName] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<ChangeHistoryRecord[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!vehicleId) {
      setStatus('error');
      setErrorMessage(t('vehicleHistory.errorMissingId'));
      setVehicleName(null);
      setHistoryRows([]);
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const [vehicle, history] = await Promise.all([
        vehiclesRepo.getById(vehicleId),
        changeHistoryRepo.listByVehicle(vehicleId, { limit: 200 }),
      ]);

      if (!vehicle) {
        setStatus('error');
        setErrorMessage(t('vehicleDetail.errorNotFound'));
        setVehicleName(null);
        setHistoryRows([]);
        return;
      }

      setVehicleName(vehicle.name);
      setHistoryRows(history);
      setExpandedId(null);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : t('vehicleHistory.errorLoadFailedFallback'));
      setVehicleName(null);
      setHistoryRows([]);
    }
  }, [t, vehicleId]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void loadHistory();
  }, [isFocused, loadHistory]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: t('root.vehicleHistory') }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <SectionHeader
            title={t('vehicleHistory.title')}
            description={
              vehicleName
                ? t('vehicleHistory.descriptionWithVehicle', { name: vehicleName })
                : t('vehicleHistory.description')
            }
          />

          {status === 'loading' ? (
            <Card className="gap-2">
              <ActivityIndicator color={theme.textSecondary} />
              <AppText variant="caption" color="secondary">
                {t('vehicleHistory.loading')}
              </AppText>
            </Card>
          ) : status === 'error' ? (
            <EmptyState
              tone="destructive"
              title={t('vehicleHistory.errorLoadTitle')}
              description={errorMessage ?? t('common.unexpectedError')}
              actionLabel={t('common.retry')}
              onAction={() => void loadHistory()}
            />
          ) : historyRows.length === 0 ? (
            <EmptyState title={t('vehicleHistory.emptyTitle')} description={t('vehicleHistory.emptyDescription')} />
          ) : (
            historyRows.map((row) => {
              const expanded = expandedId === row.id;
              const actionLabel = row.actionType === 'update' ? t('vehicleHistory.action.update') : t('vehicleHistory.action.delete');
              const entityLabel =
                row.entityType === 'vehicle'
                  ? t('vehicleHistory.entity.vehicle')
                  : row.entityType === 'trip'
                    ? t('vehicleHistory.entity.trip')
                    : t('vehicleHistory.entity.fuel');

              return (
                <Pressable key={row.id} onPress={() => setExpandedId((current) => (current === row.id ? null : row.id))}>
                  <Card className="gap-2">
                    <View style={styles.rowHead}>
                      <AppText variant="label">{`${actionLabel} · ${entityLabel}`}</AppText>
                      <AppText variant="caption" color="secondary">
                        {formatDateTime(row.occurredAt)}
                      </AppText>
                    </View>
                    <AppText variant="caption" color="secondary">
                      {t('vehicleHistory.changedFields', {
                        value: summarizeChangedFields(row.changedFields, t('vehicleHistory.changedFieldsNone')),
                      })}
                    </AppText>
                    <AppText variant="caption" color="secondary">
                      {t('vehicleHistory.reason', { value: row.reason })}
                    </AppText>
                    <AppText variant="caption" color="secondary">
                      {t('vehicleHistory.actor', { value: row.actorId })}
                    </AppText>

                    {expanded ? (
                      <View style={styles.detailsWrap}>
                        {row.changedFields.length === 0 ? (
                          <AppText variant="caption" color="secondary">
                            {t('vehicleHistory.changedFieldsNone')}
                          </AppText>
                        ) : (
                          row.changedFields.map((field) => (
                            <View key={`${row.id}-${field.field}`} style={styles.detailLine}>
                              <AppText variant="caption" color="secondary">
                                {field.field}
                              </AppText>
                              <AppText variant="caption" color="secondary">
                                {`${toDisplayValue(field.before, t('common.notAvailable'))} -> ${toDisplayValue(field.after, t('common.notAvailable'))}`}
                              </AppText>
                            </View>
                          ))
                        )}
                      </View>
                    ) : null}
                  </Card>
                </Pressable>
              );
            })
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
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.one,
    alignItems: 'center',
  },
  detailsWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127,127,127,0.45)',
    paddingTop: Spacing.one,
    gap: Spacing.one,
  },
  detailLine: {
    gap: 2,
  },
});

