import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SharedFleetError } from '@/shared-fleet/errors';
import {
  approveAssignment,
  blockVehicle,
  cancelAssignment,
  directAssignVehicle,
  endAssignment,
  getFleetAssignmentHistory,
  getFleetPendingAssignmentRequests,
  getVehicleCurrentAssignment,
  getVehicleTimeline,
  rejectAssignment,
  requestAssignment,
  unblockVehicle,
} from '@/shared-fleet/services/assignment-service';

const { assignmentRepoMock } = vi.hoisted(() => ({
  assignmentRepoMock: {
    requestAssignment: vi.fn(),
    approveAssignment: vi.fn(),
    rejectAssignment: vi.fn(),
    cancelAssignment: vi.fn(),
    directAssign: vi.fn(),
    endAssignment: vi.fn(),
    blockVehicle: vi.fn(),
    unblockVehicle: vi.fn(),
    getVehicleCurrentAssignment: vi.fn(),
    getFleetPendingAssignmentRequests: vi.fn(),
    getVehicleTimeline: vi.fn(),
    getFleetAssignmentHistory: vi.fn(),
  },
}));

vi.mock('@/shared-fleet/repos', () => ({
  assignmentRepo: assignmentRepoMock,
}));

describe('assignment service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('supports driver request flow', async () => {
    assignmentRepoMock.requestAssignment.mockResolvedValueOnce({ id: 'req-1', status: 'pending' });

    const result = await requestAssignment({ fleetId: 'fleet-1', vehicleId: 'veh-1' });

    expect(result).toEqual({ id: 'req-1', status: 'pending' });
    expect(assignmentRepoMock.requestAssignment).toHaveBeenCalledWith({ fleetId: 'fleet-1', vehicleId: 'veh-1' });
  });

  it('supports owner/admin approval flow', async () => {
    assignmentRepoMock.approveAssignment.mockResolvedValueOnce({ id: 'req-1', status: 'active' });

    const result = await approveAssignment({ assignmentId: 'req-1' });

    expect(result).toEqual({ id: 'req-1', status: 'active' });
    expect(assignmentRepoMock.approveAssignment).toHaveBeenCalledWith({ assignmentId: 'req-1' });
  });

  it('supports direct assignment flow', async () => {
    assignmentRepoMock.directAssign.mockResolvedValueOnce({ id: 'assign-1', status: 'active' });

    const result = await directAssignVehicle({ fleetId: 'fleet-1', vehicleId: 'veh-1', driverMembershipId: 'mem-1' });

    expect(result).toEqual({ id: 'assign-1', status: 'active' });
    expect(assignmentRepoMock.directAssign).toHaveBeenCalledWith({
      fleetId: 'fleet-1',
      vehicleId: 'veh-1',
      driverMembershipId: 'mem-1',
    });
  });

  it('supports reject and cancel flows', async () => {
    assignmentRepoMock.rejectAssignment.mockResolvedValueOnce({ id: 'req-1', status: 'rejected' });
    assignmentRepoMock.cancelAssignment.mockResolvedValueOnce({ id: 'req-2', status: 'cancelled' });

    await expect(rejectAssignment({ assignmentId: 'req-1', reason: 'No availability' })).resolves.toMatchObject({
      status: 'rejected',
    });
    await expect(cancelAssignment({ assignmentId: 'req-2', reason: 'No longer needed' })).resolves.toMatchObject({
      status: 'cancelled',
    });
  });

  it('supports ending assignments and vehicle block lifecycle', async () => {
    assignmentRepoMock.endAssignment.mockResolvedValueOnce({ id: 'a-1', status: 'ended', endReason: 'driver_ended' });
    assignmentRepoMock.blockVehicle.mockResolvedValueOnce({ id: 'veh-1', status: 'blocked' });
    assignmentRepoMock.unblockVehicle.mockResolvedValueOnce({ id: 'veh-1', status: 'available' });

    await expect(endAssignment({ assignmentId: 'a-1', endReason: 'driver_ended' })).resolves.toMatchObject({
      status: 'ended',
    });
    await expect(
      blockVehicle({
        fleetId: 'fleet-1',
        vehicleId: 'veh-1',
        blockedUntil: new Date().toISOString(),
        blockedReason: 'Maintenance',
      }),
    ).resolves.toMatchObject({ status: 'blocked' });
    await expect(unblockVehicle({ fleetId: 'fleet-1', vehicleId: 'veh-1' })).resolves.toMatchObject({
      status: 'available',
    });
  });

  it('propagates blocked/conflict transition errors', async () => {
    assignmentRepoMock.approveAssignment.mockRejectedValueOnce(
      new SharedFleetError('shared_vehicle_blocked', 'Vehicle is blocked.'),
    );
    assignmentRepoMock.directAssign.mockRejectedValueOnce(
      new SharedFleetError('shared_assignment_conflict', 'Vehicle already has active assignment.'),
    );

    await expect(approveAssignment({ assignmentId: 'req-1' })).rejects.toMatchObject({
      code: 'shared_vehicle_blocked',
    });
    await expect(
      directAssignVehicle({ fleetId: 'fleet-1', vehicleId: 'veh-1', driverMembershipId: 'mem-1' }),
    ).rejects.toMatchObject({
      code: 'shared_assignment_conflict',
    });
  });

  it('loads pending requests, current assignment, timeline, and fleet history', async () => {
    assignmentRepoMock.getVehicleCurrentAssignment.mockResolvedValueOnce({ id: 'active-1' });
    assignmentRepoMock.getFleetPendingAssignmentRequests.mockResolvedValueOnce([{ id: 'req-1' }]);
    assignmentRepoMock.getVehicleTimeline.mockResolvedValueOnce([{ id: 'timeline-1' }]);
    assignmentRepoMock.getFleetAssignmentHistory.mockResolvedValueOnce([{ id: 'hist-1' }]);

    await expect(getVehicleCurrentAssignment({ fleetId: 'fleet-1', vehicleId: 'veh-1' })).resolves.toEqual({ id: 'active-1' });
    await expect(getFleetPendingAssignmentRequests({ fleetId: 'fleet-1' })).resolves.toEqual([{ id: 'req-1' }]);
    await expect(getVehicleTimeline({ fleetId: 'fleet-1', vehicleId: 'veh-1' })).resolves.toEqual([{ id: 'timeline-1' }]);
    await expect(getFleetAssignmentHistory({ fleetId: 'fleet-1' })).resolves.toEqual([{ id: 'hist-1' }]);
  });
});
