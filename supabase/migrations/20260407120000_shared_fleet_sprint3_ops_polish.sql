begin;

create extension if not exists pgcrypto;

DO $$
BEGIN
  CREATE TYPE public.notification_event_type AS ENUM (
    'fleet_created',
    'invitation_sent',
    'invitation_accepted',
    'invitation_revoked',
    'vehicle_created',
    'vehicle_updated',
    'vehicle_request_submitted',
    'assignment_approved',
    'assignment_rejected',
    'assignment_cancelled',
    'direct_assignment_created',
    'assignment_ended',
    'vehicle_blocked',
    'vehicle_unblocked',
    'vehicle_archived',
    'vehicle_unarchived',
    'membership_role_changed',
    'membership_deactivated'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TYPE public.assignment_end_reason ADD VALUE IF NOT EXISTS 'archived';

ALTER TABLE public.fleet_memberships
  ADD COLUMN IF NOT EXISTS deactivated_reason text,
  ADD COLUMN IF NOT EXISTS role_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS role_updated_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS archive_reason text;

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_archive_consistency_check;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_archive_consistency_check CHECK (
    (
      archived_at IS NULL
      AND archived_by_user_id IS NULL
      AND archive_reason IS NULL
    )
    OR
    (
      archived_at IS NOT NULL
      AND archived_by_user_id IS NOT NULL
    )
  );

DROP INDEX IF EXISTS idx_vehicles_plate_active_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_plate_active_unique
  ON public.vehicles (fleet_id, lower(plate))
  WHERE deleted_at IS NULL AND archived_at IS NULL;

DROP INDEX IF EXISTS idx_vehicles_fleet_status;
CREATE INDEX IF NOT EXISTS idx_vehicles_fleet_status
  ON public.vehicles (fleet_id, status)
  WHERE deleted_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_fleet_archived
  ON public.vehicles (fleet_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.fleet_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id uuid NOT NULL REFERENCES public.fleets(id) ON DELETE RESTRICT,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_type public.notification_event_type NOT NULL,
  entity_type text NOT NULL CHECK (char_length(trim(entity_type)) BETWEEN 2 AND 64),
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  dedupe_key text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fleet_notifications_read_consistency CHECK (
    (is_read = false AND read_at IS NULL)
    OR (is_read = true AND read_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.fleet_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id uuid NOT NULL REFERENCES public.fleets(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  actor_membership_id uuid REFERENCES public.fleet_memberships(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (char_length(trim(event_type)) BETWEEN 3 AND 96),
  entity_type text NOT NULL CHECK (char_length(trim(entity_type)) BETWEEN 2 AND 64),
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fleet_notifications_dedupe
  ON public.fleet_notifications (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fleet_notifications_recipient_unread
  ON public.fleet_notifications (recipient_user_id, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_fleet_notifications_fleet_created
  ON public.fleet_notifications (fleet_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fleet_audit_idempotency
  ON public.fleet_audit_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fleet_audit_fleet_created
  ON public.fleet_audit_logs (fleet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fleet_audit_fleet_event_created
  ON public.fleet_audit_logs (fleet_id, event_type, created_at DESC);

ALTER TABLE public.fleet_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.shared_fleet_recipient_user_ids(
  p_fleet_id uuid,
  p_roles public.membership_role[] DEFAULT ARRAY['owner', 'admin', 'driver']::public.membership_role[]
)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT membership.user_id), ARRAY[]::uuid[])
  FROM public.fleet_memberships membership
  WHERE membership.fleet_id = p_fleet_id
    AND membership.ended_at IS NULL
    AND (
      p_roles IS NULL
      OR array_length(p_roles, 1) IS NULL
      OR membership.role = ANY(p_roles)
    );
$$;

CREATE OR REPLACE FUNCTION public.shared_active_membership_id(
  p_fleet_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT membership.id
  FROM public.fleet_memberships membership
  WHERE membership.fleet_id = p_fleet_id
    AND membership.user_id = p_user_id
    AND membership.ended_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.shared_write_audit_log(
  p_fleet_id uuid,
  p_actor_user_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_id uuid;
  actor_membership uuid;
BEGIN
  actor_membership := CASE
    WHEN p_actor_user_id IS NULL THEN NULL
    ELSE public.shared_active_membership_id(p_fleet_id, p_actor_user_id)
  END;

  INSERT INTO public.fleet_audit_logs (
    fleet_id,
    actor_user_id,
    actor_membership_id,
    event_type,
    entity_type,
    entity_id,
    payload,
    idempotency_key
  )
  VALUES (
    p_fleet_id,
    p_actor_user_id,
    actor_membership,
    p_event_type,
    p_entity_type,
    p_entity_id,
    COALESCE(p_payload, '{}'::jsonb),
    p_idempotency_key
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL AND p_idempotency_key IS NOT NULL THEN
    SELECT audit.id INTO inserted_id
    FROM public.fleet_audit_logs audit
    WHERE audit.idempotency_key = p_idempotency_key
    LIMIT 1;
  END IF;

  RETURN inserted_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_emit_notifications(
  p_fleet_id uuid,
  p_event_type public.notification_event_type,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_actor_user_id uuid DEFAULT NULL,
  p_recipient_user_ids uuid[] DEFAULT NULL,
  p_dedupe_scope text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_ids uuid[];
  recipient_id uuid;
  emitted_count integer := 0;
  next_dedupe_key text;
BEGIN
  recipient_ids := COALESCE(
    p_recipient_user_ids,
    public.shared_fleet_recipient_user_ids(p_fleet_id, ARRAY['owner', 'admin', 'driver']::public.membership_role[])
  );

  IF recipient_ids IS NULL OR array_length(recipient_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  FOREACH recipient_id IN ARRAY recipient_ids LOOP
    IF recipient_id IS NULL THEN
      CONTINUE;
    END IF;

    next_dedupe_key := CASE
      WHEN p_dedupe_scope IS NULL THEN NULL
      ELSE p_dedupe_scope || ':' || recipient_id::text
    END;

    INSERT INTO public.fleet_notifications (
      fleet_id,
      recipient_user_id,
      event_type,
      entity_type,
      entity_id,
      payload,
      created_by_user_id,
      dedupe_key
    )
    VALUES (
      p_fleet_id,
      recipient_id,
      p_event_type,
      p_entity_type,
      p_entity_id,
      COALESCE(p_payload, '{}'::jsonb),
      p_actor_user_id,
      next_dedupe_key
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL
    DO NOTHING;

    IF FOUND THEN
      emitted_count := emitted_count + 1;
    END IF;
  END LOOP;

  RETURN emitted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_is_vehicle_archived(p_vehicle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vehicles vehicle
    WHERE vehicle.id = p_vehicle_id
      AND vehicle.deleted_at IS NULL
      AND vehicle.archived_at IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.shared_request_assignment(
  p_fleet_id uuid,
  p_vehicle_id uuid,
  p_actor_user_id uuid
)
RETURNS public.vehicle_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_membership public.fleet_memberships;
  vehicle_record public.vehicles;
  created_assignment public.vehicle_assignments;
BEGIN
  actor_membership := public.shared_require_active_membership(p_fleet_id, p_actor_user_id);

  IF actor_membership.role <> 'driver' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO vehicle_record
  FROM public.vehicles vehicle
  WHERE vehicle.id = p_vehicle_id
    AND vehicle.fleet_id = p_fleet_id
    AND vehicle.deleted_at IS NULL
  FOR UPDATE;

  IF vehicle_record.id IS NULL THEN
    RAISE EXCEPTION 'not_found:vehicle';
  END IF;

  IF vehicle_record.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'vehicle_archived';
  END IF;

  IF public.shared_is_vehicle_blocked(p_vehicle_id) THEN
    RAISE EXCEPTION 'vehicle_blocked';
  END IF;

  BEGIN
    INSERT INTO public.vehicle_assignments (
      fleet_id,
      vehicle_id,
      driver_user_id,
      driver_membership_id,
      status,
      requested_by_user_id,
      approved_by_user_id,
      ended_by_user_id,
      requested_at,
      started_at,
      ended_at,
      end_reason,
      rejected_by_user_id,
      rejected_at,
      rejected_reason,
      cancelled_by_user_id,
      cancelled_at,
      cancelled_reason
    )
    VALUES (
      p_fleet_id,
      p_vehicle_id,
      p_actor_user_id,
      actor_membership.id,
      'pending',
      p_actor_user_id,
      NULL,
      NULL,
      now(),
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL
    )
    RETURNING * INTO created_assignment;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'duplicate_request';
  END;

  RETURN created_assignment;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_approve_assignment(
  p_assignment_id uuid,
  p_actor_user_id uuid
)
RETURNS public.vehicle_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignment_record public.vehicle_assignments;
  active_conflict uuid;
  updated_assignment public.vehicle_assignments;
BEGIN
  SELECT * INTO assignment_record
  FROM public.vehicle_assignments assignment
  WHERE assignment.id = p_assignment_id
  FOR UPDATE;

  IF assignment_record.id IS NULL THEN
    RAISE EXCEPTION 'assignment_not_found';
  END IF;

  IF NOT public.shared_can_manage_fleet(assignment_record.fleet_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF assignment_record.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_transition';
  END IF;

  IF public.shared_is_vehicle_archived(assignment_record.vehicle_id) THEN
    RAISE EXCEPTION 'vehicle_archived';
  END IF;

  IF public.shared_is_vehicle_blocked(assignment_record.vehicle_id) THEN
    RAISE EXCEPTION 'vehicle_blocked';
  END IF;

  SELECT assignment.id INTO active_conflict
  FROM public.vehicle_assignments assignment
  WHERE assignment.vehicle_id = assignment_record.vehicle_id
    AND assignment.status = 'active'
    AND assignment.ended_at IS NULL
    AND assignment.id <> assignment_record.id
  LIMIT 1;

  IF active_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'assignment_conflict';
  END IF;

  BEGIN
    UPDATE public.vehicle_assignments
    SET status = 'active',
        approved_by_user_id = p_actor_user_id,
        started_at = now(),
        updated_at = now()
    WHERE id = assignment_record.id
    RETURNING * INTO updated_assignment;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'assignment_conflict';
  END;

  PERFORM public.shared_sync_vehicle_status(assignment_record.vehicle_id, p_actor_user_id);

  RETURN updated_assignment;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_direct_assign(
  p_fleet_id uuid,
  p_vehicle_id uuid,
  p_driver_membership_id uuid,
  p_actor_user_id uuid
)
RETURNS public.vehicle_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vehicle_record public.vehicles;
  driver_membership public.fleet_memberships;
  created_assignment public.vehicle_assignments;
BEGIN
  IF NOT public.shared_can_manage_fleet(p_fleet_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO vehicle_record
  FROM public.vehicles vehicle
  WHERE vehicle.id = p_vehicle_id
    AND vehicle.fleet_id = p_fleet_id
    AND vehicle.deleted_at IS NULL
  FOR UPDATE;

  IF vehicle_record.id IS NULL THEN
    RAISE EXCEPTION 'not_found:vehicle';
  END IF;

  IF vehicle_record.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'vehicle_archived';
  END IF;

  IF public.shared_is_vehicle_blocked(p_vehicle_id) THEN
    RAISE EXCEPTION 'vehicle_blocked';
  END IF;

  SELECT * INTO driver_membership
  FROM public.fleet_memberships membership
  WHERE membership.id = p_driver_membership_id
    AND membership.fleet_id = p_fleet_id
    AND membership.ended_at IS NULL
  LIMIT 1;

  IF driver_membership.id IS NULL OR driver_membership.role <> 'driver' THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  BEGIN
    INSERT INTO public.vehicle_assignments (
      fleet_id,
      vehicle_id,
      driver_user_id,
      driver_membership_id,
      status,
      requested_by_user_id,
      approved_by_user_id,
      ended_by_user_id,
      requested_at,
      started_at,
      ended_at,
      end_reason,
      rejected_by_user_id,
      rejected_at,
      rejected_reason,
      cancelled_by_user_id,
      cancelled_at,
      cancelled_reason
    )
    VALUES (
      p_fleet_id,
      p_vehicle_id,
      driver_membership.user_id,
      driver_membership.id,
      'active',
      p_actor_user_id,
      p_actor_user_id,
      NULL,
      now(),
      now(),
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL
    )
    RETURNING * INTO created_assignment;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'assignment_conflict';
  END;

  PERFORM public.shared_sync_vehicle_status(p_vehicle_id, p_actor_user_id);

  RETURN created_assignment;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_block_vehicle(
  p_fleet_id uuid,
  p_vehicle_id uuid,
  p_actor_user_id uuid,
  p_blocked_until timestamptz,
  p_blocked_reason text
)
RETURNS public.vehicles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vehicle_record public.vehicles;
  active_assignment public.vehicle_assignments;
  normalized_reason text;
  updated_vehicle public.vehicles;
BEGIN
  IF NOT public.shared_can_manage_fleet(p_fleet_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_blocked_until IS NULL OR p_blocked_until <= now() THEN
    RAISE EXCEPTION 'validation_error:blocked_until';
  END IF;

  normalized_reason := regexp_replace(COALESCE(trim(p_blocked_reason), ''), '\s+', ' ', 'g');
  IF normalized_reason = '' THEN
    normalized_reason := 'Temporarily blocked by fleet manager';
  END IF;

  SELECT * INTO vehicle_record
  FROM public.vehicles vehicle
  WHERE vehicle.id = p_vehicle_id
    AND vehicle.fleet_id = p_fleet_id
    AND vehicle.deleted_at IS NULL
  FOR UPDATE;

  IF vehicle_record.id IS NULL THEN
    RAISE EXCEPTION 'not_found:vehicle';
  END IF;

  IF vehicle_record.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'vehicle_archived';
  END IF;

  UPDATE public.vehicles
  SET blocked_until = p_blocked_until,
      blocked_reason = normalized_reason,
      updated_by_user_id = p_actor_user_id,
      updated_at = now()
  WHERE id = p_vehicle_id;

  SELECT * INTO active_assignment
  FROM public.vehicle_assignments assignment
  WHERE assignment.vehicle_id = p_vehicle_id
    AND assignment.status = 'active'
    AND assignment.ended_at IS NULL
  FOR UPDATE;

  IF active_assignment.id IS NOT NULL THEN
    UPDATE public.vehicle_assignments
    SET status = 'ended',
        ended_by_user_id = p_actor_user_id,
        ended_at = now(),
        end_reason = 'blocked',
        updated_at = now()
    WHERE id = active_assignment.id;
  END IF;

  SELECT * INTO updated_vehicle
  FROM public.shared_sync_vehicle_status(p_vehicle_id, p_actor_user_id);

  RETURN updated_vehicle;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_unblock_vehicle(
  p_fleet_id uuid,
  p_vehicle_id uuid,
  p_actor_user_id uuid
)
RETURNS public.vehicles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vehicle_record public.vehicles;
  updated_vehicle public.vehicles;
BEGIN
  IF NOT public.shared_can_manage_fleet(p_fleet_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO vehicle_record
  FROM public.vehicles vehicle
  WHERE vehicle.id = p_vehicle_id
    AND vehicle.fleet_id = p_fleet_id
    AND vehicle.deleted_at IS NULL
  FOR UPDATE;

  IF vehicle_record.id IS NULL THEN
    RAISE EXCEPTION 'not_found:vehicle';
  END IF;

  IF vehicle_record.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_transition';
  END IF;

  UPDATE public.vehicles
  SET blocked_until = NULL,
      blocked_reason = NULL,
      updated_by_user_id = p_actor_user_id,
      updated_at = now()
  WHERE id = p_vehicle_id;

  SELECT * INTO updated_vehicle
  FROM public.shared_sync_vehicle_status(p_vehicle_id, p_actor_user_id);

  RETURN updated_vehicle;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_archive_vehicle(
  p_fleet_id uuid,
  p_vehicle_id uuid,
  p_actor_user_id uuid,
  p_archive_reason text DEFAULT NULL
)
RETURNS public.vehicles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vehicle_record public.vehicles;
  active_assignment public.vehicle_assignments;
  normalized_reason text;
  updated_vehicle public.vehicles;
BEGIN
  IF NOT public.shared_can_manage_fleet(p_fleet_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO vehicle_record
  FROM public.vehicles vehicle
  WHERE vehicle.id = p_vehicle_id
    AND vehicle.fleet_id = p_fleet_id
    AND vehicle.deleted_at IS NULL
  FOR UPDATE;

  IF vehicle_record.id IS NULL THEN
    RAISE EXCEPTION 'not_found:vehicle';
  END IF;

  IF vehicle_record.archived_at IS NOT NULL THEN
    RETURN vehicle_record;
  END IF;

  normalized_reason := regexp_replace(COALESCE(trim(p_archive_reason), ''), '\s+', ' ', 'g');
  IF normalized_reason = '' THEN
    normalized_reason := 'Archived by fleet manager';
  END IF;

  SELECT * INTO active_assignment
  FROM public.vehicle_assignments assignment
  WHERE assignment.vehicle_id = p_vehicle_id
    AND assignment.status = 'active'
    AND assignment.ended_at IS NULL
  FOR UPDATE;

  IF active_assignment.id IS NOT NULL THEN
    UPDATE public.vehicle_assignments
    SET status = 'ended',
        ended_by_user_id = p_actor_user_id,
        ended_at = now(),
        end_reason = 'archived',
        updated_at = now()
    WHERE id = active_assignment.id;
  END IF;

  UPDATE public.vehicles vehicle
  SET archived_at = now(),
      archived_by_user_id = p_actor_user_id,
      archive_reason = normalized_reason,
      blocked_until = NULL,
      blocked_reason = NULL,
      updated_by_user_id = p_actor_user_id,
      updated_at = now()
  WHERE vehicle.id = p_vehicle_id
  RETURNING * INTO updated_vehicle;

  PERFORM public.shared_sync_vehicle_status(p_vehicle_id, p_actor_user_id);

  RETURN updated_vehicle;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_unarchive_vehicle(
  p_fleet_id uuid,
  p_vehicle_id uuid,
  p_actor_user_id uuid
)
RETURNS public.vehicles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vehicle_record public.vehicles;
  updated_vehicle public.vehicles;
BEGIN
  IF NOT public.shared_can_manage_fleet(p_fleet_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO vehicle_record
  FROM public.vehicles vehicle
  WHERE vehicle.id = p_vehicle_id
    AND vehicle.fleet_id = p_fleet_id
    AND vehicle.deleted_at IS NULL
  FOR UPDATE;

  IF vehicle_record.id IS NULL THEN
    RAISE EXCEPTION 'not_found:vehicle';
  END IF;

  IF vehicle_record.archived_at IS NULL THEN
    RETURN vehicle_record;
  END IF;

  UPDATE public.vehicles
  SET archived_at = NULL,
      archived_by_user_id = NULL,
      archive_reason = NULL,
      updated_by_user_id = p_actor_user_id,
      updated_at = now()
  WHERE id = p_vehicle_id
  RETURNING * INTO updated_vehicle;

  PERFORM public.shared_sync_vehicle_status(p_vehicle_id, p_actor_user_id);

  RETURN updated_vehicle;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_deactivate_membership(
  p_membership_id uuid,
  p_actor_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.fleet_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  membership_record public.fleet_memberships;
  normalized_reason text;
  updated_membership public.fleet_memberships;
BEGIN
  SELECT * INTO membership_record
  FROM public.fleet_memberships membership
  WHERE membership.id = p_membership_id
  FOR UPDATE;

  IF membership_record.id IS NULL THEN
    RAISE EXCEPTION 'not_found:membership';
  END IF;

  IF NOT public.shared_is_owner(membership_record.fleet_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF membership_record.role = 'owner' THEN
    RAISE EXCEPTION 'invalid_transition';
  END IF;

  IF membership_record.ended_at IS NOT NULL THEN
    RETURN membership_record;
  END IF;

  normalized_reason := regexp_replace(COALESCE(trim(p_reason), ''), '\s+', ' ', 'g');
  IF normalized_reason = '' THEN
    normalized_reason := 'Membership deactivated by owner';
  END IF;

  UPDATE public.vehicle_assignments assignment
  SET status = 'ended',
      ended_by_user_id = p_actor_user_id,
      ended_at = now(),
      end_reason = 'system_ended',
      updated_at = now()
  WHERE assignment.driver_membership_id = membership_record.id
    AND assignment.status = 'active'
    AND assignment.ended_at IS NULL;

  UPDATE public.fleet_memberships membership
  SET ended_at = now(),
      ended_by_user_id = p_actor_user_id,
      deactivated_reason = normalized_reason,
      updated_at = now()
  WHERE membership.id = p_membership_id
  RETURNING * INTO updated_membership;

  RETURN updated_membership;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_update_membership_role(
  p_membership_id uuid,
  p_new_role public.membership_role,
  p_actor_user_id uuid
)
RETURNS public.fleet_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  membership_record public.fleet_memberships;
  updated_membership public.fleet_memberships;
BEGIN
  SELECT * INTO membership_record
  FROM public.fleet_memberships membership
  WHERE membership.id = p_membership_id
  FOR UPDATE;

  IF membership_record.id IS NULL THEN
    RAISE EXCEPTION 'not_found:membership';
  END IF;

  IF NOT public.shared_is_owner(membership_record.fleet_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF membership_record.role = 'owner' THEN
    RAISE EXCEPTION 'invalid_transition';
  END IF;

  IF membership_record.ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_transition';
  END IF;

  IF p_new_role = 'owner' THEN
    RAISE EXCEPTION 'invalid_transition';
  END IF;

  UPDATE public.fleet_memberships membership
  SET role = p_new_role,
      role_updated_by_user_id = p_actor_user_id,
      role_updated_at = now(),
      updated_at = now()
  WHERE membership.id = p_membership_id
  RETURNING * INTO updated_membership;

  RETURN updated_membership;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_normalize_expired_vehicle_blocks(
  p_actor_user_id uuid DEFAULT NULL,
  p_fleet_id uuid DEFAULT NULL,
  p_emit_notifications boolean DEFAULT true
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_vehicle public.vehicles;
  normalized_count integer := 0;
BEGIN
  IF p_actor_user_id IS NOT NULL AND p_fleet_id IS NOT NULL THEN
    IF NOT public.shared_can_manage_fleet(p_fleet_id, p_actor_user_id) THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;
  END IF;

  FOR target_vehicle IN
    SELECT *
    FROM public.vehicles vehicle
    WHERE vehicle.deleted_at IS NULL
      AND vehicle.archived_at IS NULL
      AND vehicle.blocked_until IS NOT NULL
      AND vehicle.blocked_until <= now()
      AND (p_fleet_id IS NULL OR vehicle.fleet_id = p_fleet_id)
    FOR UPDATE
  LOOP
    UPDATE public.vehicles vehicle
    SET blocked_until = NULL,
        blocked_reason = NULL,
        updated_by_user_id = COALESCE(p_actor_user_id, vehicle.updated_by_user_id),
        updated_at = now()
    WHERE vehicle.id = target_vehicle.id;

    PERFORM public.shared_sync_vehicle_status(target_vehicle.id, p_actor_user_id);
    normalized_count := normalized_count + 1;

    IF p_emit_notifications THEN
      PERFORM public.shared_emit_notifications(
        target_vehicle.fleet_id,
        'vehicle_unblocked',
        'vehicle',
        target_vehicle.id,
        jsonb_build_object(
          'vehicle_id', target_vehicle.id,
          'source', 'normalization_job'
        ),
        p_actor_user_id,
        public.shared_fleet_recipient_user_ids(
          target_vehicle.fleet_id,
          ARRAY['owner', 'admin']::public.membership_role[]
        ),
        'normalize-unblock:' || target_vehicle.id::text
      );
    END IF;
  END LOOP;

  RETURN normalized_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_get_fleet_operational_report(
  p_fleet_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report jsonb;
BEGIN
  IF NOT public.shared_can_manage_fleet(p_fleet_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  WITH active_vehicles AS (
    SELECT vehicle.id
    FROM public.vehicles vehicle
    WHERE vehicle.fleet_id = p_fleet_id
      AND vehicle.deleted_at IS NULL
      AND vehicle.archived_at IS NULL
  ),
  active_assignments AS (
    SELECT assignment.vehicle_id
    FROM public.vehicle_assignments assignment
    WHERE assignment.fleet_id = p_fleet_id
      AND assignment.status = 'active'
      AND assignment.ended_at IS NULL
  ),
  status_counts AS (
    SELECT
      count(*) FILTER (WHERE vehicle.blocked_until IS NOT NULL AND vehicle.blocked_until > now()) AS blocked_count,
      count(*) FILTER (
        WHERE (vehicle.blocked_until IS NULL OR vehicle.blocked_until <= now())
          AND EXISTS (SELECT 1 FROM active_assignments a WHERE a.vehicle_id = vehicle.id)
      ) AS driving_count,
      count(*) FILTER (
        WHERE (vehicle.blocked_until IS NULL OR vehicle.blocked_until <= now())
          AND NOT EXISTS (SELECT 1 FROM active_assignments a WHERE a.vehicle_id = vehicle.id)
      ) AS available_count
    FROM public.vehicles vehicle
    WHERE vehicle.fleet_id = p_fleet_id
      AND vehicle.deleted_at IS NULL
      AND vehicle.archived_at IS NULL
  ),
  membership_counts AS (
    SELECT jsonb_object_agg(role_name, role_count) AS role_counts
    FROM (
      SELECT membership.role::text AS role_name, count(*)::int AS role_count
      FROM public.fleet_memberships membership
      WHERE membership.fleet_id = p_fleet_id
        AND membership.ended_at IS NULL
      GROUP BY membership.role
    ) grouped
  ),
  recent_audits AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', audit.id,
          'eventType', audit.event_type,
          'entityType', audit.entity_type,
          'entityId', audit.entity_id,
          'actorUserId', audit.actor_user_id,
          'createdAt', audit.created_at,
          'payload', audit.payload
        )
        ORDER BY audit.created_at DESC
      ),
      '[]'::jsonb
    ) AS items
    FROM (
      SELECT *
      FROM public.fleet_audit_logs audit
      WHERE audit.fleet_id = p_fleet_id
      ORDER BY audit.created_at DESC
      LIMIT 20
    ) audit
  )
  SELECT jsonb_build_object(
    'activeDrivers', (
      SELECT count(DISTINCT assignment.driver_user_id)::int
      FROM public.vehicle_assignments assignment
      WHERE assignment.fleet_id = p_fleet_id
        AND assignment.status = 'active'
        AND assignment.ended_at IS NULL
    ),
    'vehiclesInUse', (SELECT COALESCE(driving_count, 0)::int FROM status_counts),
    'availableVehicles', (SELECT COALESCE(available_count, 0)::int FROM status_counts),
    'blockedVehicles', (SELECT COALESCE(blocked_count, 0)::int FROM status_counts),
    'pendingRequests', (
      SELECT count(*)::int
      FROM public.vehicle_assignments assignment
      WHERE assignment.fleet_id = p_fleet_id
        AND assignment.status = 'pending'
    ),
    'archivedVehicles', (
      SELECT count(*)::int
      FROM public.vehicles vehicle
      WHERE vehicle.fleet_id = p_fleet_id
        AND vehicle.deleted_at IS NULL
        AND vehicle.archived_at IS NOT NULL
    ),
    'membershipCountsByRole', (SELECT COALESCE(role_counts, '{}'::jsonb) FROM membership_counts),
    'recentAuditActivity', (SELECT items FROM recent_audits)
  ) INTO report;

  RETURN COALESCE(report, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_notify_and_audit_fleet_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.shared_write_audit_log(
      NEW.id,
      NEW.created_by_user_id,
      'fleet_created',
      'fleet',
      NEW.id,
      jsonb_build_object('name', NEW.name),
      'fleet-created:' || NEW.id::text
    );

    PERFORM public.shared_emit_notifications(
      NEW.id,
      'fleet_created',
      'fleet',
      NEW.id,
      jsonb_build_object('name', NEW.name),
      NEW.created_by_user_id,
      ARRAY[NEW.created_by_user_id]::uuid[],
      'fleet-created:' || NEW.id::text
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_notify_and_audit_invitation_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manager_ids uuid[];
BEGIN
  manager_ids := public.shared_fleet_recipient_user_ids(NEW.fleet_id, ARRAY['owner', 'admin']::public.membership_role[]);

  IF TG_OP = 'INSERT' THEN
    PERFORM public.shared_write_audit_log(
      NEW.fleet_id,
      NEW.invited_by_user_id,
      'invite_created',
      'fleet_invitation',
      NEW.id,
      jsonb_build_object('email', NEW.email, 'role', NEW.role, 'status', NEW.status),
      'invite-created:' || NEW.id::text
    );

    PERFORM public.shared_emit_notifications(
      NEW.fleet_id,
      'invitation_sent',
      'fleet_invitation',
      NEW.id,
      jsonb_build_object('email', NEW.email, 'role', NEW.role, 'expiresAt', NEW.expires_at),
      NEW.invited_by_user_id,
      manager_ids,
      'invite-sent:' || NEW.id::text
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'accepted' THEN
      PERFORM public.shared_write_audit_log(
        NEW.fleet_id,
        NEW.accepted_by_user_id,
        'invite_accepted',
        'fleet_invitation',
        NEW.id,
        jsonb_build_object('email', NEW.email, 'role', NEW.role),
        'invite-accepted:' || NEW.id::text
      );

      PERFORM public.shared_emit_notifications(
        NEW.fleet_id,
        'invitation_accepted',
        'fleet_invitation',
        NEW.id,
        jsonb_build_object('email', NEW.email, 'role', NEW.role, 'acceptedBy', NEW.accepted_by_user_id),
        NEW.accepted_by_user_id,
        manager_ids,
        'invite-accepted:' || NEW.id::text
      );
    ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'revoked' THEN
      PERFORM public.shared_write_audit_log(
        NEW.fleet_id,
        NEW.revoked_by_user_id,
        'invite_revoked',
        'fleet_invitation',
        NEW.id,
        jsonb_build_object('email', NEW.email, 'role', NEW.role),
        'invite-revoked:' || NEW.id::text
      );

      PERFORM public.shared_emit_notifications(
        NEW.fleet_id,
        'invitation_revoked',
        'fleet_invitation',
        NEW.id,
        jsonb_build_object('email', NEW.email, 'role', NEW.role),
        NEW.revoked_by_user_id,
        manager_ids,
        'invite-revoked:' || NEW.id::text
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_notify_and_audit_membership_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipients uuid[];
BEGIN
  recipients := public.shared_fleet_recipient_user_ids(NEW.fleet_id, ARRAY['owner', 'admin']::public.membership_role[]);

  IF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role AND NEW.ended_at IS NULL THEN
      PERFORM public.shared_write_audit_log(
        NEW.fleet_id,
        COALESCE(NEW.role_updated_by_user_id, NEW.ended_by_user_id),
        'membership_role_changed',
        'fleet_membership',
        NEW.id,
        jsonb_build_object('oldRole', OLD.role, 'newRole', NEW.role, 'targetUserId', NEW.user_id),
        'membership-role:' || NEW.id::text || ':' || NEW.updated_at::text
      );

      PERFORM public.shared_emit_notifications(
        NEW.fleet_id,
        'membership_role_changed',
        'fleet_membership',
        NEW.id,
        jsonb_build_object('oldRole', OLD.role, 'newRole', NEW.role, 'targetUserId', NEW.user_id),
        COALESCE(NEW.role_updated_by_user_id, NEW.ended_by_user_id),
        recipients || ARRAY[NEW.user_id]::uuid[],
        'membership-role:' || NEW.id::text || ':' || NEW.updated_at::text
      );
    END IF;

    IF OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN
      PERFORM public.shared_write_audit_log(
        NEW.fleet_id,
        NEW.ended_by_user_id,
        'membership_deactivated',
        'fleet_membership',
        NEW.id,
        jsonb_build_object('targetUserId', NEW.user_id, 'reason', NEW.deactivated_reason),
        'membership-ended:' || NEW.id::text
      );

      PERFORM public.shared_emit_notifications(
        NEW.fleet_id,
        'membership_deactivated',
        'fleet_membership',
        NEW.id,
        jsonb_build_object('targetUserId', NEW.user_id, 'reason', NEW.deactivated_reason),
        NEW.ended_by_user_id,
        recipients || ARRAY[NEW.user_id]::uuid[],
        'membership-ended:' || NEW.id::text
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_notify_and_audit_vehicle_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manager_ids uuid[];
  actor_id uuid;
BEGIN
  manager_ids := public.shared_fleet_recipient_user_ids(NEW.fleet_id, ARRAY['owner', 'admin']::public.membership_role[]);
  actor_id := COALESCE(NEW.updated_by_user_id, NEW.created_by_user_id);

  IF TG_OP = 'INSERT' THEN
    PERFORM public.shared_write_audit_log(
      NEW.fleet_id,
      NEW.created_by_user_id,
      'vehicle_created',
      'vehicle',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'plate', NEW.plate),
      'vehicle-created:' || NEW.id::text
    );

    PERFORM public.shared_emit_notifications(
      NEW.fleet_id,
      'vehicle_created',
      'vehicle',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'plate', NEW.plate),
      NEW.created_by_user_id,
      manager_ids,
      'vehicle-created:' || NEW.id::text
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL THEN
      PERFORM public.shared_write_audit_log(
        NEW.fleet_id,
        NEW.archived_by_user_id,
        'vehicle_archived',
        'vehicle',
        NEW.id,
        jsonb_build_object('name', NEW.name, 'plate', NEW.plate, 'reason', NEW.archive_reason),
        'vehicle-archived:' || NEW.id::text || ':' || NEW.updated_at::text
      );

      PERFORM public.shared_emit_notifications(
        NEW.fleet_id,
        'vehicle_archived',
        'vehicle',
        NEW.id,
        jsonb_build_object('name', NEW.name, 'plate', NEW.plate, 'reason', NEW.archive_reason),
        NEW.archived_by_user_id,
        manager_ids,
        'vehicle-archived:' || NEW.id::text || ':' || NEW.updated_at::text
      );
    ELSIF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL THEN
      PERFORM public.shared_write_audit_log(
        NEW.fleet_id,
        actor_id,
        'vehicle_unarchived',
        'vehicle',
        NEW.id,
        jsonb_build_object('name', NEW.name, 'plate', NEW.plate),
        'vehicle-unarchived:' || NEW.id::text || ':' || NEW.updated_at::text
      );

      PERFORM public.shared_emit_notifications(
        NEW.fleet_id,
        'vehicle_unarchived',
        'vehicle',
        NEW.id,
        jsonb_build_object('name', NEW.name, 'plate', NEW.plate),
        actor_id,
        manager_ids,
        'vehicle-unarchived:' || NEW.id::text || ':' || NEW.updated_at::text
      );
    ELSIF OLD.blocked_until IS DISTINCT FROM NEW.blocked_until THEN
      IF NEW.blocked_until IS NOT NULL AND NEW.blocked_until > now() THEN
        PERFORM public.shared_write_audit_log(
          NEW.fleet_id,
          actor_id,
          'vehicle_blocked',
          'vehicle',
          NEW.id,
          jsonb_build_object('blockedUntil', NEW.blocked_until, 'blockedReason', NEW.blocked_reason),
          'vehicle-blocked:' || NEW.id::text || ':' || NEW.updated_at::text
        );

        PERFORM public.shared_emit_notifications(
          NEW.fleet_id,
          'vehicle_blocked',
          'vehicle',
          NEW.id,
          jsonb_build_object('blockedUntil', NEW.blocked_until, 'blockedReason', NEW.blocked_reason),
          actor_id,
          public.shared_fleet_recipient_user_ids(NEW.fleet_id, ARRAY['owner', 'admin', 'driver']::public.membership_role[]),
          'vehicle-blocked:' || NEW.id::text || ':' || NEW.updated_at::text
        );
      ELSIF OLD.blocked_until IS NOT NULL AND NEW.blocked_until IS NULL THEN
        PERFORM public.shared_write_audit_log(
          NEW.fleet_id,
          actor_id,
          'vehicle_unblocked',
          'vehicle',
          NEW.id,
          jsonb_build_object('previousBlockedUntil', OLD.blocked_until),
          'vehicle-unblocked:' || NEW.id::text || ':' || NEW.updated_at::text
        );

        PERFORM public.shared_emit_notifications(
          NEW.fleet_id,
          'vehicle_unblocked',
          'vehicle',
          NEW.id,
          jsonb_build_object('previousBlockedUntil', OLD.blocked_until),
          actor_id,
          public.shared_fleet_recipient_user_ids(NEW.fleet_id, ARRAY['owner', 'admin', 'driver']::public.membership_role[]),
          'vehicle-unblocked:' || NEW.id::text || ':' || NEW.updated_at::text
        );
      END IF;
    ELSIF OLD.name IS DISTINCT FROM NEW.name OR OLD.plate IS DISTINCT FROM NEW.plate THEN
      PERFORM public.shared_write_audit_log(
        NEW.fleet_id,
        actor_id,
        'vehicle_updated',
        'vehicle',
        NEW.id,
        jsonb_build_object('oldName', OLD.name, 'newName', NEW.name, 'oldPlate', OLD.plate, 'newPlate', NEW.plate),
        'vehicle-updated:' || NEW.id::text || ':' || NEW.updated_at::text
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_notify_and_audit_assignment_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manager_ids uuid[];
  recipients uuid[];
  actor_id uuid;
  event_name text;
  notification_event public.notification_event_type;
  dedupe text;
BEGIN
  manager_ids := public.shared_fleet_recipient_user_ids(NEW.fleet_id, ARRAY['owner', 'admin']::public.membership_role[]);
  recipients := manager_ids || ARRAY[NEW.driver_user_id]::uuid[];

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' THEN
      event_name := 'assignment_requested';
      notification_event := 'vehicle_request_submitted';
      actor_id := NEW.requested_by_user_id;
      dedupe := 'assignment-requested:' || NEW.id::text;
    ELSIF NEW.status = 'active' THEN
      event_name := 'assignment_direct_assigned';
      notification_event := 'direct_assignment_created';
      actor_id := NEW.approved_by_user_id;
      dedupe := 'assignment-direct:' || NEW.id::text;
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = NEW.status THEN
      RETURN NEW;
    END IF;

    IF OLD.status = 'pending' AND NEW.status = 'active' THEN
      event_name := 'assignment_approved';
      notification_event := 'assignment_approved';
      actor_id := NEW.approved_by_user_id;
      dedupe := 'assignment-approved:' || NEW.id::text || ':' || NEW.updated_at::text;
    ELSIF OLD.status = 'pending' AND NEW.status = 'rejected' THEN
      event_name := 'assignment_rejected';
      notification_event := 'assignment_rejected';
      actor_id := NEW.rejected_by_user_id;
      dedupe := 'assignment-rejected:' || NEW.id::text || ':' || NEW.updated_at::text;
    ELSIF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
      event_name := 'assignment_cancelled';
      notification_event := 'assignment_cancelled';
      actor_id := NEW.cancelled_by_user_id;
      dedupe := 'assignment-cancelled:' || NEW.id::text || ':' || NEW.updated_at::text;
    ELSIF OLD.status = 'active' AND NEW.status = 'ended' THEN
      event_name := 'assignment_ended';
      notification_event := 'assignment_ended';
      actor_id := NEW.ended_by_user_id;
      dedupe := 'assignment-ended:' || NEW.id::text || ':' || NEW.updated_at::text;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM public.shared_write_audit_log(
    NEW.fleet_id,
    actor_id,
    event_name,
    'vehicle_assignment',
    NEW.id,
    jsonb_build_object(
      'vehicleId', NEW.vehicle_id,
      'driverUserId', NEW.driver_user_id,
      'status', NEW.status,
      'endReason', NEW.end_reason,
      'rejectedReason', NEW.rejected_reason,
      'cancelledReason', NEW.cancelled_reason
    ),
    dedupe
  );

  PERFORM public.shared_emit_notifications(
    NEW.fleet_id,
    notification_event,
    'vehicle_assignment',
    NEW.id,
    jsonb_build_object(
      'vehicleId', NEW.vehicle_id,
      'driverUserId', NEW.driver_user_id,
      'status', NEW.status,
      'endReason', NEW.end_reason
    ),
    actor_id,
    recipients,
    dedupe
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shared_fleet_notify_audit_on_fleets ON public.fleets;
CREATE TRIGGER shared_fleet_notify_audit_on_fleets
AFTER INSERT ON public.fleets
FOR EACH ROW
EXECUTE FUNCTION public.shared_notify_and_audit_fleet_changes();

DROP TRIGGER IF EXISTS shared_fleet_notify_audit_on_invitations ON public.fleet_invitations;
CREATE TRIGGER shared_fleet_notify_audit_on_invitations
AFTER INSERT OR UPDATE ON public.fleet_invitations
FOR EACH ROW
EXECUTE FUNCTION public.shared_notify_and_audit_invitation_changes();

DROP TRIGGER IF EXISTS shared_fleet_notify_audit_on_memberships ON public.fleet_memberships;
CREATE TRIGGER shared_fleet_notify_audit_on_memberships
AFTER UPDATE ON public.fleet_memberships
FOR EACH ROW
EXECUTE FUNCTION public.shared_notify_and_audit_membership_changes();

DROP TRIGGER IF EXISTS shared_fleet_notify_audit_on_vehicles ON public.vehicles;
CREATE TRIGGER shared_fleet_notify_audit_on_vehicles
AFTER INSERT OR UPDATE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.shared_notify_and_audit_vehicle_changes();

DROP TRIGGER IF EXISTS shared_fleet_notify_audit_on_assignments ON public.vehicle_assignments;
CREATE TRIGGER shared_fleet_notify_audit_on_assignments
AFTER INSERT OR UPDATE ON public.vehicle_assignments
FOR EACH ROW
EXECUTE FUNCTION public.shared_notify_and_audit_assignment_changes();

DROP POLICY IF EXISTS vehicles_select_member ON public.vehicles;
CREATE POLICY vehicles_select_member
  ON public.vehicles
  FOR SELECT
  USING (
    public.shared_is_active_member(fleet_id)
    AND (
      archived_at IS NULL
      OR public.shared_can_manage_fleet(fleet_id)
    )
  );

DROP POLICY IF EXISTS notifications_select_recipient_or_manager ON public.fleet_notifications;
CREATE POLICY notifications_select_recipient_or_manager
  ON public.fleet_notifications
  FOR SELECT
  USING (
    public.shared_is_active_member(fleet_id)
    AND (
      recipient_user_id = auth.uid()
      OR public.shared_can_manage_fleet(fleet_id)
    )
  );

DROP POLICY IF EXISTS notifications_update_recipient_read_state ON public.fleet_notifications;
CREATE POLICY notifications_update_recipient_read_state
  ON public.fleet_notifications
  FOR UPDATE
  USING (
    recipient_user_id = auth.uid()
    AND public.shared_is_active_member(fleet_id)
  )
  WITH CHECK (
    recipient_user_id = auth.uid()
    AND public.shared_is_active_member(fleet_id)
  );

DROP POLICY IF EXISTS audit_logs_select_manager_only ON public.fleet_audit_logs;
CREATE POLICY audit_logs_select_manager_only
  ON public.fleet_audit_logs
  FOR SELECT
  USING (public.shared_can_manage_fleet(fleet_id));

REVOKE ALL ON FUNCTION public.shared_write_audit_log(uuid, uuid, text, text, uuid, jsonb, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_emit_notifications(uuid, public.notification_event_type, text, uuid, jsonb, uuid, uuid[], text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_archive_vehicle(uuid, uuid, uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_unarchive_vehicle(uuid, uuid, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_deactivate_membership(uuid, uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_update_membership_role(uuid, public.membership_role, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_normalize_expired_vehicle_blocks(uuid, uuid, boolean) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.shared_write_audit_log(uuid, uuid, text, text, uuid, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_emit_notifications(uuid, public.notification_event_type, text, uuid, jsonb, uuid, uuid[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_archive_vehicle(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_unarchive_vehicle(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_deactivate_membership(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_update_membership_role(uuid, public.membership_role, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_normalize_expired_vehicle_blocks(uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_get_fleet_operational_report(uuid) TO authenticated, service_role;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    BEGIN
      EXECUTE $sql$
        SELECT cron.unschedule(jobid)
        FROM cron.job
        WHERE jobname = 'shared-normalize-expired-blocks'
      $sql$;
    EXCEPTION
      WHEN OTHERS THEN null;
    END;

    BEGIN
      EXECUTE $sql$
        SELECT cron.schedule(
          'shared-normalize-expired-blocks',
          '*/10 * * * *',
          $$select public.shared_normalize_expired_vehicle_blocks(null, null, true);$$
        )
      $sql$;
    EXCEPTION
      WHEN OTHERS THEN null;
    END;
  END IF;
END $$;

commit;
