import { SharedFleetError } from '@/shared-fleet/errors';
import { getSharedSupabaseClient } from '@/shared-fleet/supabase/client';
import { invokeSharedFunction } from '@/shared-fleet/supabase/functions';
import type { FleetAssignmentMetrics, VehicleWithEffectiveStatus } from '@/shared-fleet/types';

import type { VehicleAccessRepo } from './contracts';
import {
  calculateFleetAssignmentMetrics,
  deriveEffectiveVehicleStatus,
  mapAssignment,
  mapVehicle,
  type AssignmentRow,
  type VehicleRow,
} from './mappers';

const VEHICLE_COLUMNS = [
  'id',
  'fleet_id',
  'name',
  'plate',
  'status',
  'blocked_until',
  'blocked_reason',
  'archived_at',
  'archived_by_user_id',
  'archive_reason',
  'created_by_user_id',
  'updated_by_user_id',
  'deleted_at',
  'created_at',
  'updated_at',
].join(', ');

const ASSIGNMENT_COLUMNS = [
  'id',
  'fleet_id',
  'vehicle_id',
  'driver_user_id',
  'driver_membership_id',
  'status',
  'requested_by_user_id',
  'approved_by_user_id',
  'ended_by_user_id',
  'rejected_by_user_id',
  'cancelled_by_user_id',
  'requested_at',
  'started_at',
  'ended_at',
  'rejected_at',
  'cancelled_at',
  'end_reason',
  'rejected_reason',
  'cancelled_reason',
  'created_at',
  'updated_at',
].join(', ');

type CreateVehicleResponse = {
  vehicle: VehicleRow;
};

type VehicleMutationResponse = {
  vehicle: VehicleRow;
};

function requireId(value: string, fieldName: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new SharedFleetError('shared_validation_error', `${fieldName} is required.`);
  }

  return normalized;
}

function asRows<TRow>(data: unknown): TRow[] {
  return ((data ?? []) as unknown) as TRow[];
}

async function loadFleetVehicleAssignments(input: { fleetId: string; includeArchived: boolean }) {
  const { fleetId, includeArchived } = input;
  const supabase = getSharedSupabaseClient();
  let vehiclesQuery = supabase
    .from('vehicles')
    .select(VEHICLE_COLUMNS)
    .eq('fleet_id', fleetId)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (!includeArchived) {
    vehiclesQuery = vehiclesQuery.is('archived_at', null);
  }

  const [vehiclesResult, activeAssignmentsResult, pendingCountsResult] = await Promise.all([
    vehiclesQuery,
    supabase
      .from('vehicle_assignments')
      .select(ASSIGNMENT_COLUMNS)
      .eq('fleet_id', fleetId)
      .eq('status', 'active')
      .is('ended_at', null),
    supabase
      .from('vehicle_assignments')
      .select('vehicle_id')
      .eq('fleet_id', fleetId)
      .eq('status', 'pending'),
  ]);

  if (vehiclesResult.error) {
    throw new SharedFleetError('shared_unknown_error', vehiclesResult.error.message, {
      cause: vehiclesResult.error,
      status: null,
    });
  }

  if (activeAssignmentsResult.error) {
    throw new SharedFleetError('shared_unknown_error', activeAssignmentsResult.error.message, {
      cause: activeAssignmentsResult.error,
      status: null,
    });
  }

  if (pendingCountsResult.error) {
    throw new SharedFleetError('shared_unknown_error', pendingCountsResult.error.message, {
      cause: pendingCountsResult.error,
      status: null,
    });
  }

  const vehicles = asRows<VehicleRow>(vehiclesResult.data).map(mapVehicle);
  const activeAssignments = asRows<AssignmentRow>(activeAssignmentsResult.data).map(mapAssignment);
  const pendingCounts = new Map<string, number>();

  for (const row of asRows<{ vehicle_id: string }>(pendingCountsResult.data)) {
    pendingCounts.set(row.vehicle_id, (pendingCounts.get(row.vehicle_id) ?? 0) + 1);
  }

  return {
    vehicles,
    activeAssignments,
    pendingCounts,
  };
}

export const vehicleAccessRepo: VehicleAccessRepo = {
  async createVehicle(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const name = input.name.trim();
    const plate = input.plate.trim().toUpperCase();

    if (name.length < 2 || name.length > 80) {
      throw new SharedFleetError('shared_validation_error', 'Vehicle name must be between 2 and 80 characters.');
    }

    if (plate.length < 2 || plate.length > 32) {
      throw new SharedFleetError('shared_validation_error', 'Plate must be between 2 and 32 characters.');
    }

    const response = await invokeSharedFunction<CreateVehicleResponse, { fleetId: string; name: string; plate: string }>('create-vehicle', {
      fleetId,
      name,
      plate,
    });

    return mapVehicle(response.vehicle);
  },

  async listFleetVehicleAccess(input) {
    const normalizedFleetId = requireId(input.fleetId, 'Fleet id');
    const includeArchived = input.includeArchived ?? false;
    const { vehicles, activeAssignments, pendingCounts } = await loadFleetVehicleAssignments({
      fleetId: normalizedFleetId,
      includeArchived,
    });

    const activeAssignmentMap = new Map(activeAssignments.map((assignment) => [assignment.vehicleId, assignment]));

    return vehicles.map((vehicle): VehicleWithEffectiveStatus => {
      const activeAssignment = activeAssignmentMap.get(vehicle.id) ?? null;

      return {
        ...vehicle,
        effectiveStatus: deriveEffectiveVehicleStatus({
          vehicle,
          currentAssignment: activeAssignment,
        }),
        currentAssignment: activeAssignment
          ? {
              ...activeAssignment,
              driverProfile: null,
              vehicle,
            }
          : null,
        pendingRequestCount: pendingCounts.get(vehicle.id) ?? 0,
      };
    });
  },

  async getFleetAssignmentMetrics(fleetId) {
    const normalizedFleetId = requireId(fleetId, 'Fleet id');
    const { vehicles, activeAssignments, pendingCounts } = await loadFleetVehicleAssignments({
      fleetId: normalizedFleetId,
      includeArchived: false,
    });
    const activeAssignmentMap = new Map(activeAssignments.map((assignment) => [assignment.vehicleId, assignment]));
    const vehicleAccessRows = vehicles.map((vehicle): VehicleWithEffectiveStatus => {
      const activeAssignment = activeAssignmentMap.get(vehicle.id) ?? null;
      return {
        ...vehicle,
        effectiveStatus: deriveEffectiveVehicleStatus({
          vehicle,
          currentAssignment: activeAssignment,
        }),
        currentAssignment: activeAssignment
          ? {
              ...activeAssignment,
              driverProfile: null,
              vehicle,
            }
          : null,
        pendingRequestCount: pendingCounts.get(vehicle.id) ?? 0,
      };
    });

    const metrics: FleetAssignmentMetrics = calculateFleetAssignmentMetrics(vehicleAccessRows);
    return metrics;
  },

  async archiveVehicle(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const vehicleId = requireId(input.vehicleId, 'Vehicle id');
    const archiveReason = input.archiveReason?.trim() ?? '';

    const response = await invokeSharedFunction<
      VehicleMutationResponse,
      { fleetId: string; vehicleId: string; archiveReason?: string }
    >('archive-vehicle', archiveReason ? { fleetId, vehicleId, archiveReason } : { fleetId, vehicleId });

    return mapVehicle(response.vehicle);
  },

  async unarchiveVehicle(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const vehicleId = requireId(input.vehicleId, 'Vehicle id');

    const response = await invokeSharedFunction<VehicleMutationResponse, { fleetId: string; vehicleId: string }>('unarchive-vehicle', {
      fleetId,
      vehicleId,
    });

    return mapVehicle(response.vehicle);
  },
};
