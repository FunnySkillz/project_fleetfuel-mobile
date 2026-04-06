import { SharedFleetError } from '@/shared-fleet/errors';
import { getSharedSupabaseClient } from '@/shared-fleet/supabase/client';
import { invokeSharedFunction } from '@/shared-fleet/supabase/functions';
import type { FleetInvitation } from '@/shared-fleet/types';

import type { InvitesRepo } from './contracts';

type CreateInviteResponse = {
  invitation: {
    id: string;
    fleet_id: string;
    email: string;
    role: FleetInvitation['role'];
    status: FleetInvitation['status'];
    expires_at: string;
    invited_by_user_id: string;
    accepted_by_user_id: string | null;
    accepted_at: string | null;
    revoked_by_user_id: string | null;
    revoked_at: string | null;
    created_at: string;
    updated_at: string;
  };
};

type AcceptInviteResponse = {
  membership_created: boolean;
};

function mapInvitation(row: {
  id: string;
  fleet_id: string;
  email: string;
  role: FleetInvitation['role'];
  status: FleetInvitation['status'];
  expires_at: string;
  invited_by_user_id: string;
  accepted_by_user_id: string | null;
  accepted_at: string | null;
  revoked_by_user_id: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}): FleetInvitation {
  return {
    id: row.id,
    fleetId: row.fleet_id,
    email: row.email,
    role: row.role,
    status: row.status,
    expiresAt: row.expires_at,
    invitedByUserId: row.invited_by_user_id,
    acceptedByUserId: row.accepted_by_user_id,
    acceptedAt: row.accepted_at,
    revokedByUserId: row.revoked_by_user_id,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export const invitesRepo: InvitesRepo = {
  async createInvite(input) {
    const fleetId = input.fleetId.trim();
    const email = normalizeEmail(input.email);

    if (!fleetId) {
      throw new SharedFleetError('shared_validation_error', 'Fleet id is required.');
    }

    if (!email || !email.includes('@')) {
      throw new SharedFleetError('shared_validation_error', 'Please enter a valid email address.');
    }

    const response = await invokeSharedFunction<CreateInviteResponse, { fleetId: string; email: string; role: FleetInvitation['role'] }>(
      'create-invite',
      {
        fleetId,
        email,
        role: input.role,
      },
    );

    return mapInvitation(response.invitation);
  },

  async acceptInvite(input) {
    const invitationId = input.invitationId.trim();
    const token = input.token.trim();

    if (!invitationId || !token) {
      throw new SharedFleetError('shared_validation_error', 'Invitation id and token are required.');
    }

    const response = await invokeSharedFunction<AcceptInviteResponse, { invitationId: string; token: string }>('accept-invite', {
      invitationId,
      token,
    });

    return {
      membershipCreated: response.membership_created,
    };
  },

  async revokeInvite(input) {
    const invitationId = input.invitationId.trim();
    if (!invitationId) {
      throw new SharedFleetError('shared_validation_error', 'Invitation id is required.');
    }

    await invokeSharedFunction<{ ok: true }, { invitationId: string }>('revoke-invite', {
      invitationId,
    });
  },

  async loadFleetInvitations(fleetId) {
    const normalizedFleetId = fleetId.trim();
    if (!normalizedFleetId) {
      throw new SharedFleetError('shared_validation_error', 'Fleet id is required.');
    }

    const supabase = getSharedSupabaseClient();
    const { data, error } = await supabase
      .from('fleet_invitations')
      .select(
        'id, fleet_id, email, role, status, expires_at, invited_by_user_id, accepted_by_user_id, accepted_at, revoked_by_user_id, revoked_at, created_at, updated_at',
      )
      .eq('fleet_id', normalizedFleetId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
    }

    return ((data ?? []) as {
      id: string;
      fleet_id: string;
      email: string;
      role: FleetInvitation['role'];
      status: FleetInvitation['status'];
      expires_at: string;
      invited_by_user_id: string;
      accepted_by_user_id: string | null;
      accepted_at: string | null;
      revoked_by_user_id: string | null;
      revoked_at: string | null;
      created_at: string;
      updated_at: string;
    }[]).map(mapInvitation);
  },
};
