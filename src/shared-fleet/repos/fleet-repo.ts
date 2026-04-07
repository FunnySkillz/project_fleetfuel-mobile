import { SharedFleetError } from '@/shared-fleet/errors';
import { getSharedSupabaseClient } from '@/shared-fleet/supabase/client';
import { invokeSharedFunction } from '@/shared-fleet/supabase/functions';
import type {
  Fleet,
  FleetMembership,
  FleetMembershipWithFleet,
  FleetMemberProfile,
  Profile,
} from '@/shared-fleet/types';

import type { FleetRepo } from './contracts';

type CreateFleetResponse = {
  fleet: {
    id: string;
    name: string;
    created_by_user_id: string;
    created_at: string;
    updated_at: string;
  };
};

function mapFleet(row: {
  id: string;
  name: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}): Fleet {
  return {
    id: row.id,
    name: row.name,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMembership(row: {
  id: string;
  fleet_id: string;
  user_id: string;
  role: FleetMembership['role'];
  invited_by_user_id: string | null;
  invitation_id: string | null;
  joined_at: string;
  ended_at: string | null;
  ended_by_user_id: string | null;
  deactivated_reason: string | null;
  role_updated_at: string | null;
  role_updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}): FleetMembership {
  return {
    id: row.id,
    fleetId: row.fleet_id,
    userId: row.user_id,
    role: row.role,
    invitedByUserId: row.invited_by_user_id,
    invitationId: row.invitation_id,
    joinedAt: row.joined_at,
    endedAt: row.ended_at,
    endedByUserId: row.ended_by_user_id,
    deactivatedReason: row.deactivated_reason,
    roleUpdatedAt: row.role_updated_at,
    roleUpdatedByUserId: row.role_updated_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProfile(row: {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}): Profile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireCurrentUserId() {
  const supabase = getSharedSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
  }

  const userId = data.user?.id;
  if (!userId) {
    throw new SharedFleetError('shared_auth_required', 'You must be signed in to access Shared Fleet.');
  }

  return userId;
}

export const fleetRepo: FleetRepo = {
  async createFleet(input) {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 80) {
      throw new SharedFleetError('shared_validation_error', 'Fleet name must be between 2 and 80 characters.');
    }

    const response = await invokeSharedFunction<CreateFleetResponse, { name: string }>('create-fleet', {
      name,
    });

    return mapFleet(response.fleet);
  },

  async loadCurrentUserFleets() {
    const userId = await requireCurrentUserId();
    const supabase = getSharedSupabaseClient();

    const { data: memberships, error: membershipsError } = await supabase
      .from('fleet_memberships')
      .select(
        'id, fleet_id, user_id, role, invited_by_user_id, invitation_id, joined_at, ended_at, ended_by_user_id, deactivated_reason, role_updated_at, role_updated_by_user_id, created_at, updated_at',
      )
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('joined_at', { ascending: true });

    if (membershipsError) {
      throw new SharedFleetError('shared_unknown_error', membershipsError.message, {
        cause: membershipsError,
        status: null,
      });
    }

    const membershipRows = (memberships ?? []) as {
      id: string;
      fleet_id: string;
      user_id: string;
      role: FleetMembership['role'];
      invited_by_user_id: string | null;
      invitation_id: string | null;
      joined_at: string;
      ended_at: string | null;
      ended_by_user_id: string | null;
      deactivated_reason: string | null;
      role_updated_at: string | null;
      role_updated_by_user_id: string | null;
      created_at: string;
      updated_at: string;
    }[];

    if (membershipRows.length === 0) {
      return [];
    }

    const fleetIds = Array.from(new Set(membershipRows.map((membership) => membership.fleet_id)));
    const { data: fleetsData, error: fleetsError } = await supabase
      .from('fleets')
      .select('id, name, created_by_user_id, created_at, updated_at')
      .in('id', fleetIds);

    if (fleetsError) {
      throw new SharedFleetError('shared_unknown_error', fleetsError.message, { cause: fleetsError, status: null });
    }

    const fleetMap = new Map(
      ((fleetsData ?? []) as {
        id: string;
        name: string;
        created_by_user_id: string;
        created_at: string;
        updated_at: string;
      }[]).map((fleet) => [fleet.id, mapFleet(fleet)]),
    );

    return membershipRows
      .map((membership): FleetMembershipWithFleet | null => {
        const fleet = fleetMap.get(membership.fleet_id) ?? null;
        if (!fleet) {
          return null;
        }

        return {
          ...mapMembership(membership),
          fleet,
        };
      })
      .filter((membership): membership is FleetMembershipWithFleet => membership !== null);
  },

  async loadFleetMembers(fleetId) {
    const normalizedFleetId = fleetId.trim();
    if (!normalizedFleetId) {
      throw new SharedFleetError('shared_validation_error', 'Fleet id is required.');
    }

    await requireCurrentUserId();
    const supabase = getSharedSupabaseClient();

    const { data: memberships, error: membershipsError } = await supabase
      .from('fleet_memberships')
      .select(
        'id, fleet_id, user_id, role, invited_by_user_id, invitation_id, joined_at, ended_at, ended_by_user_id, deactivated_reason, role_updated_at, role_updated_by_user_id, created_at, updated_at',
      )
      .eq('fleet_id', normalizedFleetId)
      .is('ended_at', null)
      .order('joined_at', { ascending: true });

    if (membershipsError) {
      throw new SharedFleetError('shared_unknown_error', membershipsError.message, {
        cause: membershipsError,
        status: null,
      });
    }

    const membershipRows = (memberships ?? []) as {
      id: string;
      fleet_id: string;
      user_id: string;
      role: FleetMembership['role'];
      invited_by_user_id: string | null;
      invitation_id: string | null;
      joined_at: string;
      ended_at: string | null;
      ended_by_user_id: string | null;
      deactivated_reason: string | null;
      role_updated_at: string | null;
      role_updated_by_user_id: string | null;
      created_at: string;
      updated_at: string;
    }[];

    if (membershipRows.length === 0) {
      return [];
    }

    const uniqueUserIds = Array.from(new Set(membershipRows.map((member) => member.user_id)));
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, display_name, created_at, updated_at')
      .in('id', uniqueUserIds);

    if (profilesError) {
      throw new SharedFleetError('shared_unknown_error', profilesError.message, {
        cause: profilesError,
        status: null,
      });
    }

    const profileMap = new Map(
      ((profiles ?? []) as {
        id: string;
        email: string;
        display_name: string | null;
        created_at: string;
        updated_at: string;
      }[]).map((row) => [row.id, mapProfile(row)]),
    );

    return membershipRows.map((membership) => ({
      ...mapMembership(membership),
      profile: profileMap.get(membership.user_id) ?? null,
    }));
  },

  async countDrivers(fleetId) {
    const normalizedFleetId = fleetId.trim();
    if (!normalizedFleetId) {
      throw new SharedFleetError('shared_validation_error', 'Fleet id is required.');
    }

    await requireCurrentUserId();
    const supabase = getSharedSupabaseClient();

    const { count, error } = await supabase
      .from('fleet_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('fleet_id', normalizedFleetId)
      .eq('role', 'driver')
      .is('ended_at', null);

    if (error) {
      throw new SharedFleetError('shared_unknown_error', error.message, { cause: error, status: null });
    }

    return count ?? 0;
  },

  async updateMembershipRole(input) {
    const membershipId = input.membershipId.trim();
    if (!membershipId) {
      throw new SharedFleetError('shared_validation_error', 'Membership id is required.');
    }

    const response = await invokeSharedFunction<
      {
        membership: {
          id: string;
          fleet_id: string;
          user_id: string;
          role: FleetMembership['role'];
          invited_by_user_id: string | null;
          invitation_id: string | null;
          joined_at: string;
          ended_at: string | null;
          ended_by_user_id: string | null;
          deactivated_reason: string | null;
          role_updated_at: string | null;
          role_updated_by_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
      },
      { membershipId: string; role: 'admin' | 'driver' }
    >('update-membership-role', {
      membershipId,
      role: input.role,
    });

    const membership = mapMembership(response.membership);
    const supabase = getSharedSupabaseClient();
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, display_name, created_at, updated_at')
      .eq('id', membership.userId)
      .maybeSingle();

    if (profileError) {
      throw new SharedFleetError('shared_unknown_error', profileError.message, { cause: profileError, status: null });
    }

    return {
      ...membership,
      profile: profileData
        ? mapProfile(profileData as {
            id: string;
            email: string;
            display_name: string | null;
            created_at: string;
            updated_at: string;
          })
        : null,
    } satisfies FleetMemberProfile;
  },

  async deactivateMembership(input) {
    const membershipId = input.membershipId.trim();
    const reason = input.reason?.trim() ?? '';

    if (!membershipId) {
      throw new SharedFleetError('shared_validation_error', 'Membership id is required.');
    }

    const response = await invokeSharedFunction<
      {
        membership: {
          id: string;
          fleet_id: string;
          user_id: string;
          role: FleetMembership['role'];
          invited_by_user_id: string | null;
          invitation_id: string | null;
          joined_at: string;
          ended_at: string | null;
          ended_by_user_id: string | null;
          deactivated_reason: string | null;
          role_updated_at: string | null;
          role_updated_by_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
      },
      { membershipId: string; reason?: string }
    >('deactivate-membership', reason ? { membershipId, reason } : { membershipId });

    const membership = mapMembership(response.membership);
    const supabase = getSharedSupabaseClient();
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, display_name, created_at, updated_at')
      .eq('id', membership.userId)
      .maybeSingle();

    if (profileError) {
      throw new SharedFleetError('shared_unknown_error', profileError.message, { cause: profileError, status: null });
    }

    return {
      ...membership,
      profile: profileData
        ? mapProfile(profileData as {
            id: string;
            email: string;
            display_name: string | null;
            created_at: string;
            updated_at: string;
          })
        : null,
    } satisfies FleetMemberProfile;
  },
};
