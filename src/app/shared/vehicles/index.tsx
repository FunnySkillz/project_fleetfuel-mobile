import { type Href, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { ActionRow, AppText, Button, Card, EmptyState, FormField, Input, ListRow, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { SharedFleetError } from '@/shared-fleet/errors';
import { useSharedFleet } from '@/shared-fleet/hooks/use-shared-fleet';
import { createSharedVehicle, loadFleetVehiclesWithAccess } from '@/shared-fleet/services';
import type { VehicleWithEffectiveStatus } from '@/shared-fleet/types';

function statusLabel(vehicle: VehicleWithEffectiveStatus) {
  if (vehicle.effectiveStatus === 'blocked') {
    return 'Blocked';
  }

  if (vehicle.effectiveStatus === 'driving') {
    return 'Driving';
  }

  return 'Available';
}

function formatMeta(vehicle: VehicleWithEffectiveStatus) {
  const pending = vehicle.pendingRequestCount > 0 ? ` | pending ${vehicle.pendingRequestCount}` : '';
  return `${statusLabel(vehicle)}${pending}`;
}

function formatSubtitle(vehicle: VehicleWithEffectiveStatus) {
  if (vehicle.currentAssignment?.driverProfile?.email) {
    return `Plate ${vehicle.plate} | driver ${vehicle.currentAssignment.driverProfile.email}`;
  }

  return `Plate ${vehicle.plate}`;
}

export default function SharedVehiclesScreen() {
  const router = useRouter();
  const { activeFleet, activeFleetId } = useSharedFleet();
  const [vehicles, setVehicles] = useState<VehicleWithEffectiveStatus[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vehicleName, setVehicleName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  const isManager = useMemo(() => activeFleet?.role === 'owner' || activeFleet?.role === 'admin', [activeFleet?.role]);

  const loadVehicles = useCallback(async () => {
    if (!activeFleetId) {
      setVehicles([]);
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const loaded = await loadFleetVehiclesWithAccess({ fleetId: activeFleetId });
      setVehicles(loaded);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Could not load vehicles.');
    }
  }, [activeFleetId]);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  const handleCreateVehicle = async () => {
    if (!activeFleetId) {
      return;
    }

    setCreateBusy(true);
    setErrorMessage(null);

    try {
      await createSharedVehicle({
        fleetId: activeFleetId,
        name: vehicleName,
        plate: vehiclePlate,
      });
      setVehicleName('');
      setVehiclePlate('');
      await loadVehicles();
    } catch (error) {
      if (error instanceof SharedFleetError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Could not create vehicle.');
      }
    } finally {
      setCreateBusy(false);
    }
  };

  const canCreateVehicle = vehicleName.trim().length > 1 && vehiclePlate.trim().length > 1 && Boolean(activeFleetId);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.headerSection}>
              <SectionHeader
                title="Vehicle Access"
                description={activeFleet ? `Vehicles in ${activeFleet.fleet.name}.` : 'Select an active fleet first.'}
              />

              <Card className="gap-2">
                <ActionRow
                  label="Pending Requests"
                  description="Open assignment requests queue for this fleet."
                  onPress={() => {
                    router.push('/shared/pending-requests' as Href);
                  }}
                />
                <ActionRow
                  label="Assignment History"
                  description="Inspect assignment timeline records."
                  onPress={() => {
                    router.push('/shared/history' as Href);
                  }}
                />
              </Card>

              {isManager ? (
                <Card className="gap-3">
                  <AppText variant="subtitle">Add Vehicle</AppText>
                  <FormField label="Vehicle name" required>
                    <Input
                      value={vehicleName}
                      onChangeText={setVehicleName}
                      placeholder="Golf GTI"
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  </FormField>
                  <FormField label="Plate" required>
                    <Input
                      value={vehiclePlate}
                      onChangeText={setVehiclePlate}
                      placeholder="B-FF-204"
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                  </FormField>
                  <Button
                    label="Create Vehicle"
                    disabled={!canCreateVehicle}
                    loading={createBusy}
                    loadingLabel="Creating..."
                    onPress={() => {
                      void handleCreateVehicle();
                    }}
                  />
                </Card>
              ) : null}

              {errorMessage ? (
                <Card tone="destructive">
                  <AppText variant="caption" color="destructive">{errorMessage}</AppText>
                </Card>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            status === 'loading' ? (
              <Card>
                <AppText variant="caption" color="secondary">Loading vehicles...</AppText>
              </Card>
            ) : status === 'error' ? (
              <EmptyState
                tone="destructive"
                title="Could not load vehicles"
                description={errorMessage ?? 'Unexpected error while loading vehicles.'}
              />
            ) : (
              <EmptyState
                title="No vehicles yet"
                description={isManager ? 'Create the first shared vehicle to start assignment workflows.' : 'No vehicles are available in this fleet yet.'}
              />
            )
          }
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <ListRow
                title={item.name}
                subtitle={formatSubtitle(item)}
                meta={formatMeta(item)}
                onPress={() => {
                  router.push(`/shared/vehicles/${item.id}` as Href);
                }}
              />
            </View>
          )}
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
  rowWrap: {
    marginTop: Spacing.two,
  },
});
