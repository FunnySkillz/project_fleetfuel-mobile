import { SharedFleetError } from '@/shared-fleet/errors';
import { getSharedSupabaseClient } from '@/shared-fleet/supabase/client';
import { invokeSharedFunction } from '@/shared-fleet/supabase/functions';
import type {
  AssignmentEndReason,
  VehicleAssignment,
  VehicleAssignmentWithContext,
} from '@/shared-fleet/types';

import type { AssignmentRepo } from './contracts';
import { mapAssignment, mapProfile, mapVehicle, type AssignmentRow, type ProfileRow, type VehicleRow } from './mappers';

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

const VEHICLE_COLUMNS = [
  'id',
  'fleet_id',
  'name',
  'plate',
  'status',
  'blocked_until',
  'blocked_reason',
  'created_by_user_id',
  'updated_by_user_id',
  'deleted_at',
  'created_at',
  'updated_at',
].join(', ');

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

async function attachContext(assignments: VehicleAssignment[]): Promise<VehicleAssignmentWithContext[]> {
  if (assignments.length === 0) {
    return [];
  }

  const supabase = getSharedSupabaseClient();
  const uniqueDriverIds = Array.from(new Set(assignments.map((assignment) => assignment.driverUserId)));
  const uniqueVehicleIds = Array.from(new Set(assignments.map((assignment) => assignment.vehicleId)));

  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, display_name, created_at, updated_at')
    .in('id', uniqueDriverIds);

  if (profilesError) {
    throw new SharedFleetError('shared_unknown_error', profilesError.message, { cause: profilesError, status: null });
  }

  const { data: vehiclesData, error: vehiclesError } = await supabase
    .from('vehicles')
    .select(VEHICLE_COLUMNS)
    .in('id', uniqueVehicleIds);

  if (vehiclesError) {
    throw new SharedFleetError('shared_unknown_error', vehiclesError.message, { cause: vehiclesError, status: null });
  }

  const profileMap = new Map(asRows<ProfileRow>(profilesData).map((row) => [row.id, mapProfile(row)]));
  const vehicleMap = new Map(asRows<VehicleRow>(vehiclesData).map((row) => [row.id, mapVehicle(row)]));

  return assignments.map((assignment) => ({
    ...assignment,
    driverProfile: profileMap.get(assignment.driverUserId) ?? null,
    vehicle: vehicleMap.get(assignment.vehicleId) ?? null,
  }));
}

type AssignmentFunctionResponse = {
  assignment: AssignmentRow;
};

type VehicleFunctionResponse = {
  vehicle: VehicleRow;
};

export const assignmentRepo: AssignmentRepo = {
  async requestAssignment(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const vehicleId = requireId(input.vehicleId, 'Vehicle id');

    const response = await invokeSharedFunction<AssignmentFunctionResponse, { fleetId: string; vehicleId: string }>(
      'request-assignment',
      { fleetId, vehicleId },
    );

    return mapAssignment(response.assignment);
  },

  async approveAssignment(input) {
    const assignmentId = requireId(input.assignmentId, 'Assignment id');
    const response = await invokeSharedFunction<AssignmentFunctionResponse, { assignmentId: string }>('approve-assignment', {
      assignmentId,
    });
    return mapAssignment(response.assignment);
  },

  async rejectAssignment(input) {
    const assignmentId = requireId(input.assignmentId, 'Assignment id');
    const reason = input.reason?.trim() ?? '';

    const response = await invokeSharedFunction<AssignmentFunctionResponse, { assignmentId: string; reason?: string }>(
      'reject-assignment',
      reason ? { assignmentId, reason } : { assignmentId },
    );

    return mapAssignment(response.assignment);
  },

  async cancelAssignment(input) {
    const assignmentId = requireId(input.assignmentId, 'Assignment id');
    const reason = input.reason?.trim() ?? '';

    const response = await invokeSharedFunction<AssignmentFunctionResponse, { assignmentId: string; reason?: string }>(
      'cancel-assignment',
      reason ? { assignmentId, reason } : { assignmentId },
    );

    return mapAssignment(response.assignment);
  },

  async directAssign(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const vehicleId = requireId(input.vehicleId, 'Vehicle id');
    const driverMembershipId = requireId(input.driverMembershipId, 'Driver membership id');

    const response = await invokeSharedFunction<
      AssignmentFunctionResponse,
      { fleetId: string; vehicleId: string; driverMembershipId: string }
    >('direct-assign', {
      fleetId,
      vehicleId,
      driverMembershipId,
    });

    return mapAssignment(response.assignment);
  },

  async endAssignment(input) {
    const assignmentId = requireId(input.assignmentId, 'Assignment id');
    const payload: { assignmentId: string; endReason?: AssignmentEndReason } = { assignmentId };

    if (input.endReason) {
      payload.endReason = input.endReason;
    }

    const response = await invokeSharedFunction<AssignmentFunctionResponse, { assignmentId: string; endReason?: AssignmentEndReason }>(
      'end-assignment',
      payload,
    );

    return mapAssignment(response.assignment);
  },

  async blockVehicle(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const vehicleId = requireId(input.vehicleId, 'Vehicle id');
    const blockedUntil = requireId(input.blockedUntil, 'Blocked until');
    const blockedReason = input.blockedReason?.trim() ?? '';

    const response = await invokeSharedFunction<
      VehicleFunctionResponse,
      { fleetId: string; vehicleId: string; blockedUntil: string; blockedReason?: string }
    >('block-vehicle', blockedReason ? { fleetId, vehicleId, blockedUntil, blockedReason } : { fleetId, vehicleId, blockedUntil });

    return mapVehicle(response.vehicle);
  },

  async unblockVehicle(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const vehicleId = requireId(input.vehicleId, 'Vehicle id');

    const response = await invokeSharedFunction<VehicleFunctionResponse, { fleetId: string; vehicleId: string }>('unblock-vehicle', {
      fleetId,
      vehicleId,
    });

    return mapVehicle(response.vehicle);
  },

  async getVehicleCurrentAssignment(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const vehicleId = requireId(input.vehicleId, 'Vehicle id');
    const supabase = getSharedSupabaseClient();

    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select(ASSIGNMENT_COLUMNS)
      .eq('fleet_id', fleetId)
      .eq('vehicle_id', vehicleId)
      .eq('status', 'active')
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
    }

    const row = asRows<AssignmentRow>(data)[0];
    if (!row) {
      return null;
    }

    const assignments = await attachContext([mapAssignment(row)]);
    return assignments[0] ?? null;
  },

  async getFleetPendingAssignmentRequests(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const supabase = getSharedSupabaseClient();

    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select(ASSIGNMENT_COLUMNS)
      .eq('fleet_id', fleetId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });

    if (error) {
      throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
    }

    const mapped = asRows<AssignmentRow>(data).map(mapAssignment);
    return attachContext(mapped);
  },

  async getVehicleTimeline(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const vehicleId = requireId(input.vehicleId, 'Vehicle id');
    const supabase = getSharedSupabaseClient();

    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select(ASSIGNMENT_COLUMNS)
      .eq('fleet_id', fleetId)
      .eq('vehicle_id', vehicleId)
      .order('requested_at', { ascending: false });

    if (error) {
      throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
    }

    const mapped = asRows<AssignmentRow>(data).map(mapAssignment);
    return attachContext(mapped);
  },

  async getFleetAssignmentHistory(input) {
    const fleetId = requireId(input.fleetId, 'Fleet id');
    const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
    const supabase = getSharedSupabaseClient();

    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select(ASSIGNMENT_COLUMNS)
      .eq('fleet_id', fleetId)
      .order('requested_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
    }

    const mapped = asRows<AssignmentRow>(data).map(mapAssignment);
    return attachContext(mapped);
  },
};
