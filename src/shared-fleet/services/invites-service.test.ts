import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SharedFleetError } from '@/shared-fleet/errors';
import { createInvite, acceptInvite, loadFleetInvitations, revokeInvite } from '@/shared-fleet/services/invites-service';

const { invitesRepoMock } = vi.hoisted(() => ({
  invitesRepoMock: {
    createInvite: vi.fn(),
    acceptInvite: vi.fn(),
    revokeInvite: vi.fn(),
    loadFleetInvitations: vi.fn(),
  },
}));

vi.mock('@/shared-fleet/repos', () => ({
  invitesRepo: invitesRepoMock,
}));

describe('invites service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates invitations through the repo', async () => {
    invitesRepoMock.createInvite.mockResolvedValueOnce({ id: 'inv-1' });

    const result = await createInvite({
      fleetId: 'fleet-1',
      email: 'driver@example.com',
      role: 'driver',
    });

    expect(invitesRepoMock.createInvite).toHaveBeenCalledWith({
      fleetId: 'fleet-1',
      email: 'driver@example.com',
      role: 'driver',
    });
    expect(result).toEqual({ id: 'inv-1' });
  });

  it('propagates duplicate invite errors', async () => {
    invitesRepoMock.createInvite.mockRejectedValueOnce(
      new SharedFleetError('shared_duplicate_invite', 'A pending invitation already exists.'),
    );

    await expect(
      createInvite({
        fleetId: 'fleet-1',
        email: 'driver@example.com',
        role: 'driver',
      }),
    ).rejects.toMatchObject({ code: 'shared_duplicate_invite' });
  });

  it('accepts invitation via repo', async () => {
    invitesRepoMock.acceptInvite.mockResolvedValueOnce({ membershipCreated: true });

    const result = await acceptInvite({ invitationId: 'inv-1', token: 'token' });

    expect(result).toEqual({ membershipCreated: true });
    expect(invitesRepoMock.acceptInvite).toHaveBeenCalledWith({ invitationId: 'inv-1', token: 'token' });
  });

  it('loads fleet invitations via repo', async () => {
    invitesRepoMock.loadFleetInvitations.mockResolvedValueOnce([{ id: 'inv-2' }]);

    const result = await loadFleetInvitations({ fleetId: 'fleet-1' });

    expect(result).toEqual([{ id: 'inv-2' }]);
    expect(invitesRepoMock.loadFleetInvitations).toHaveBeenCalledWith('fleet-1');
  });

  it('revokes invitation via repo', async () => {
    invitesRepoMock.revokeInvite.mockResolvedValueOnce(undefined);

    await revokeInvite({ invitationId: 'inv-1' });

    expect(invitesRepoMock.revokeInvite).toHaveBeenCalledWith({ invitationId: 'inv-1' });
  });
});
