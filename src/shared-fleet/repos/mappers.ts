import type {
  AssignmentStatus,
  FleetAssignmentMetrics,
  Profile,
  Vehicle,
  VehicleAssignment,
  VehicleStatus,
  VehicleWithEffectiveStatus,
} from '@/shared-fleet/types';

export type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type VehicleRow = {
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
};

export type AssignmentRow = {
  id: string;
  fleet_id: string;
  vehicle_id: string;
  driver_user_id: string;
  driver_membership_id: string;
  status: AssignmentStatus;
  requested_by_user_id: string | null;
  approved_by_user_id: string | null;
  ended_by_user_id: string | null;
  rejected_by_user_id: string | null;
  cancelled_by_user_id: string | null;
  requested_at: string;
  started_at: string | null;
  ended_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
  end_reason: VehicleAssignment['endReason'];
  rejected_reason: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
};

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapVehicle(row: VehicleRow): Vehicle {
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

export function mapAssignment(row: AssignmentRow): VehicleAssignment {
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
    rejectedByUserId: row.rejected_by_user_id,
    cancelledByUserId: row.cancelled_by_user_id,
    requestedAt: row.requested_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    rejectedAt: row.rejected_at,
    cancelledAt: row.cancelled_at,
    endReason: row.end_reason,
    rejectedReason: row.rejected_reason,
    cancelledReason: row.cancelled_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isVehicleBlocked(blockedUntil: string | null, nowMs = Date.now()) {
  if (!blockedUntil) {
    return false;
  }

  const parsed = new Date(blockedUntil).getTime();
  if (Number.isNaN(parsed)) {
    return false;
  }

  return parsed > nowMs;
}

export function deriveEffectiveVehicleStatus(input: {
  vehicle: Vehicle;
  currentAssignment: VehicleAssignment | null;
  nowMs?: number;
}): VehicleStatus {
  if (isVehicleBlocked(input.vehicle.blockedUntil, input.nowMs)) {
    return 'blocked';
  }

  if (input.currentAssignment && input.currentAssignment.status === 'active' && input.currentAssignment.endedAt === null) {
    return 'driving';
  }

  return 'available';
}

export function calculateFleetAssignmentMetrics(vehicles: VehicleWithEffectiveStatus[]): FleetAssignmentMetrics {
  const activeDriverIds = new Set<string>();
  let vehiclesInUse = 0;
  let availableVehicles = 0;
  let blockedVehicles = 0;
  let pendingRequests = 0;

  for (const vehicle of vehicles) {
    pendingRequests += vehicle.pendingRequestCount;
    if (vehicle.currentAssignment?.status === 'active' && vehicle.currentAssignment.endedAt === null) {
      activeDriverIds.add(vehicle.currentAssignment.driverUserId);
    }

    if (vehicle.effectiveStatus === 'blocked') {
      blockedVehicles += 1;
      continue;
    }

    if (vehicle.effectiveStatus === 'driving') {
      vehiclesInUse += 1;
      continue;
    }

    availableVehicles += 1;
  }

  return {
    activeDrivers: activeDriverIds.size,
    vehiclesInUse,
    availableVehicles,
    blockedVehicles,
    pendingRequests,
  };
}
