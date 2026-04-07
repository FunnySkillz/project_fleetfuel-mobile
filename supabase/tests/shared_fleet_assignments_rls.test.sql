-- Shared Fleet Sprint 2 assignment and vehicle-status regression tests.
-- Execute with: supabase db test

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(12);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  ('10000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 's2-owner-a@example.com', crypt('password', gen_salt('bf')), now(), now(), now()),
  ('10000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 's2-owner-b@example.com', crypt('password', gen_salt('bf')), now(), now(), now()),
  ('10000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', 's2-driver-a@example.com', crypt('password', gen_salt('bf')), now(), now(), now()),
  ('10000000-0000-0000-0000-0000000000d2', 'authenticated', 'authenticated', 's2-driver-b@example.com', crypt('password', gen_salt('bf')), now(), now(), now()),
  ('10000000-0000-0000-0000-0000000000d3', 'authenticated', 'authenticated', 's2-driver-c@example.com', crypt('password', gen_salt('bf')), now(), now(), now())
ON CONFLICT (id) DO NOTHING;

SELECT public.shared_create_fleet_with_owner('S2 Fleet A', '10000000-0000-0000-0000-0000000000a1'::uuid);
SELECT public.shared_create_fleet_with_owner('S2 Fleet B', '10000000-0000-0000-0000-0000000000b1'::uuid);

INSERT INTO public.fleet_memberships (
  fleet_id,
  user_id,
  role,
  invited_by_user_id,
  invitation_id,
  joined_at
)
VALUES
  ((SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1), '10000000-0000-0000-0000-0000000000d1'::uuid, 'driver', '10000000-0000-0000-0000-0000000000a1'::uuid, NULL, now()),
  ((SELECT id FROM public.fleets WHERE name = 'S2 Fleet B' LIMIT 1), '10000000-0000-0000-0000-0000000000d2'::uuid, 'driver', '10000000-0000-0000-0000-0000000000b1'::uuid, NULL, now()),
  ((SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1), '10000000-0000-0000-0000-0000000000d3'::uuid, 'driver', '10000000-0000-0000-0000-0000000000a1'::uuid, NULL, now());

SELECT public.shared_create_vehicle(
  (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1),
  'A Car',
  'A-001',
  '10000000-0000-0000-0000-0000000000a1'::uuid
);
SELECT public.shared_create_vehicle(
  (SELECT id FROM public.fleets WHERE name = 'S2 Fleet B' LIMIT 1),
  'B Car',
  'B-001',
  '10000000-0000-0000-0000-0000000000b1'::uuid
);

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000d1', true);

SELECT is(
  (SELECT count(*) FROM public.vehicles),
  1::bigint,
  'driver A only sees vehicles in fleet A via RLS'
);

SELECT throws_ok(
  $$
    UPDATE public.vehicles
    SET name = 'Cross Fleet Write'
    WHERE id = (SELECT id FROM public.vehicles WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S2 Fleet B' LIMIT 1) LIMIT 1);
  $$,
  '%row-level security%',
  'driver A cannot update fleet B vehicles'
);

SELECT ok(
  EXISTS (
    WITH inserted AS (
      INSERT INTO public.vehicle_assignments (
        fleet_id,
        vehicle_id,
        driver_user_id,
        driver_membership_id,
        status,
        requested_by_user_id,
        requested_at
      )
      VALUES (
        (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1),
        (SELECT id FROM public.vehicles WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1) LIMIT 1),
        '10000000-0000-0000-0000-0000000000d1'::uuid,
        (SELECT id FROM public.fleet_memberships WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1) AND user_id = '10000000-0000-0000-0000-0000000000d1'::uuid LIMIT 1),
        'pending',
        '10000000-0000-0000-0000-0000000000d1'::uuid,
        now()
      )
      RETURNING id
    )
    SELECT 1 FROM inserted
  ),
  'driver A can create own pending request in own fleet'
);

SELECT throws_ok(
  $$
    INSERT INTO public.vehicle_assignments (
      fleet_id,
      vehicle_id,
      driver_user_id,
      driver_membership_id,
      status,
      requested_by_user_id,
      requested_at
    )
    VALUES (
      (SELECT id FROM public.fleets WHERE name = 'S2 Fleet B' LIMIT 1),
      (SELECT id FROM public.vehicles WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S2 Fleet B' LIMIT 1) LIMIT 1),
      '10000000-0000-0000-0000-0000000000d1'::uuid,
      (SELECT id FROM public.fleet_memberships WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1) AND user_id = '10000000-0000-0000-0000-0000000000d1'::uuid LIMIT 1),
      'pending',
      '10000000-0000-0000-0000-0000000000d1'::uuid,
      now()
    );
  $$,
  '%row-level security%',
  'driver A cannot request vehicles in fleet B'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000a1', true);

SELECT ok(
  (
    SELECT (public.shared_approve_assignment(
      (SELECT id FROM public.vehicle_assignments WHERE status = 'pending' AND driver_user_id = '10000000-0000-0000-0000-0000000000d1'::uuid LIMIT 1),
      '10000000-0000-0000-0000-0000000000a1'::uuid
    )).id IS NOT NULL
  ),
  'owner/admin approval flow activates pending assignment'
);

SELECT is(
  (
    SELECT public.shared_vehicle_effective_status(
      (SELECT id FROM public.vehicles WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1) LIMIT 1)
    )
  ),
  'driving'::public.vehicle_status,
  'effective vehicle status becomes driving when active assignment exists'
);

SELECT throws_ok(
  $$
    SELECT public.shared_direct_assign(
      (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1),
      (SELECT id FROM public.vehicles WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1) LIMIT 1),
      (SELECT id FROM public.fleet_memberships WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1) AND user_id = '10000000-0000-0000-0000-0000000000d3'::uuid LIMIT 1),
      '10000000-0000-0000-0000-0000000000a1'::uuid
    );
  $$,
  '%assignment_conflict%',
  'second active assignment for same vehicle is blocked'
);

SELECT ok(
  (
    SELECT (public.shared_block_vehicle(
      (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1),
      (SELECT id FROM public.vehicles WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1) LIMIT 1),
      '10000000-0000-0000-0000-0000000000a1'::uuid,
      now() + interval '2 days',
      'Maintenance'
    )).id IS NOT NULL
  ),
  'blocking active vehicle succeeds'
);

SELECT is(
  (
    SELECT end_reason
    FROM public.vehicle_assignments
    WHERE driver_user_id = '10000000-0000-0000-0000-0000000000d1'::uuid
      AND fleet_id = (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1)
    ORDER BY created_at DESC
    LIMIT 1
  ),
  'blocked'::public.assignment_end_reason,
  'blocking vehicle ends active assignment with blocked reason'
);

SELECT is(
  (
    SELECT public.shared_vehicle_effective_status(
      (SELECT id FROM public.vehicles WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1) LIMIT 1)
    )
  ),
  'blocked'::public.vehicle_status,
  'effective status resolves to blocked while block window is active'
);

SELECT ok(
  (
    SELECT (public.shared_unblock_vehicle(
      (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1),
      (SELECT id FROM public.vehicles WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1) LIMIT 1),
      '10000000-0000-0000-0000-0000000000a1'::uuid
    )).id IS NOT NULL
  ),
  'unblock workflow succeeds'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.vehicle_assignments assignment
    WHERE assignment.fleet_id = (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1)
      AND assignment.vehicle_id = (SELECT id FROM public.vehicles WHERE fleet_id = (SELECT id FROM public.fleets WHERE name = 'S2 Fleet A' LIMIT 1) LIMIT 1)
  ),
  1::bigint,
  'assignment history is preserved after lifecycle transitions'
);

SELECT * FROM finish();

ROLLBACK;
