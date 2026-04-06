begin;

create extension if not exists pgcrypto;

DO $$
BEGIN
  CREATE TYPE public.membership_role AS ENUM ('owner', 'admin', 'driver');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  CREATE TYPE public.vehicle_status AS ENUM ('available', 'driving', 'blocked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  CREATE TYPE public.assignment_status AS ENUM ('pending', 'active', 'ended', 'rejected', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 80),
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id uuid NOT NULL REFERENCES public.fleets(id) ON DELETE RESTRICT,
  email text NOT NULL,
  role public.membership_role NOT NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  invited_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  accepted_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  accepted_at timestamptz,
  revoked_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fleet_invitations_email_not_empty CHECK (char_length(trim(email)) > 3),
  CONSTRAINT fleet_invitations_expiration_future CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS public.fleet_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id uuid NOT NULL REFERENCES public.fleets(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  role public.membership_role NOT NULL,
  invited_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  invitation_id uuid REFERENCES public.fleet_invitations(id) ON DELETE RESTRICT,
  joined_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ended_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fleet_memberships_timeline_check CHECK (ended_at IS NULL OR ended_at >= joined_at),
  CONSTRAINT fleet_memberships_id_fleet_user_unique UNIQUE (id, fleet_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id uuid NOT NULL REFERENCES public.fleets(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 80),
  plate text NOT NULL CHECK (char_length(trim(plate)) BETWEEN 2 AND 32),
  status public.vehicle_status NOT NULL DEFAULT 'available',
  blocked_until timestamptz,
  blocked_reason text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  updated_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicles_blocked_until_check CHECK (
    status <> 'blocked'
    OR blocked_until IS NULL
    OR blocked_until >= created_at
  ),
  CONSTRAINT vehicles_id_fleet_unique UNIQUE (id, fleet_id)
);

CREATE TABLE IF NOT EXISTS public.vehicle_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id uuid NOT NULL REFERENCES public.fleets(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL,
  driver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  driver_membership_id uuid NOT NULL,
  status public.assignment_status NOT NULL DEFAULT 'pending',
  requested_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ended_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz,
  ended_reason text,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_assignments_vehicle_fleet_fk FOREIGN KEY (vehicle_id, fleet_id)
    REFERENCES public.vehicles(id, fleet_id) ON DELETE RESTRICT,
  CONSTRAINT vehicle_assignments_membership_context_fk FOREIGN KEY (driver_membership_id, fleet_id, driver_user_id)
    REFERENCES public.fleet_memberships(id, fleet_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT vehicle_assignments_status_timeline_check CHECK (
    (status = 'pending' AND started_at IS NULL AND ended_at IS NULL)
    OR (status = 'active' AND started_at IS NOT NULL AND ended_at IS NULL)
    OR (status IN ('ended', 'rejected', 'cancelled') AND ended_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fleet_memberships_active_unique
  ON public.fleet_memberships (fleet_id, user_id)
  WHERE ended_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fleet_invitations_pending_unique
  ON public.fleet_invitations (fleet_id, lower(email), role)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_plate_active_unique
  ON public.vehicles (fleet_id, lower(plate))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_assignments_one_active_per_vehicle
  ON public.vehicle_assignments (vehicle_id)
  WHERE status = 'active' AND ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_fleets_created_by ON public.fleets (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_fleet_role_active
  ON public.fleet_memberships (fleet_id, role)
  WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_fleet_status ON public.fleet_invitations (fleet_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at_pending
  ON public.fleet_invitations (expires_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_vehicles_fleet_status
  ON public.vehicles (fleet_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_fleet_status
  ON public.vehicle_assignments (fleet_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_driver_status
  ON public.vehicle_assignments (driver_user_id, status, requested_at DESC);

DROP TRIGGER IF EXISTS touch_profiles_updated_at ON public.profiles;
CREATE TRIGGER touch_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_fleets_updated_at ON public.fleets;
CREATE TRIGGER touch_fleets_updated_at
BEFORE UPDATE ON public.fleets
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_fleet_invitations_updated_at ON public.fleet_invitations;
CREATE TRIGGER touch_fleet_invitations_updated_at
BEFORE UPDATE ON public.fleet_invitations
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_fleet_memberships_updated_at ON public.fleet_memberships;
CREATE TRIGGER touch_fleet_memberships_updated_at
BEFORE UPDATE ON public.fleet_memberships
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER touch_vehicles_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_vehicle_assignments_updated_at ON public.vehicle_assignments;
CREATE TRIGGER touch_vehicle_assignments_updated_at
BEFORE UPDATE ON public.vehicle_assignments
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, COALESCE(NEW.email, ''))
  ON CONFLICT (id)
  DO UPDATE SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_profile();

CREATE OR REPLACE FUNCTION public.shared_is_active_member(p_fleet_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fleet_memberships membership
    WHERE membership.fleet_id = p_fleet_id
      AND membership.user_id = p_user_id
      AND membership.ended_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.shared_member_role(p_fleet_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS public.membership_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT membership.role
  FROM public.fleet_memberships membership
  WHERE membership.fleet_id = p_fleet_id
    AND membership.user_id = p_user_id
    AND membership.ended_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.shared_can_manage_fleet(p_fleet_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.shared_member_role(p_fleet_id, p_user_id) IN ('owner', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.shared_is_owner(p_fleet_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.shared_member_role(p_fleet_id, p_user_id) = 'owner';
$$;

CREATE OR REPLACE FUNCTION public.shared_ensure_profile(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  SELECT u.email INTO user_email
  FROM auth.users u
  WHERE u.id = p_user_id
  LIMIT 1;

  IF user_email IS NULL THEN
    RAISE EXCEPTION 'not_found:user';
  END IF;

  INSERT INTO public.profiles (id, email)
  VALUES (p_user_id, user_email)
  ON CONFLICT (id)
  DO UPDATE SET email = EXCLUDED.email;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_expire_stale_invitations(p_fleet_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer;
BEGIN
  UPDATE public.fleet_invitations invitation
  SET status = 'expired',
      updated_at = now()
  WHERE invitation.status = 'pending'
    AND invitation.expires_at <= now()
    AND (p_fleet_id IS NULL OR invitation.fleet_id = p_fleet_id);

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_create_fleet_with_owner(p_name text, p_owner_user_id uuid)
RETURNS public.fleets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_name text;
  created_fleet public.fleets;
BEGIN
  normalized_name := regexp_replace(trim(p_name), '\s+', ' ', 'g');

  IF char_length(normalized_name) < 2 OR char_length(normalized_name) > 80 THEN
    RAISE EXCEPTION 'validation_error:fleet_name';
  END IF;

  PERFORM public.shared_ensure_profile(p_owner_user_id);

  INSERT INTO public.fleets (name, created_by_user_id)
  VALUES (normalized_name, p_owner_user_id)
  RETURNING * INTO created_fleet;

  INSERT INTO public.fleet_memberships (
    fleet_id,
    user_id,
    role,
    invited_by_user_id,
    invitation_id,
    joined_at,
    ended_at,
    ended_by_user_id
  )
  VALUES (
    created_fleet.id,
    p_owner_user_id,
    'owner',
    NULL,
    NULL,
    now(),
    NULL,
    NULL
  );

  RETURN created_fleet;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_create_invitation(
  p_fleet_id uuid,
  p_email text,
  p_role public.membership_role,
  p_invited_by_user_id uuid,
  p_token_hash text,
  p_expires_at timestamptz
)
RETURNS public.fleet_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email text;
  found_invitation public.fleet_invitations;
  existing_user_id uuid;
BEGIN
  normalized_email := lower(trim(p_email));

  IF normalized_email = '' OR position('@' in normalized_email) = 0 THEN
    RAISE EXCEPTION 'validation_error:email';
  END IF;

  IF p_role NOT IN ('admin', 'driver') THEN
    RAISE EXCEPTION 'validation_error:role';
  END IF;

  IF char_length(trim(p_token_hash)) < 32 THEN
    RAISE EXCEPTION 'validation_error:token';
  END IF;

  IF p_expires_at <= now() THEN
    RAISE EXCEPTION 'validation_error:expires_at';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.fleet_memberships membership
    WHERE membership.fleet_id = p_fleet_id
      AND membership.user_id = p_invited_by_user_id
      AND membership.ended_at IS NULL
      AND membership.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM public.shared_expire_stale_invitations(p_fleet_id);

  IF EXISTS (
    SELECT 1
    FROM public.fleet_invitations invitation
    WHERE invitation.fleet_id = p_fleet_id
      AND lower(invitation.email) = normalized_email
      AND invitation.role = p_role
      AND invitation.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'duplicate_invite';
  END IF;

  SELECT u.id INTO existing_user_id
  FROM auth.users u
  WHERE lower(u.email) = normalized_email
  LIMIT 1;

  IF existing_user_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.fleet_memberships membership
       WHERE membership.fleet_id = p_fleet_id
         AND membership.user_id = existing_user_id
         AND membership.ended_at IS NULL
     ) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  PERFORM public.shared_ensure_profile(p_invited_by_user_id);

  INSERT INTO public.fleet_invitations (
    fleet_id,
    email,
    role,
    status,
    token_hash,
    expires_at,
    invited_by_user_id,
    accepted_by_user_id,
    accepted_at,
    revoked_by_user_id,
    revoked_at
  )
  VALUES (
    p_fleet_id,
    normalized_email,
    p_role,
    'pending',
    p_token_hash,
    p_expires_at,
    p_invited_by_user_id,
    NULL,
    NULL,
    NULL,
    NULL
  )
  RETURNING * INTO found_invitation;

  RETURN found_invitation;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_accept_invitation(
  p_invitation_id uuid,
  p_token_hash text,
  p_user_id uuid,
  p_user_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record public.fleet_invitations;
  normalized_email text;
BEGIN
  normalized_email := lower(trim(p_user_email));

  IF normalized_email = '' OR position('@' in normalized_email) = 0 THEN
    RAISE EXCEPTION 'validation_error:user_email';
  END IF;

  SELECT * INTO invitation_record
  FROM public.fleet_invitations invitation
  WHERE invitation.id = p_invitation_id
  FOR UPDATE;

  IF invitation_record.id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  PERFORM public.shared_ensure_profile(p_user_id);

  IF invitation_record.status = 'pending' AND invitation_record.expires_at <= now() THEN
    UPDATE public.fleet_invitations
    SET status = 'expired'
    WHERE id = invitation_record.id;

    RAISE EXCEPTION 'invite_expired';
  END IF;

  IF invitation_record.status = 'revoked' THEN
    RAISE EXCEPTION 'invite_revoked';
  END IF;

  IF invitation_record.status = 'expired' THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  IF invitation_record.status = 'accepted' THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  IF invitation_record.token_hash <> p_token_hash THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF lower(invitation_record.email) <> normalized_email THEN
    RAISE EXCEPTION 'email_mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.fleet_memberships membership
    WHERE membership.fleet_id = invitation_record.fleet_id
      AND membership.user_id = p_user_id
      AND membership.ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  INSERT INTO public.fleet_memberships (
    fleet_id,
    user_id,
    role,
    invited_by_user_id,
    invitation_id,
    joined_at,
    ended_at,
    ended_by_user_id
  )
  VALUES (
    invitation_record.fleet_id,
    p_user_id,
    invitation_record.role,
    invitation_record.invited_by_user_id,
    invitation_record.id,
    now(),
    NULL,
    NULL
  );

  UPDATE public.fleet_invitations
  SET status = 'accepted',
      accepted_by_user_id = p_user_id,
      accepted_at = now(),
      updated_at = now()
  WHERE id = invitation_record.id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_revoke_invitation(
  p_invitation_id uuid,
  p_actor_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record public.fleet_invitations;
BEGIN
  SELECT * INTO invitation_record
  FROM public.fleet_invitations invitation
  WHERE invitation.id = p_invitation_id
  FOR UPDATE;

  IF invitation_record.id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.fleet_memberships membership
    WHERE membership.fleet_id = invitation_record.fleet_id
      AND membership.user_id = p_actor_user_id
      AND membership.ended_at IS NULL
      AND membership.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF invitation_record.status = 'revoked' THEN
    RETURN true;
  END IF;

  IF invitation_record.status <> 'pending' THEN
    RAISE EXCEPTION 'validation_error:invite_state';
  END IF;

  IF invitation_record.expires_at <= now() THEN
    UPDATE public.fleet_invitations
    SET status = 'expired',
        updated_at = now()
    WHERE id = invitation_record.id;

    RAISE EXCEPTION 'invite_expired';
  END IF;

  UPDATE public.fleet_invitations
  SET status = 'revoked',
      revoked_by_user_id = p_actor_user_id,
      revoked_at = now(),
      updated_at = now()
  WHERE id = invitation_record.id;

  RETURN true;
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_self_or_shared_fleet ON public.profiles;
CREATE POLICY profiles_select_self_or_shared_fleet
  ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.fleet_memberships my_membership
      JOIN public.fleet_memberships target_membership
        ON target_membership.fleet_id = my_membership.fleet_id
       AND target_membership.user_id = profiles.id
       AND target_membership.ended_at IS NULL
      WHERE my_membership.user_id = auth.uid()
        AND my_membership.ended_at IS NULL
    )
  );

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS fleets_select_member ON public.fleets;
CREATE POLICY fleets_select_member
  ON public.fleets
  FOR SELECT
  USING (public.shared_is_active_member(id));

DROP POLICY IF EXISTS fleets_insert_creator ON public.fleets;
CREATE POLICY fleets_insert_creator
  ON public.fleets
  FOR INSERT
  WITH CHECK (created_by_user_id = auth.uid());

DROP POLICY IF EXISTS fleets_update_managers ON public.fleets;
CREATE POLICY fleets_update_managers
  ON public.fleets
  FOR UPDATE
  USING (public.shared_can_manage_fleet(id))
  WITH CHECK (public.shared_can_manage_fleet(id));

DROP POLICY IF EXISTS memberships_select_member ON public.fleet_memberships;
CREATE POLICY memberships_select_member
  ON public.fleet_memberships
  FOR SELECT
  USING (public.shared_is_active_member(fleet_id));

DROP POLICY IF EXISTS memberships_update_owner_only ON public.fleet_memberships;
CREATE POLICY memberships_update_owner_only
  ON public.fleet_memberships
  FOR UPDATE
  USING (public.shared_is_owner(fleet_id))
  WITH CHECK (public.shared_is_owner(fleet_id));

DROP POLICY IF EXISTS invitations_select_manager ON public.fleet_invitations;
CREATE POLICY invitations_select_manager
  ON public.fleet_invitations
  FOR SELECT
  USING (public.shared_can_manage_fleet(fleet_id));

DROP POLICY IF EXISTS vehicles_select_member ON public.vehicles;
CREATE POLICY vehicles_select_member
  ON public.vehicles
  FOR SELECT
  USING (public.shared_is_active_member(fleet_id));

DROP POLICY IF EXISTS vehicles_insert_manager ON public.vehicles;
CREATE POLICY vehicles_insert_manager
  ON public.vehicles
  FOR INSERT
  WITH CHECK (public.shared_can_manage_fleet(fleet_id));

DROP POLICY IF EXISTS vehicles_update_manager ON public.vehicles;
CREATE POLICY vehicles_update_manager
  ON public.vehicles
  FOR UPDATE
  USING (public.shared_can_manage_fleet(fleet_id))
  WITH CHECK (public.shared_can_manage_fleet(fleet_id));

DROP POLICY IF EXISTS assignments_select_member ON public.vehicle_assignments;
CREATE POLICY assignments_select_member
  ON public.vehicle_assignments
  FOR SELECT
  USING (public.shared_is_active_member(fleet_id));

DROP POLICY IF EXISTS assignments_insert_manager_or_driver_request ON public.vehicle_assignments;
CREATE POLICY assignments_insert_manager_or_driver_request
  ON public.vehicle_assignments
  FOR INSERT
  WITH CHECK (
    public.shared_can_manage_fleet(fleet_id)
    OR (
      status = 'pending'
      AND driver_user_id = auth.uid()
      AND public.shared_is_active_member(fleet_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS assignments_update_manager ON public.vehicle_assignments;
CREATE POLICY assignments_update_manager
  ON public.vehicle_assignments
  FOR UPDATE
  USING (public.shared_can_manage_fleet(fleet_id))
  WITH CHECK (public.shared_can_manage_fleet(fleet_id));

REVOKE ALL ON FUNCTION public.shared_create_fleet_with_owner(text, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_create_invitation(uuid, text, public.membership_role, uuid, text, timestamptz) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_accept_invitation(uuid, text, uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_revoke_invitation(uuid, uuid) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.shared_create_fleet_with_owner(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_create_invitation(uuid, text, public.membership_role, uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_accept_invitation(uuid, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_revoke_invitation(uuid, uuid) TO service_role;

commit;
