import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  archiveVehicle,
  createSharedVehicle,
  loadFleetAssignmentMetrics,
  loadFleetVehiclesWithAccess,
  unarchiveVehicle,
} from '@/shared-fleet/services/vehicle-access-service';

const { vehicleAccessRepoMock } = vi.hoisted(() => ({
  vehicleAccessRepoMock: {
    createVehicle: vi.fn(),
    listFleetVehicleAccess: vi.fn(),
    getFleetAssignmentMetrics: vi.fn(),
    archiveVehicle: vi.fn(),
    unarchiveVehicle: vi.fn(),
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
    expect(vehicleAccessRepoMock.listFleetVehicleAccess).toHaveBeenCalledWith({ fleetId: 'fleet-1' });
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

  it('archives and unarchives vehicles through repo', async () => {
    vehicleAccessRepoMock.archiveVehicle.mockResolvedValueOnce({ id: 'veh-1', archivedAt: '2026-04-07T10:00:00.000Z' });
    vehicleAccessRepoMock.unarchiveVehicle.mockResolvedValueOnce({ id: 'veh-1', archivedAt: null });

    await expect(
      archiveVehicle({ fleetId: 'fleet-1', vehicleId: 'veh-1', archiveReason: 'Out of service' }),
    ).resolves.toMatchObject({ id: 'veh-1' });
    await expect(unarchiveVehicle({ fleetId: 'fleet-1', vehicleId: 'veh-1' })).resolves.toMatchObject({ id: 'veh-1' });
  });
});
