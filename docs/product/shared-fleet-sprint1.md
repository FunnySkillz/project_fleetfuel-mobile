# Shared Fleet Sprint 1 Foundation

Date: 2026-04-06

## Scope

Shared Fleet mode introduces cloud-backed workflows in parallel to local mode:

- Supabase Auth (email/password)
- Fleet bootstrap
- Membership listing
- Invitation create/revoke/accept

Local-first MVP remains unchanged and isolated.

## Mode Boundary

- `AppPreferences.appMode` selects between `local` and `shared`.
- Local mode keeps existing SQLite, app-lock, and recovery behavior.
- Shared mode uses `/shared/*` routes and `src/shared-fleet/*` repositories/services.
- No local-to-cloud migration in this phase.

## Backend Assets

- SQL migration: `supabase/migrations/20260406213000_shared_fleet_foundation.sql`
- Edge functions:
  - `create-fleet`
  - `create-invite`
  - `accept-invite`
  - `revoke-invite`
- DB policy tests: `supabase/tests/shared_fleet_rls.test.sql`

## Security Model

- RLS enabled for all shared tables.
- Access is membership-scoped by fleet.
- Privileged invitation and fleet bootstrap logic is server-side via edge functions + SECURITY DEFINER RPC.
- Invitation tokens are hashed in storage.

## Sprint 2 Readiness

Schema already includes:

- `vehicles`
- `vehicle_assignments`
- status enums and constraints for assignment lifecycle
- one-active-assignment-per-vehicle index
- fleet + membership context integrity for assignments
