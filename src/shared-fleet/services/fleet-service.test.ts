import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  countFleetDrivers,
  createFleet,
  deactivateFleetMembership,
  loadCurrentUserFleets,
  loadFleetMembers,
  updateFleetMembershipRole,
} from '@/shared-fleet/services/fleet-service';

const { fleetRepoMock } = vi.hoisted(() => ({
  fleetRepoMock: {
    createFleet: vi.fn(),
    loadCurrentUserFleets: vi.fn(),
    loadFleetMembers: vi.fn(),
    countDrivers: vi.fn(),
    updateMembershipRole: vi.fn(),
    deactivateMembership: vi.fn(),
  },
}));

vi.mock('@/shared-fleet/repos', () => ({
  fleetRepo: fleetRepoMock,
}));

describe('fleet service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates fleet through repo', async () => {
    fleetRepoMock.createFleet.mockResolvedValueOnce({ id: 'fleet-1', name: 'Fleet 1' });

    const result = await createFleet({ name: 'Fleet 1' });

    expect(result).toEqual({ id: 'fleet-1', name: 'Fleet 1' });
    expect(fleetRepoMock.createFleet).toHaveBeenCalledWith({ name: 'Fleet 1' });
  });

  it('loads current user fleets', async () => {
    fleetRepoMock.loadCurrentUserFleets.mockResolvedValueOnce([{ id: 'membership-1' }]);

    const result = await loadCurrentUserFleets();

    expect(result).toEqual([{ id: 'membership-1' }]);
  });

  it('loads fleet members', async () => {
    fleetRepoMock.loadFleetMembers.mockResolvedValueOnce([{ id: 'member-1' }]);

    const result = await loadFleetMembers({ fleetId: 'fleet-1' });

    expect(result).toEqual([{ id: 'member-1' }]);
    expect(fleetRepoMock.loadFleetMembers).toHaveBeenCalledWith('fleet-1');
  });

  it('counts drivers for shared dashboard metrics', async () => {
    fleetRepoMock.countDrivers.mockResolvedValueOnce(5);

    const count = await countFleetDrivers({ fleetId: 'fleet-1' });

    expect(count).toBe(5);
    expect(fleetRepoMock.countDrivers).toHaveBeenCalledWith('fleet-1');
  });

  it('updates and deactivates memberships via fleet admin service methods', async () => {
    fleetRepoMock.updateMembershipRole.mockResolvedValueOnce({ id: 'member-1', role: 'admin' });
    fleetRepoMock.deactivateMembership.mockResolvedValueOnce({ id: 'member-1', endedAt: '2026-04-07T12:00:00.000Z' });

    await expect(updateFleetMembershipRole({ membershipId: 'member-1', role: 'admin' })).resolves.toMatchObject({
      id: 'member-1',
      role: 'admin',
    });
    await expect(
      deactivateFleetMembership({ membershipId: 'member-1', reason: 'Policy violation' }),
    ).resolves.toMatchObject({ id: 'member-1' });
  });
});
