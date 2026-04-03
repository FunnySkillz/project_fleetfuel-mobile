import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReasonRequiredModal } from '@/components/reason-required-modal';
import { ThemedView } from '@/components/themed-view';
import { AppText, EmptyState, FormField, Input, ListRow, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { vehiclesRepo } from '@/data/repositories';
import type { VehicleListItem } from '@/data/types';
import { useI18n } from '@/hooks/use-i18n';
import { useNavigationPressGuard } from '@/hooks/use-navigation-press-guard';
import { useTheme } from '@/hooks/use-theme';

function formatDate(iso: string | null, fallback: string) {
  if (!iso) {
    return fallback;
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }

  return parsed.toISOString().slice(0, 10);
}

export default function VehiclesScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const theme = useTheme();
  const { t } = useI18n();
  const { runGuarded } = useNavigationPressGuard();
  const [query, setQuery] = useState('');
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [vehiclePendingDelete, setVehiclePendingDelete] = useState<VehicleListItem | null>(null);
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null);
  const requestRef = useRef(0);
  const swipeableRefs = useRef(new Map<string, Swipeable>());
  const openSwipeableIdRef = useRef<string | null>(null);

  const loadVehicles = useCallback(async (searchText: string) => {
    const requestId = ++requestRef.current;
    setErrorMessage(null);
    setStatus((previous) => (previous === 'ready' ? 'ready' : 'loading'));

    try {
      const data = await vehiclesRepo.list(searchText);
      if (requestId !== requestRef.current) {
        return;
      }

      setVehicles(data);
      setStatus('ready');
    } catch (error) {
      if (requestId !== requestRef.current) {
        return;
      }

      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : t('vehicles.errorLoadFailedFallback'));
    }
  }, [t]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void loadVehicles(query);
  }, [isFocused, loadVehicles, query]);

  useEffect(() => {
    return () => {
      swipeableRefs.current.forEach((swipeable) => swipeable.close());
      swipeableRefs.current.clear();
      openSwipeableIdRef.current = null;
    };
  }, []);

  const hasQuery = query.trim().length > 0;

  const closeOpenSwipeable = useCallback((excludeId?: string) => {
    const openId = openSwipeableIdRef.current;
    if (!openId || openId === excludeId) {
      return;
    }

    swipeableRefs.current.get(openId)?.close();
  }, []);

  const registerSwipeable = useCallback((vehicleId: string, swipeable: Swipeable | null) => {
    if (swipeable) {
      swipeableRefs.current.set(vehicleId, swipeable);
      return;
    }

    swipeableRefs.current.delete(vehicleId);
    if (openSwipeableIdRef.current === vehicleId) {
      openSwipeableIdRef.current = null;
    }
  }, []);

  const openVehicleDetail = useCallback(
    (vehicle: VehicleListItem) => {
      closeOpenSwipeable();
      runGuarded(() => {
        router.push({
          pathname: '/vehicles/[vehicleId]',
          params: { vehicleId: vehicle.id, name: vehicle.name, plate: vehicle.plate },
        });
      });
    },
    [closeOpenSwipeable, router, runGuarded],
  );

  const requestVehicleDelete = useCallback(
    (vehicle: VehicleListItem) => {
      Alert.alert(t('vehicleDetail.deleteTitle'), t('vehicleDetail.deleteMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('vehicleDetail.deleteAction'),
          style: 'destructive',
          onPress: () => {
            setVehiclePendingDelete(vehicle);
            setReasonModalVisible(true);
          },
        },
      ]);
    },
    [t],
  );

  const handleSwipeDeleteAction = useCallback(
    (vehicle: VehicleListItem, swipeable: Swipeable) => {
      swipeable.close();
      openSwipeableIdRef.current = null;
      requestVehicleDelete(vehicle);
    },
    [requestVehicleDelete],
  );

  const renderSwipeDeleteAction = useCallback(
    (_progress: unknown, _dragX: unknown, swipeable: Swipeable, vehicle: VehicleListItem) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('vehicles.swipeDeleteAction')}
        style={[styles.swipeDeleteAction, { backgroundColor: theme.destructive }]}
        onPress={() => handleSwipeDeleteAction(vehicle, swipeable)}>
        <AppText variant="label" style={styles.swipeDeleteText}>
          {t('vehicles.swipeDeleteAction')}
        </AppText>
      </Pressable>
    ),
    [handleSwipeDeleteAction, t, theme.destructive],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.headerSection}>
        <SectionHeader title={t('vehicles.title')} description={t('vehicles.description')} />

        <FormField
          label={t('vehicles.searchLabel')}
          hint={t('vehicles.searchResultsHint', { count: vehicles.length })}>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={t('vehicles.searchPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </FormField>
      </View>
    ),
    [query, t, vehicles.length],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            status === 'loading' ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={theme.textSecondary} />
                <AppText variant="caption" color="secondary">{t('vehicles.loading')}</AppText>
              </View>
            ) : status === 'error' ? (
              <EmptyState
                tone="destructive"
                title={t('vehicles.errorLoadTitle')}
                description={errorMessage ?? t('common.unexpectedError')}
                actionLabel={t('common.retry')}
                onAction={() => void loadVehicles(query)}
              />
            ) : (
              <EmptyState
                title={hasQuery ? t('vehicles.emptySearchTitle') : t('vehicles.emptyTitle')}
                description={
                  hasQuery ? t('vehicles.emptySearchDescription') : t('vehicles.emptyDescription')
                }
              />
            )
          }
          renderItem={({ item: vehicle }) => (
            <View style={styles.rowWrap}>
              <Swipeable
                ref={(node) => registerSwipeable(vehicle.id, node)}
                friction={2}
                overshootRight={false}
                rightThreshold={36}
                onSwipeableWillOpen={() => {
                  closeOpenSwipeable(vehicle.id);
                  openSwipeableIdRef.current = vehicle.id;
                }}
                onSwipeableClose={() => {
                  if (openSwipeableIdRef.current === vehicle.id) {
                    openSwipeableIdRef.current = null;
                  }
                }}
                renderRightActions={(progress, dragX, swipeable) =>
                  renderSwipeDeleteAction(progress, dragX, swipeable, vehicle)
                }>
                <ListRow
                  title={vehicle.name}
                  subtitle={
                    vehicle.make || vehicle.model
                      ? t('vehicles.listSubtitleWithSpecs', {
                          specs: [vehicle.make, vehicle.model].filter(Boolean).join(' '),
                          plate: vehicle.plate,
                          tripCount: vehicle.tripCount,
                          fuelCount: vehicle.fuelCount,
                        })
                      : t('vehicles.listSubtitle', {
                          plate: vehicle.plate,
                          tripCount: vehicle.tripCount,
                          fuelCount: vehicle.fuelCount,
                        })
                  }
                  meta={formatDate(vehicle.lastActivityAt, t('vehicles.noActivityYet'))}
                  onPress={() => openVehicleDetail(vehicle)}
                  disabled={deletingVehicleId === vehicle.id}
                />
              </Swipeable>
            </View>
          )}
        />
        <ReasonRequiredModal
          visible={reasonModalVisible}
          title={t('audit.reason.vehicleDeleteTitle')}
          description={t('audit.reason.vehicleDeleteDescription')}
          confirmLabel={t('audit.reason.deleteAction')}
          submitting={Boolean(deletingVehicleId)}
          onCancel={() => {
            if (deletingVehicleId) {
              return;
            }
            setReasonModalVisible(false);
            setVehiclePendingDelete(null);
          }}
          onConfirm={(reason) => {
            if (!vehiclePendingDelete || deletingVehicleId) {
              return;
            }

            void (async () => {
              setDeletingVehicleId(vehiclePendingDelete.id);
              try {
                await vehiclesRepo.delete(vehiclePendingDelete.id, { reason });
                setReasonModalVisible(false);
                setVehiclePendingDelete(null);
                setVehicles((current) => current.filter((vehicle) => vehicle.id !== vehiclePendingDelete.id));
                await loadVehicles(query);
              } catch (error) {
                Alert.alert(
                  t('vehicleDetail.deleteFailedTitle'),
                  error instanceof Error ? error.message : t('common.unexpectedError'),
                );
              } finally {
                setDeletingVehicleId(null);
              }
            })();
          }}
        />
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  headerSection: {
    gap: Spacing.three,
  },
  loadingWrap: {
    marginTop: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  rowWrap: {
    marginTop: Spacing.two,
  },
  swipeDeleteAction: {
    width: 104,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  swipeDeleteText: {
    color: '#FFFFFF',
  },
});


