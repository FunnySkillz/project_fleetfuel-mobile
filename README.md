# FleetFuel Mobile

FleetFuel is a mobile-first fleet operations app with two isolated modes:

- `Local` mode: offline/local-first SQLite MVP flows
- `Shared Fleet` mode: cloud-backed Supabase multi-user workflows

Local mode and Shared Fleet mode are intentionally separated in UX, routing, and data access.

## Current product scope

### Local mode (unchanged MVP)

- Vehicles, trips, fuel entries, receipts
- Logs export (PDF)
- Backup/restore
- Local SQLite migrations and health checks

### Shared Fleet mode (Sprint 1 + Sprint 2 + Sprint 3)

- Auth/session: Supabase email + password
- Fleets and memberships with role-aware access (`owner`, `admin`, `driver`)
- Invitation lifecycle (create, accept, revoke, expire)
- Vehicle assignment lifecycle and status enforcement
- Vehicle block/unblock logic
- Vehicle archive/unarchive logic
- Membership role update + deactivation flows
- In-app notification feed with read/unread states
- Audit log visibility for owner/admin
- Operations reporting (assignment/status/membership/audit summary)
- Expired block normalization workflow (manual endpoint + DB cron scheduling path)

## Tech stack

- React Native + Expo + Expo Router
- TypeScript (strict)
- NativeWind + shared UI primitives
- Expo SQLite (Local mode)
- Supabase (Shared Fleet mode)
- Vitest

## Required environment variables

Shared Fleet mode requires:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Supabase edge functions also require standard Supabase runtime env vars when deployed/served (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

## Getting started

1. Install dependencies

```bash
npm install
```

2. Start app

```bash
npm run start
```

Useful platform commands:

```bash
npm run ios
npm run android
npm run web
```

## Shared Fleet backend setup (Supabase)

Project assets:

- migrations: `supabase/migrations`
- edge functions: `supabase/functions`
- policy/DB tests: `supabase/tests`

Typical local workflow:

```bash
npx supabase start
npx supabase db reset
npx supabase db test
```

If you need local function serving:

```bash
npx supabase functions serve --env-file supabase/.env.local
```

## Validation commands

```bash
npm run lint
npx tsc --noEmit
npm test
npx supabase db test
```

Note: `npx supabase db test` needs a running local Supabase stack (`supabase start`).

## Project structure

- routes: `src/app`
- local data/domain: `src/data`, `src/services`
- shared fleet cloud slice: `src/shared-fleet`
- UI primitives: `src/components/ui`
- docs: `docs/`

## Important architecture rules

- Local mode must remain stable and isolated from Shared mode.
- Shared business-critical workflows run server-side (RPC/edge functions), not client-only.
- Assignment history is the source of truth for who drove which vehicle and when.
- Shared lifecycle records are retained; archive/deactivate is preferred over destructive delete.

## Known deferred items

- Push notifications / email digests
- Rich export formats for reporting
- Offline-aware shared sync
- Enterprise-grade fleet controls (advanced policy/admin tooling)
