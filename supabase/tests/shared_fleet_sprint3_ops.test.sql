-- Shared Fleet Sprint 3 operational regression tests.
-- Execute with: supabase db test

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(14);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  ('20000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 's3-owner-a@example.com', crypt('password', gen_salt('bf')), now(), now(), now()),
  ('20000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 's3-owner-b@example.com', crypt('password', gen_salt('bf')), now(), now(), now()),
  ('20000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', 's3-driver-a@example.com', crypt('password', gen_salt('bf')), now(), now(), now()),
  ('20000000-0000-0000-0000-0000000000d2', 'authenticated', 'authenticated', 's3-driver-b@example.com', crypt('password', gen_salt('bf')), now(), now(), now())
ON CONFLICT (id) DO NOTHING;

SELECT public.shared_create_fleet_with_owner('S3 Fleet A', '20000000-0000-0000-0000-0000000000a1'::uuid);
SELECT public.shared_create_fleet_with_owner('S3 Fleet B', '20000000-0000-0000-0000-0000000000b1'::uuid);

INSERT INTO public.fleet_memberships (
  fleet_id,
  user_id,
  role,
  invited_by_user_id,
  invitation_id,
  joined_at
)
VALUES
  ((SELECT id FROM public.fleets WHERE name = 'S3 Fleet A' LIMIT 1), '20000000-0000-0000-0000-0000000000d1'::uuid, 'driver', '20000000-0000-0000-0000-0000000000a1'::uuid, NULL, now()),
  ((SELECT id FROM public.fleets WHERE name = 'S3 Fleet A' LIMIT 1), '20000000-0000-0000-0000-0000000000d2'::uuid, 'driver', '20000000-0000-0000-0000-0000000000a1'::uuid, NULL, now());

SELECT public.shared_create_vehicle(
  (SELECT id FROM public.fleets WHERE name = 'S3 Fleet A' LIMIT 1),
  'Sprint3 Car',
  'S3-001',
  '20000000-0000-0000-0000-0000000000a1'::uuid
);

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000d1', true);

SELECT ok(
  (
    SELECT (public.shared_request_assignment(
      (SELECT id FROM public.fleets WHERE name = 'S3 Fleet A' LIMIT 1),
      (SELECT id FROM public.vehicles WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S3 Fleet A' LIMIT 1) LIMIT 1),
      '20000000-0000-0000-0000-0000000000d1'::uuid
    )).id IS NOT NULL
  ),
  'driver request flow works in sprint 3'
);

SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000a1', true);

SELECT ok(
  (
    SELECT (public.shared_approve_assignment(
      (SELECT id FROM public.vehicle_assignments WHERE status = 'pending' AND driver_user_id = '20000000-0000-0000-0000-0000000000d1'::uuid LIMIT 1),
      '20000000-0000-0000-0000-0000000000a1'::uuid
    )).id IS NOT NULL
  ),
  'assignment approval flow still works in sprint 3'
);

SELECT ok(
  (
    SELECT count(*) > 0
    FROM public.fleet_notifications notification
    WHERE notification.fleet_id = (SELECT id FROM public.fleets WHERE name = 'S3 Fleet A' LIMIT 1)
  ),
  'notifications are emitted for sprint 3 lifecycle events'
);

SELECT ok(
  (
    SELECT count(*) > 0
    FROM public.fleet_audit_logs audit
    WHERE audit.fleet_id = (SELECT id FROM public.fleets WHERE name = 'S3 Fleet A' LIMIT 1)
  ),
  'audit logs are emitted for sprint 3 lifecycle events'
);

SELECT ok(
  (
    SELECT (public.shared_archive_vehicle(
      (SELECT id FROM public.fleets WHERE name = 'S3 Fleet A' LIMIT 1),
      (SELECT id FROM public.vehicles WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S3 Fleet A' LIMIT 1) LIMIT 1),
      '20000000-0000-0000-0000-0000000000a1'::uuid,
      'Retired'
    )).archived_at IS NOT NULL
  ),
  'vehicle archive flow marks archived_at'
);

SELECT throws_ok(
  $$
    SELECT public.shared_request_assignment(
      (SELECT id FROM public.fleets WHERE name = 'S3 Fleet A' LIMIT 1),
      (SELECT id FROM public.vehicles WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S3 Fleet A' LIMIT 1) LIMIT 1),
      '20000000-0000-0000-0000-0000000000d1'::uuid
    );
  $$,
  '%vehicle_archived%',
  'archived vehicle cannot receive new assignment'
);

SELECT ok(
  (
    SELECT (public.shared_deactivate_membership(
      (SELECT id FROM public.fleet_memberships WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S3 Fleet A' LIMIT 1) AND user_id = '20000000-0000-0000-0000-0000000000d1'::uuid LIMIT 1),
      '20000000-0000-0000-0000-0000000000a1'::uuid,
      'Offboarded'
    )).ended_at IS NOT NULL
  ),
  'membership deactivation closes membership record without delete'
);

SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000d1', true);

SELECT is(
  (SELECT count(*) FROM public.fleets),
  0::bigint,
  'deactivated member loses fleet access through RLS'
);

SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000a1', true);

UPDATE public.vehicles
SET blocked_until = now() - interval '2 hours',
    blocked_reason = 'Expired maintenance'
WHERE id = (SELECT id FROM public.vehicles WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S3 Fleet A' LIMIT 1) LIMIT 1);

SELECT is(
  public.shared_normalize_expired_vehicle_blocks('20000000-0000-0000-0000-0000000000a1'::uuid, (SELECT id FROM public.fleets WHERE name = 'S3 Fleet A' LIMIT 1), true),
  1,
  'expired block normalization clears stale blocked vehicles'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.vehicles vehicle
    WHERE vehicle.fleet_id = (SELECT id FROM public.fleets WHERE name = 'S3 Fleet A' LIMIT 1)
      AND vehicle.blocked_until IS NULL
  ),
  1::bigint,
  'normalized vehicles no longer keep blocked_until values'
);

SELECT ok(
  EXISTS(
    WITH target AS (
      SELECT id
      FROM public.fleet_notifications
      WHERE recipient_user_id = '20000000-0000-0000-0000-0000000000a1'::uuid
        AND is_read = false
      ORDER BY created_at DESC
      LIMIT 1
    )
    UPDATE public.fleet_notifications notification
    SET is_read = true,
        read_at = now()
    WHERE notification.id = (SELECT id FROM target)
    RETURNING 1
  ),
  'notification read state can be updated by recipient'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.fleet_notifications
    WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S3 Fleet B' LIMIT 1)
  ),
  0::bigint,
  'fleet A owner cannot read fleet B notifications'
);

SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000d2', true);

SELECT is(
  (SELECT count(*) FROM public.fleet_audit_logs),
  0::bigint,
  'drivers do not have audit log visibility'
);

SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000a1', true);

SELECT ok(
  (
    SELECT (public.shared_get_fleet_operational_report(
      (SELECT id FROM public.fleets WHERE name = 'S3 Fleet A' LIMIT 1)
    ) ? 'pendingRequests')
  ),
  'operational report rpc returns structured report payload'
);

SELECT * FROM finish();

ROLLBACK;
