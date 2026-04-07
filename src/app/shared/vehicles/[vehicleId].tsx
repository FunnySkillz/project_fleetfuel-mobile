import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import {
  AppText,
  Button,
  Card,
  DateTimeField,
  EmptyState,
  FormField,
  SectionHeader,
  SelectField,
  TextArea,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { SharedFleetError } from '@/shared-fleet/errors';
import { useSharedFleet } from '@/shared-fleet/hooks/use-shared-fleet';
import {
  approveAssignment,
  archiveVehicle,
  blockVehicle,
  cancelAssignment,
  directAssignVehicle,
  endAssignment,
  getFleetPendingAssignmentRequests,
  getVehicleCurrentAssignment,
  getVehicleTimeline,
  loadFleetMembers,
  loadFleetVehiclesWithAccess,
  rejectAssignment,
  unarchiveVehicle,
  requestAssignment,
  unblockVehicle,
} from '@/shared-fleet/services';
import type { FleetMemberProfile, VehicleAssignmentWithContext, VehicleWithEffectiveStatus } from '@/shared-fleet/types';

function readParam(param: string | string[] | undefined) {
  if (!param) {
    return null;
  }

  return Array.isArray(param) ? param[0] : param;
}

function formatStatus(status: VehicleWithEffectiveStatus['effectiveStatus']) {
  if (status === 'blocked') {
    return 'Blocked';
  }

  if (status === 'driving') {
    return 'Driving';
  }

  return 'Available';
}

function formatAssignmentMeta(assignment: VehicleAssignmentWithContext) {
  const started = assignment.startedAt ? new Date(assignment.startedAt).toLocaleString() : 'not started';
  const ended = assignment.endedAt ? new Date(assignment.endedAt).toLocaleString() : 'ongoing';
  const reason = assignment.endReason ? ` | end reason ${assignment.endReason}` : '';
  return `${assignment.status} | start ${started} | end ${ended}${reason}`;
}

function parseBlockedUntil(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export default function SharedVehicleDetailScreen() {
  const params = useLocalSearchParams();
  const vehicleId = useMemo(() => readParam(params.vehicleId), [params.vehicleId]);
  const { activeFleet, activeFleetId, user } = useSharedFleet();
  const [vehicle, setVehicle] = useState<VehicleWithEffectiveStatus | null>(null);
  const [currentAssignment, setCurrentAssignment] = useState<VehicleAssignmentWithContext | null>(null);
  const [pendingRequests, setPendingRequests] = useState<VehicleAssignmentWithContext[]>([]);
  const [timeline, setTimeline] = useState<VehicleAssignmentWithContext[]>([]);
  const [drivers, setDrivers] = useState<FleetMemberProfile[]>([]);
  const [loadingState, setLoadingState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [selectedDriverMembershipId, setSelectedDriverMembershipId] = useState<string | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [blockUntilInput, setBlockUntilInput] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [archiveReason, setArchiveReason] = useState('');

  const isManager = activeFleet?.role === 'owner' || activeFleet?.role === 'admin';
  const isDriver = activeFleet?.role === 'driver';
  const userId = user?.id ?? null;

  const loadData = useCallback(async () => {
    if (!activeFleetId || !vehicleId) {
      setLoadingState('error');
      setErrorMessage('Missing fleet or vehicle context.');
      return;
    }

    setLoadingState('loading');
    setErrorMessage(null);

    try {
      const [vehicles, active, allPending, assignmentTimeline, members] = await Promise.all([
        loadFleetVehiclesWithAccess({ fleetId: activeFleetId, includeArchived: true }),
        getVehicleCurrentAssignment({ fleetId: activeFleetId, vehicleId }),
        getFleetPendingAssignmentRequests({ fleetId: activeFleetId }),
        getVehicleTimeline({ fleetId: activeFleetId, vehicleId }),
        isManager ? loadFleetMembers({ fleetId: activeFleetId }) : Promise.resolve([] as FleetMemberProfile[]),
      ]);

      const selectedVehicle = vehicles.find((item) => item.id === vehicleId) ?? null;
      setVehicle(selectedVehicle);
      setCurrentAssignment(active);
      setPendingRequests(allPending.filter((request) => request.vehicleId === vehicleId));
      setTimeline(assignmentTimeline);
      setDrivers(members.filter((member) => member.role === 'driver'));
      setLoadingState('ready');
    } catch (error) {
      setLoadingState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Could not load vehicle access details.');
    }
  }, [activeFleetId, isManager, vehicleId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (selectedDriverMembershipId) {
      return;
    }

    const firstDriver = drivers[0];
    if (firstDriver) {
      setSelectedDriverMembershipId(firstDriver.id);
    }
  }, [drivers, selectedDriverMembershipId]);

  const ownPending = useMemo(
    () => pendingRequests.find((assignment) => assignment.driverUserId === userId) ?? null,
    [pendingRequests, userId],
  );

  const canRequest = Boolean(
    activeFleetId &&
      vehicle &&
      isDriver &&
      !vehicle.archivedAt &&
      vehicle.effectiveStatus !== 'blocked' &&
      !currentAssignment &&
      !ownPending,
  );

  const canEndOwnAssignment = Boolean(
    isDriver &&
      currentAssignment &&
      currentAssignment.driverUserId === userId &&
      currentAssignment.status === 'active',
  );
  const isArchived = Boolean(vehicle?.archivedAt);

  const runAction = async (action: () => Promise<void>) => {
    setBusyAction(true);
    setErrorMessage(null);

    try {
      await action();
      await loadData();
    } catch (error) {
      if (error instanceof SharedFleetError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Shared Fleet action failed.');
      }
    } finally {
      setBusyAction(false);
    }
  };

  if (!activeFleetId || !vehicleId) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <EmptyState title="Missing context" description="Select an active fleet and vehicle first." />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SectionHeader
            title="Vehicle Access"
            description={activeFleet ? `${activeFleet.fleet.name} assignment operations.` : 'Shared fleet context required.'}
          />

          {loadingState === 'loading' ? (
            <Card>
              <AppText variant="caption" color="secondary">Loading vehicle access data...</AppText>
            </Card>
          ) : null}

          {vehicle ? (
            <Card className="gap-2">
              <AppText variant="subtitle">{vehicle.name}</AppText>
              <AppText variant="caption" color="secondary">Plate {vehicle.plate}</AppText>
              <AppText variant="caption" color="secondary">Effective status: {formatStatus(vehicle.effectiveStatus)}</AppText>
              {vehicle.blockedUntil ? (
                <AppText variant="caption" color="warning">
                  Blocked until: {new Date(vehicle.blockedUntil).toLocaleString()}
                </AppText>
              ) : null}
              {vehicle.blockedReason ? (
                <AppText variant="caption" color="secondary">Block reason: {vehicle.blockedReason}</AppText>
              ) : null}
              {vehicle.archivedAt ? (
                <AppText variant="caption" color="warning">
                  Archived at: {new Date(vehicle.archivedAt).toLocaleString()}
                </AppText>
              ) : null}
              {vehicle.archiveReason ? (
                <AppText variant="caption" color="secondary">Archive reason: {vehicle.archiveReason}</AppText>
              ) : null}
            </Card>
          ) : null}

          {currentAssignment ? (
            <Card className="gap-2">
              <AppText variant="subtitle">Current Active Assignment</AppText>
              <AppText variant="caption" color="secondary">
                Driver: {currentAssignment.driverProfile?.email ?? currentAssignment.driverUserId}
              </AppText>
              <AppText variant="caption" color="secondary">
                Started: {currentAssignment.startedAt ? new Date(currentAssignment.startedAt).toLocaleString() : 'n/a'}
              </AppText>

              {canEndOwnAssignment ? (
                <Button
                  label="End My Assignment"
                  loading={busyAction}
                  loadingLabel="Ending..."
                  onPress={() => {
                    void runAction(async () => {
                      await endAssignment({ assignmentId: currentAssignment.id, endReason: 'driver_ended' });
                    });
                  }}
                />
              ) : null}

              {isManager ? (
                <Button
                  label="End Active Assignment"
                  variant="secondary"
                  loading={busyAction}
                  loadingLabel="Ending..."
                  onPress={() => {
                    void runAction(async () => {
                      await endAssignment({ assignmentId: currentAssignment.id, endReason: 'admin_ended' });
                    });
                  }}
                />
              ) : null}
            </Card>
          ) : (
            <Card>
              <AppText variant="caption" color="secondary">No active assignment for this vehicle.</AppText>
            </Card>
          )}

          {isDriver ? (
            <Card className="gap-2">
              <AppText variant="subtitle">Driver Actions</AppText>
              <Button
                label="Request Vehicle"
                disabled={!canRequest || busyAction}
                loading={busyAction && canRequest}
                loadingLabel="Requesting..."
                onPress={() => {
                  void runAction(async () => {
                    await requestAssignment({
                      fleetId: activeFleetId,
                      vehicleId,
                    });
                  });
                }}
              />

              {ownPending ? (
                <Button
                  label="Cancel My Pending Request"
                  variant="secondary"
                  loading={busyAction}
                  loadingLabel="Cancelling..."
                  onPress={() => {
                    void runAction(async () => {
                      await cancelAssignment({
                        assignmentId: ownPending.id,
                        reason: decisionReason || undefined,
                      });
                    });
                  }}
                />
              ) : null}
            </Card>
          ) : null}

          {isManager ? (
            <Card className="gap-3">
              <AppText variant="subtitle">Owner/Admin Actions</AppText>

              <FormField label="Direct assign driver">
                <SelectField
                  options={drivers.map((driver) => ({
                    value: driver.id,
                    label: driver.profile?.email ?? driver.userId,
                  }))}
                  value={selectedDriverMembershipId}
                  onChange={setSelectedDriverMembershipId}
                />
              </FormField>

              <Button
                label="Direct Assign"
                disabled={!selectedDriverMembershipId || busyAction || vehicle?.effectiveStatus === 'blocked' || isArchived}
                loading={busyAction}
                loadingLabel="Assigning..."
                onPress={() => {
                  if (!selectedDriverMembershipId) {
                    return;
                  }

                  void runAction(async () => {
                    await directAssignVehicle({
                      fleetId: activeFleetId,
                      vehicleId,
                      driverMembershipId: selectedDriverMembershipId,
                    });
                  });
                }}
              />

              <FormField label="Block until" required>
                <DateTimeField
                  mode="datetime"
                  value={blockUntilInput}
                  onChangeText={setBlockUntilInput}
                  placeholder="2026-05-01 09:00"
                />
              </FormField>

              <FormField label="Block reason">
                <TextArea
                  value={blockReason}
                  onChangeText={setBlockReason}
                  placeholder="Maintenance window"
                />
              </FormField>

              <Button
                label="Block Vehicle"
                variant="destructive"
                disabled={busyAction || !parseBlockedUntil(blockUntilInput) || isArchived}
                loading={busyAction}
                loadingLabel="Blocking..."
                onPress={() => {
                  const blockedUntil = parseBlockedUntil(blockUntilInput);
                  if (!blockedUntil) {
                    return;
                  }

                  void runAction(async () => {
                    await blockVehicle({
                      fleetId: activeFleetId,
                      vehicleId,
                      blockedUntil,
                      blockedReason: blockReason || undefined,
                    });
                  });
                }}
              />

              <Button
                label="Unblock Vehicle"
                variant="secondary"
                disabled={busyAction || vehicle?.effectiveStatus !== 'blocked' || isArchived}
                loading={busyAction}
                loadingLabel="Unblocking..."
                onPress={() => {
                  void runAction(async () => {
                    await unblockVehicle({ fleetId: activeFleetId, vehicleId });
                  });
                }}
              />

              <FormField label="Archive reason">
                <TextArea
                  value={archiveReason}
                  onChangeText={setArchiveReason}
                  placeholder="Out of service"
                />
              </FormField>

              {!isArchived ? (
                <Button
                  label="Archive Vehicle"
                  variant="secondary"
                  tone="warning"
                  disabled={busyAction}
                  loading={busyAction}
                  loadingLabel="Archiving..."
                  onPress={() => {
                    void runAction(async () => {
                      await archiveVehicle({
                        fleetId: activeFleetId,
                        vehicleId,
                        archiveReason: archiveReason || undefined,
                      });
                    });
                  }}
                />
              ) : (
                <Button
                  label="Unarchive Vehicle"
                  variant="secondary"
                  disabled={busyAction}
                  loading={busyAction}
                  loadingLabel="Restoring..."
                  onPress={() => {
                    void runAction(async () => {
                      await unarchiveVehicle({ fleetId: activeFleetId, vehicleId });
                    });
                  }}
                />
              )}
            </Card>
          ) : null}

          <Card className="gap-2">
            <AppText variant="subtitle">Pending Requests</AppText>
            <FormField label="Decision reason (optional)">
              <TextArea
                value={decisionReason}
                onChangeText={setDecisionReason}
                placeholder="Optional reason for reject/cancel."
              />
            </FormField>

            {pendingRequests.length === 0 ? (
              <AppText variant="caption" color="secondary">No pending requests for this vehicle.</AppText>
            ) : (
              pendingRequests.map((assignment) => (
                <Card key={assignment.id} className="gap-2" variant="outline">
                  <AppText variant="label">{assignment.driverProfile?.email ?? assignment.driverUserId}</AppText>
                  <AppText variant="caption" color="secondary">
                    Requested: {new Date(assignment.requestedAt).toLocaleString()}
                  </AppText>

                  {isManager ? (
                    <View style={styles.row}>
                      <Button
                        label="Approve"
                        size="sm"
                        loading={busyAction}
                        loadingLabel="Approving..."
                        onPress={() => {
                          void runAction(async () => {
                            await approveAssignment({ assignmentId: assignment.id });
                          });
                        }}
                      />
                      <Button
                        label="Reject"
                        size="sm"
                        variant="destructive"
                        loading={busyAction}
                        loadingLabel="Rejecting..."
                        onPress={() => {
                          void runAction(async () => {
                            await rejectAssignment({
                              assignmentId: assignment.id,
                              reason: decisionReason || undefined,
                            });
                          });
                        }}
                      />
                    </View>
                  ) : null}

                  {isDriver && assignment.driverUserId === userId ? (
                    <Button
                      label="Cancel Request"
                      variant="secondary"
                      size="sm"
                      loading={busyAction}
                      loadingLabel="Cancelling..."
                      onPress={() => {
                        void runAction(async () => {
                          await cancelAssignment({
                            assignmentId: assignment.id,
                            reason: decisionReason || undefined,
                          });
                        });
                      }}
                    />
                  ) : null}
                </Card>
              ))
            )}
          </Card>

          <Card className="gap-2">
            <AppText variant="subtitle">Timeline</AppText>
            {timeline.length === 0 ? (
              <AppText variant="caption" color="secondary">No assignment history recorded yet.</AppText>
            ) : (
              timeline.map((assignment) => (
                <Card key={assignment.id} className="gap-1" variant="outline">
                  <AppText variant="label">{assignment.driverProfile?.email ?? assignment.driverUserId}</AppText>
                  <AppText variant="caption" color="secondary">
                    {formatAssignmentMeta(assignment)}
                  </AppText>
                  {assignment.rejectedReason ? (
                    <AppText variant="caption" color="secondary">Reject reason: {assignment.rejectedReason}</AppText>
                  ) : null}
                  {assignment.cancelledReason ? (
                    <AppText variant="caption" color="secondary">Cancel reason: {assignment.cancelledReason}</AppText>
                  ) : null}
                </Card>
              ))
            )}
          </Card>

          {errorMessage ? (
            <Card tone="destructive">
              <AppText variant="caption" color="destructive">{errorMessage}</AppText>
            </Card>
          ) : null}
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
