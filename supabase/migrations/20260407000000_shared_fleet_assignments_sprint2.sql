begin;

DO $$
BEGIN
  CREATE TYPE public.assignment_end_reason AS ENUM ('driver_ended', 'admin_ended', 'blocked', 'system_ended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.vehicle_assignments
  RENAME COLUMN ended_reason TO end_reason;

ALTER TABLE public.vehicle_assignments
  RENAME COLUMN rejection_reason TO rejected_reason;

ALTER TABLE public.vehicle_assignments
  ALTER COLUMN end_reason TYPE public.assignment_end_reason
  USING (
    CASE
      WHEN end_reason IS NULL THEN NULL
      WHEN end_reason IN ('driver_ended', 'admin_ended', 'blocked', 'system_ended') THEN end_reason::public.assignment_end_reason
      ELSE 'system_ended'::public.assignment_end_reason
    END
  );

ALTER TABLE public.vehicle_assignments
  ADD COLUMN IF NOT EXISTS rejected_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_reason text;

ALTER TABLE public.vehicle_assignments
  DROP CONSTRAINT IF EXISTS vehicle_assignments_status_timeline_check;

ALTER TABLE public.vehicle_assignments
  ADD CONSTRAINT vehicle_assignments_lifecycle_check CHECK (
    (
      status = 'pending'
      AND started_at IS NULL
      AND ended_at IS NULL
      AND approved_by_user_id IS NULL
      AND ended_by_user_id IS NULL
      AND end_reason IS NULL
      AND rejected_by_user_id IS NULL
      AND rejected_at IS NULL
      AND rejected_reason IS NULL
      AND cancelled_by_user_id IS NULL
      AND cancelled_at IS NULL
      AND cancelled_reason IS NULL
    )
    OR
    (
      status = 'active'
      AND started_at IS NOT NULL
      AND ended_at IS NULL
      AND approved_by_user_id IS NOT NULL
      AND ended_by_user_id IS NULL
      AND end_reason IS NULL
      AND rejected_by_user_id IS NULL
      AND rejected_at IS NULL
      AND rejected_reason IS NULL
      AND cancelled_by_user_id IS NULL
      AND cancelled_at IS NULL
      AND cancelled_reason IS NULL
    )
    OR
    (
      status = 'ended'
      AND started_at IS NOT NULL
      AND ended_at IS NOT NULL
      AND approved_by_user_id IS NOT NULL
      AND ended_by_user_id IS NOT NULL
      AND end_reason IS NOT NULL
      AND rejected_by_user_id IS NULL
      AND rejected_at IS NULL
      AND rejected_reason IS NULL
      AND cancelled_by_user_id IS NULL
      AND cancelled_at IS NULL
      AND cancelled_reason IS NULL
    )
    OR
    (
      status = 'rejected'
      AND started_at IS NULL
      AND ended_at IS NULL
      AND approved_by_user_id IS NULL
      AND ended_by_user_id IS NULL
      AND end_reason IS NULL
      AND rejected_by_user_id IS NOT NULL
      AND rejected_at IS NOT NULL
      AND char_length(trim(COALESCE(rejected_reason, ''))) > 0
      AND cancelled_by_user_id IS NULL
      AND cancelled_at IS NULL
      AND cancelled_reason IS NULL
    )
    OR
    (
      status = 'cancelled'
      AND started_at IS NULL
      AND ended_at IS NULL
      AND approved_by_user_id IS NULL
      AND ended_by_user_id IS NULL
      AND end_reason IS NULL
      AND rejected_by_user_id IS NULL
      AND rejected_at IS NULL
      AND rejected_reason IS NULL
      AND cancelled_by_user_id IS NOT NULL
      AND cancelled_at IS NOT NULL
      AND char_length(trim(COALESCE(cancelled_reason, ''))) > 0
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_assignments_pending_unique_driver_vehicle
  ON public.vehicle_assignments (fleet_id, vehicle_id, driver_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_assignments_pending_queue
  ON public.vehicle_assignments (fleet_id, requested_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_assignments_vehicle_timeline
  ON public.vehicle_assignments (fleet_id, vehicle_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_assignments_fleet_history
  ON public.vehicle_assignments (fleet_id, COALESCE(started_at, requested_at) DESC);

CREATE INDEX IF NOT EXISTS idx_assignments_active_driver
  ON public.vehicle_assignments (fleet_id, driver_user_id)
  WHERE status = 'active' AND ended_at IS NULL;

CREATE OR REPLACE FUNCTION public.shared_is_vehicle_blocked(p_vehicle_id uuid)
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
      AND vehicle.blocked_until IS NOT NULL
      AND vehicle.blocked_until > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.shared_vehicle_effective_status(p_vehicle_id uuid)
RETURNS public.vehicle_status
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vehicle_record public.vehicles;
BEGIN
  SELECT * INTO vehicle_record
  FROM public.vehicles vehicle
  WHERE vehicle.id = p_vehicle_id
    AND vehicle.deleted_at IS NULL
  LIMIT 1;

  IF vehicle_record.id IS NULL THEN
    RAISE EXCEPTION 'not_found:vehicle';
  END IF;

  IF vehicle_record.blocked_until IS NOT NULL AND vehicle_record.blocked_until > now() THEN
    RETURN 'blocked';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.vehicle_assignments assignment
    WHERE assignment.vehicle_id = p_vehicle_id
      AND assignment.status = 'active'
      AND assignment.ended_at IS NULL
  ) THEN
    RETURN 'driving';
  END IF;

  RETURN 'available';
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_sync_vehicle_status(p_vehicle_id uuid, p_actor_user_id uuid DEFAULT NULL)
RETURNS public.vehicles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_status public.vehicle_status;
  synced_vehicle public.vehicles;
BEGIN
  next_status := public.shared_vehicle_effective_status(p_vehicle_id);

  UPDATE public.vehicles vehicle
  SET status = next_status,
      updated_by_user_id = COALESCE(p_actor_user_id, vehicle.updated_by_user_id),
      updated_at = now()
  WHERE vehicle.id = p_vehicle_id
    AND vehicle.deleted_at IS NULL
  RETURNING * INTO synced_vehicle;

  IF synced_vehicle.id IS NULL THEN
    RAISE EXCEPTION 'not_found:vehicle';
  END IF;

  RETURN synced_vehicle;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_require_active_membership(
  p_fleet_id uuid,
  p_user_id uuid
)
RETURNS public.fleet_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  membership_record public.fleet_memberships;
BEGIN
  SELECT * INTO membership_record
  FROM public.fleet_memberships membership
  WHERE membership.fleet_id = p_fleet_id
    AND membership.user_id = p_user_id
    AND membership.ended_at IS NULL
  LIMIT 1;

  IF membership_record.id IS NULL THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN membership_record;
END;
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

CREATE OR REPLACE FUNCTION public.shared_create_vehicle(
  p_fleet_id uuid,
  p_name text,
  p_plate text,
  p_actor_user_id uuid
)
RETURNS public.vehicles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_name text;
  normalized_plate text;
  created_vehicle public.vehicles;
BEGIN
  IF NOT public.shared_can_manage_fleet(p_fleet_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  normalized_name := regexp_replace(COALESCE(trim(p_name), ''), '\s+', ' ', 'g');
  normalized_plate := upper(regexp_replace(COALESCE(trim(p_plate), ''), '\s+', ' ', 'g'));

  IF char_length(normalized_name) < 2 OR char_length(normalized_name) > 80 THEN
    RAISE EXCEPTION 'validation_error:vehicle_name';
  END IF;

  IF char_length(normalized_plate) < 2 OR char_length(normalized_plate) > 32 THEN
    RAISE EXCEPTION 'validation_error:vehicle_plate';
  END IF;

  INSERT INTO public.vehicles (
    fleet_id,
    name,
    plate,
    status,
    blocked_until,
    blocked_reason,
    created_by_user_id,
    updated_by_user_id,
    deleted_at
  )
  VALUES (
    p_fleet_id,
    normalized_name,
    normalized_plate,
    'available',
    NULL,
    NULL,
    p_actor_user_id,
    p_actor_user_id,
    NULL
  )
  RETURNING * INTO created_vehicle;

  RETURN created_vehicle;
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

CREATE OR REPLACE FUNCTION public.shared_reject_assignment(
  p_assignment_id uuid,
  p_actor_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.vehicle_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignment_record public.vehicle_assignments;
  normalized_reason text;
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

  normalized_reason := regexp_replace(COALESCE(trim(p_reason), ''), '\s+', ' ', 'g');
  IF normalized_reason = '' THEN
    normalized_reason := 'Rejected by fleet manager';
  END IF;

  UPDATE public.vehicle_assignments
  SET status = 'rejected',
      rejected_by_user_id = p_actor_user_id,
      rejected_at = now(),
      rejected_reason = normalized_reason,
      updated_at = now()
  WHERE id = assignment_record.id
  RETURNING * INTO updated_assignment;

  RETURN updated_assignment;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_cancel_assignment(
  p_assignment_id uuid,
  p_actor_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.vehicle_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignment_record public.vehicle_assignments;
  normalized_reason text;
  updated_assignment public.vehicle_assignments;
BEGIN
  SELECT * INTO assignment_record
  FROM public.vehicle_assignments assignment
  WHERE assignment.id = p_assignment_id
  FOR UPDATE;

  IF assignment_record.id IS NULL THEN
    RAISE EXCEPTION 'assignment_not_found';
  END IF;

  IF assignment_record.driver_user_id <> p_actor_user_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT public.shared_is_active_member(assignment_record.fleet_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF assignment_record.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_transition';
  END IF;

  normalized_reason := regexp_replace(COALESCE(trim(p_reason), ''), '\s+', ' ', 'g');
  IF normalized_reason = '' THEN
    normalized_reason := 'Cancelled by driver';
  END IF;

  UPDATE public.vehicle_assignments
  SET status = 'cancelled',
      cancelled_by_user_id = p_actor_user_id,
      cancelled_at = now(),
      cancelled_reason = normalized_reason,
      updated_at = now()
  WHERE id = assignment_record.id
  RETURNING * INTO updated_assignment;

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

CREATE OR REPLACE FUNCTION public.shared_end_assignment(
  p_assignment_id uuid,
  p_actor_user_id uuid,
  p_end_reason public.assignment_end_reason DEFAULT NULL
)
RETURNS public.vehicle_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignment_record public.vehicle_assignments;
  is_manager boolean;
  final_reason public.assignment_end_reason;
  updated_assignment public.vehicle_assignments;
BEGIN
  SELECT * INTO assignment_record
  FROM public.vehicle_assignments assignment
  WHERE assignment.id = p_assignment_id
  FOR UPDATE;

  IF assignment_record.id IS NULL THEN
    RAISE EXCEPTION 'assignment_not_found';
  END IF;

  is_manager := public.shared_can_manage_fleet(assignment_record.fleet_id, p_actor_user_id);

  IF NOT is_manager THEN
    IF assignment_record.driver_user_id <> p_actor_user_id THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;

    IF NOT public.shared_is_active_member(assignment_record.fleet_id, p_actor_user_id) THEN
      RAISE EXCEPTION 'not_authorized';
    END IF;
  END IF;

  IF assignment_record.status = 'ended' THEN
    RAISE EXCEPTION 'already_ended';
  END IF;

  IF assignment_record.status <> 'active' THEN
    RAISE EXCEPTION 'invalid_transition';
  END IF;

  final_reason := COALESCE(
    p_end_reason,
    CASE WHEN is_manager THEN 'admin_ended'::public.assignment_end_reason ELSE 'driver_ended'::public.assignment_end_reason END
  );

  IF final_reason = 'blocked' AND NOT is_manager THEN
    RAISE EXCEPTION 'invalid_transition';
  END IF;

  UPDATE public.vehicle_assignments
  SET status = 'ended',
      ended_by_user_id = p_actor_user_id,
      ended_at = now(),
      end_reason = final_reason,
      updated_at = now()
  WHERE id = assignment_record.id
  RETURNING * INTO updated_assignment;

  PERFORM public.shared_sync_vehicle_status(assignment_record.vehicle_id, p_actor_user_id);

  RETURN updated_assignment;
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

CREATE OR REPLACE FUNCTION public.shared_validate_assignment_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status NOT IN ('pending', 'active', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_transition';
  END IF;

  IF OLD.status = 'active' AND NEW.status NOT IN ('active', 'ended') THEN
    RAISE EXCEPTION 'invalid_transition';
  END IF;

  IF OLD.status IN ('ended', 'rejected', 'cancelled') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'invalid_transition';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_vehicle_assignment_transition ON public.vehicle_assignments;
CREATE TRIGGER validate_vehicle_assignment_transition
BEFORE UPDATE ON public.vehicle_assignments
FOR EACH ROW
EXECUTE FUNCTION public.shared_validate_assignment_transition();

DROP POLICY IF EXISTS assignments_insert_manager_or_driver_request ON public.vehicle_assignments;

DROP POLICY IF EXISTS assignments_insert_driver_request ON public.vehicle_assignments;
CREATE POLICY assignments_insert_driver_request
  ON public.vehicle_assignments
  FOR INSERT
  WITH CHECK (
    status = 'pending'
    AND driver_user_id = auth.uid()
    AND requested_by_user_id = auth.uid()
    AND public.shared_member_role(fleet_id, auth.uid()) = 'driver'
  );

DROP POLICY IF EXISTS assignments_insert_manager ON public.vehicle_assignments;
CREATE POLICY assignments_insert_manager
  ON public.vehicle_assignments
  FOR INSERT
  WITH CHECK (public.shared_can_manage_fleet(fleet_id));

DROP POLICY IF EXISTS assignments_update_manager ON public.vehicle_assignments;
CREATE POLICY assignments_update_manager
  ON public.vehicle_assignments
  FOR UPDATE
  USING (public.shared_can_manage_fleet(fleet_id))
  WITH CHECK (public.shared_can_manage_fleet(fleet_id));

DROP POLICY IF EXISTS assignments_update_driver_own ON public.vehicle_assignments;
CREATE POLICY assignments_update_driver_own
  ON public.vehicle_assignments
  FOR UPDATE
  USING (
    driver_user_id = auth.uid()
    AND public.shared_is_active_member(fleet_id)
    AND status IN ('pending', 'active')
  )
  WITH CHECK (
    driver_user_id = auth.uid()
    AND public.shared_is_active_member(fleet_id)
    AND (
      (status = 'cancelled' AND cancelled_by_user_id = auth.uid())
      OR (status = 'ended' AND ended_by_user_id = auth.uid())
    )
  );

REVOKE ALL ON FUNCTION public.shared_request_assignment(uuid, uuid, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_create_vehicle(uuid, text, text, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_approve_assignment(uuid, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_reject_assignment(uuid, uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_cancel_assignment(uuid, uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_direct_assign(uuid, uuid, uuid, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_end_assignment(uuid, uuid, public.assignment_end_reason) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_block_vehicle(uuid, uuid, uuid, timestamptz, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_unblock_vehicle(uuid, uuid, uuid) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.shared_request_assignment(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_create_vehicle(uuid, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_approve_assignment(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_reject_assignment(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_cancel_assignment(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_direct_assign(uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_end_assignment(uuid, uuid, public.assignment_end_reason) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_block_vehicle(uuid, uuid, uuid, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shared_unblock_vehicle(uuid, uuid, uuid) TO service_role;

commit;
