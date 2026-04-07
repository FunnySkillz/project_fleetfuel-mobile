import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSharedVehicle,
  loadFleetAssignmentMetrics,
  loadFleetVehiclesWithAccess,
} from '@/shared-fleet/services/vehicle-access-service';

const { vehicleAccessRepoMock } = vi.hoisted(() => ({
  vehicleAccessRepoMock: {
    createVehicle: vi.fn(),
    listFleetVehicleAccess: vi.fn(),
    getFleetAssignmentMetrics: vi.fn(),
  },
}));

vi.mock('@/shared-fleet/repos', () => ({
  vehicleAccessRepo: vehicleAccessRepoMock,
}));

describe('vehicle access service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a shared vehicle through repo', async () => {
    vehicleAccessRepoMock.createVehicle.mockResolvedValueOnce({ id: 'veh-1' });

    const result = await createSharedVehicle({ fleetId: 'fleet-1', name: 'Test Car', plate: 'B-XX-1' });

    expect(result).toEqual({ id: 'veh-1' });
    expect(vehicleAccessRepoMock.createVehicle).toHaveBeenCalledWith({
      fleetId: 'fleet-1',
      name: 'Test Car',
      plate: 'B-XX-1',
    });
  });

  it('loads effective vehicle access list', async () => {
    vehicleAccessRepoMock.listFleetVehicleAccess.mockResolvedValueOnce([{ id: 'veh-1', effectiveStatus: 'available' }]);

    const result = await loadFleetVehiclesWithAccess({ fleetId: 'fleet-1' });

    expect(result).toEqual([{ id: 'veh-1', effectiveStatus: 'available' }]);
  });

  it('loads assignment-truth metrics for shared dashboard', async () => {
    vehicleAccessRepoMock.getFleetAssignmentMetrics.mockResolvedValueOnce({
      activeDrivers: 2,
      vehiclesInUse: 2,
      availableVehicles: 1,
      blockedVehicles: 1,
      pendingRequests: 3,
    });

    const metrics = await loadFleetAssignmentMetrics({ fleetId: 'fleet-1' });

    expect(metrics).toEqual({
      activeDrivers: 2,
      vehiclesInUse: 2,
      availableVehicles: 1,
      blockedVehicles: 1,
      pendingRequests: 3,
    });
  });
});
