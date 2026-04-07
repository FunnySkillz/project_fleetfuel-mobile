import { describe, expect, it } from 'vitest';

import { calculateFleetAssignmentMetrics, deriveEffectiveVehicleStatus, isVehicleBlocked } from '@/shared-fleet/repos/mappers';
import type { Vehicle, VehicleAssignment, VehicleWithEffectiveStatus } from '@/shared-fleet/types';

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'veh-1',
    fleetId: 'fleet-1',
    name: 'Car 1',
    plate: 'B-XX-1',
    status: 'available',
    blockedUntil: null,
    blockedReason: null,
    createdByUserId: null,
    updatedByUserId: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function activeAssignment(overrides: Partial<VehicleAssignment> = {}): VehicleAssignment {
  return {
    id: 'a-1',
    fleetId: 'fleet-1',
    vehicleId: 'veh-1',
    driverUserId: 'driver-1',
    driverMembershipId: 'mem-1',
    status: 'active',
    requestedByUserId: 'driver-1',
    approvedByUserId: 'admin-1',
    endedByUserId: null,
    rejectedByUserId: null,
    cancelledByUserId: null,
    requestedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    endedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    endReason: null,
    rejectedReason: null,
    cancelledReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('shared vehicle status derivation', () => {
  it('treats future blocked_until as blocked', () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    expect(isVehicleBlocked(future)).toBe(true);
  });

  it('derives blocked over driving when both are present', () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const result = deriveEffectiveVehicleStatus({
      vehicle: vehicle({ blockedUntil: future }),
      currentAssignment: activeAssignment(),
    });

    expect(result).toBe('blocked');
  });

  it('derives driving from active assignment when not blocked', () => {
    const result = deriveEffectiveVehicleStatus({
      vehicle: vehicle(),
      currentAssignment: activeAssignment(),
    });

    expect(result).toBe('driving');
  });

  it('derives available when not blocked and no active assignment', () => {
    const result = deriveEffectiveVehicleStatus({
      vehicle: vehicle(),
      currentAssignment: null,
    });

    expect(result).toBe('available');
  });
});

describe('shared fleet assignment metrics', () => {
  it('counts active drivers and vehicles by effective status', () => {
    const rows: VehicleWithEffectiveStatus[] = [
      {
        ...vehicle({ id: 'veh-1' }),
        effectiveStatus: 'driving',
        pendingRequestCount: 1,
        currentAssignment: {
          ...activeAssignment({ driverUserId: 'driver-1', vehicleId: 'veh-1' }),
          driverProfile: null,
          vehicle: null,
        },
      },
      {
        ...vehicle({ id: 'veh-2' }),
        effectiveStatus: 'driving',
        pendingRequestCount: 0,
        currentAssignment: {
          ...activeAssignment({ id: 'a-2', driverUserId: 'driver-2', vehicleId: 'veh-2' }),
          driverProfile: null,
          vehicle: null,
        },
      },
      {
        ...vehicle({ id: 'veh-3' }),
        effectiveStatus: 'blocked',
        pendingRequestCount: 2,
        currentAssignment: null,
      },
      {
        ...vehicle({ id: 'veh-4' }),
        effectiveStatus: 'available',
        pendingRequestCount: 1,
        currentAssignment: null,
      },
    ];

    const metrics = calculateFleetAssignmentMetrics(rows);

    expect(metrics).toEqual({
      activeDrivers: 2,
      vehiclesInUse: 2,
      availableVehicles: 1,
      blockedVehicles: 1,
      pendingRequests: 4,
    });
  });
});
