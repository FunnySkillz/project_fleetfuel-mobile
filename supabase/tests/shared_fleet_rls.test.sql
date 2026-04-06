-- Shared Fleet RLS regression tests.
-- Execute with: supabase db test

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(9);

-- Seed two users in auth schema.
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'owner-a@example.com', crypt('password', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'owner-b@example.com', crypt('password', gen_salt('bf')), now(), now(), now()),
  ('00000000-0000-0000-0000-0000000000d1', 'authenticated', 'authenticated', 'driver@example.com', crypt('password', gen_salt('bf')), now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- Build two fleets and memberships through privileged RPC.
SELECT public.shared_create_fleet_with_owner('Fleet A', '00000000-0000-0000-0000-0000000000a1'::uuid);
SELECT public.shared_create_fleet_with_owner('Fleet B', '00000000-0000-0000-0000-0000000000b1'::uuid);

SELECT is(
  (SELECT count(*) FROM public.fleets),
  2::bigint,
  'two fleets created for tenancy tests'
);

SELECT set_config('request.jwt.claim.role', 'authenticated', true);

-- Authenticate as owner A.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

SELECT is(
  (SELECT count(*) FROM public.fleets),
  1::bigint,
  'owner A only sees own fleet through RLS'
);

SELECT is(
  (SELECT count(*) FROM public.fleet_memberships),
  1::bigint,
  'owner A only sees memberships from own fleet'
);

-- Authenticate as owner B.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);

SELECT is(
  (SELECT count(*) FROM public.fleets),
  1::bigint,
  'owner B only sees own fleet through RLS'
);

-- Owner A invites a driver via privileged RPC.
SELECT public.shared_create_invitation(
  (SELECT id FROM public.fleets WHERE name = 'Fleet A' LIMIT 1),
  'driver@example.com',
  'driver',
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  repeat('a', 64),
  now() + interval '7 days'
);

SELECT is(
  (SELECT count(*) FROM public.fleet_invitations WHERE status = 'pending'),
  1::bigint,
  'pending invitation created'
);

-- Duplicate invite should be blocked.
SELECT throws_ok(
  $$
    SELECT public.shared_create_invitation(
      (SELECT id FROM public.fleets WHERE name = 'Fleet A' LIMIT 1),
      'driver@example.com',
      'driver',
      '00000000-0000-0000-0000-0000000000a1'::uuid,
      repeat('b', 64),
      now() + interval '7 days'
    );
  $$,
  '%duplicate_invite%',
  'duplicate pending invite is rejected'
);

-- Accept invite as driver.
SELECT ok(
  (
    SELECT public.shared_accept_invitation(
      (SELECT id FROM public.fleet_invitations WHERE email = 'driver@example.com' LIMIT 1),
      repeat('a', 64),
      '00000000-0000-0000-0000-0000000000d1'::uuid,
      'driver@example.com'
    )
  ),
  'accept invitation succeeds'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.fleet_memberships m
    JOIN public.fleets f ON f.id = m.fleet_id
    WHERE f.name = 'Fleet A'
      AND m.user_id = '00000000-0000-0000-0000-0000000000d1'::uuid
      AND m.ended_at IS NULL
  ),
  1::bigint,
  'accept invitation creates active membership'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);

SELECT is(
  (SELECT count(*) FROM public.fleets),
  1::bigint,
  'driver only sees fleet they belong to'
);

SELECT * FROM finish();

ROLLBACK;
