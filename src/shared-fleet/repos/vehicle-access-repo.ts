import { SharedFleetError } from '@/shared-fleet/errors';
import { getSharedSupabaseClient } from '@/shared-fleet/supabase/client';
import type { Vehicle, VehicleAssignment } from '@/shared-fleet/types';

import type { VehicleAccessRepo } from './contracts';

function mapVehicle(row: {
  id: string;
  fleet_id: string;
  name: string;
  plate: string;
  status: Vehicle['status'];
  blocked_until: string | null;
  blocked_reason: string | null;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}): Vehicle {
  return {
    id: row.id,
    fleetId: row.fleet_id,
    name: row.name,
    plate: row.plate,
    status: row.status,
    blockedUntil: row.blocked_until,
    blockedReason: row.blocked_reason,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssignment(row: {
  id: string;
  fleet_id: string;
  vehicle_id: string;
  driver_user_id: string;
  driver_membership_id: string;
  status: VehicleAssignment['status'];
  requested_by_user_id: string | null;
  approved_by_user_id: string | null;
  ended_by_user_id: string | null;
  requested_at: string;
  started_at: string | null;
  ended_at: string | null;
  ended_reason: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}): VehicleAssignment {
  return {
    id: row.id,
    fleetId: row.fleet_id,
    vehicleId: row.vehicle_id,
    driverUserId: row.driver_user_id,
    driverMembershipId: row.driver_membership_id,
    status: row.status,
    requestedByUserId: row.requested_by_user_id,
    approvedByUserId: row.approved_by_user_id,
    endedByUserId: row.ended_by_user_id,
    requestedAt: row.requested_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    endedReason: row.ended_reason,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const vehicleAccessRepo: VehicleAccessRepo = {
  async listFleetVehicles(fleetId) {
    const normalizedFleetId = fleetId.trim();
    if (!normalizedFleetId) {
      throw new SharedFleetError('shared_validation_error', 'Fleet id is required.');
    }

    const supabase = getSharedSupabaseClient();
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, fleet_id, name, plate, status, blocked_until, blocked_reason, created_by_user_id, updated_by_user_id, deleted_at, created_at, updated_at')
      .eq('fleet_id', normalizedFleetId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) {
      throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
    }

    return ((data ?? []) as {
      id: string;
      fleet_id: string;
      name: string;
      plate: string;
      status: Vehicle['status'];
      blocked_until: string | null;
      blocked_reason: string | null;
      created_by_user_id: string | null;
      updated_by_user_id: string | null;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
    }[]).map(mapVehicle);
  },

  async listFleetAssignments(fleetId) {
    const normalizedFleetId = fleetId.trim();
    if (!normalizedFleetId) {
      throw new SharedFleetError('shared_validation_error', 'Fleet id is required.');
    }

    const supabase = getSharedSupabaseClient();
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select(
        'id, fleet_id, vehicle_id, driver_user_id, driver_membership_id, status, requested_by_user_id, approved_by_user_id, ended_by_user_id, requested_at, started_at, ended_at, ended_reason, rejection_reason, created_at, updated_at',
      )
      .eq('fleet_id', normalizedFleetId)
      .order('requested_at', { ascending: false });

    if (error) {
      throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
    }

    return ((data ?? []) as {
      id: string;
      fleet_id: string;
      vehicle_id: string;
      driver_user_id: string;
      driver_membership_id: string;
      status: VehicleAssignment['status'];
      requested_by_user_id: string | null;
      approved_by_user_id: string | null;
      ended_by_user_id: string | null;
      requested_at: string;
      started_at: string | null;
      ended_at: string | null;
      ended_reason: string | null;
      rejection_reason: string | null;
      created_at: string;
      updated_at: string;
    }[]).map(mapAssignment);
  },
};
