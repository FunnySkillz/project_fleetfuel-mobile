# Shared Fleet Sprint 3

Sprint 3 brings Shared Fleet from functional correctness to operational readiness.

## Added capabilities

- Notification foundation (`fleet_notifications`) with read/unread behavior
- Audit trail foundation (`fleet_audit_logs`) for admin visibility
- Vehicle archive/unarchive flows
- Membership role update + deactivation flows
- Operations reporting RPC (`shared_get_fleet_operational_report`)
- Expired block normalization RPC (`shared_normalize_expired_vehicle_blocks`)
- DB-side trigger orchestration for notification + audit emission

## Shared UI additions

- Notifications screen (`/shared/notifications`)
- Audit log screen (`/shared/audit-log`)
- Operations screen (`/shared/operations`)
- Vehicle archive controls in vehicle detail
- Archived vehicle toggle in vehicles list
- Owner membership admin actions in members screen

## New edge functions

- `archive-vehicle`
- `unarchive-vehicle`
- `deactivate-membership`
- `update-membership-role`
- `normalize-expired-blocks`

## Schema and policy highlights

- New table: `public.fleet_notifications`
- New table: `public.fleet_audit_logs`
- Vehicle archive columns: `archived_at`, `archived_by_user_id`, `archive_reason`
- Membership lifecycle columns: `deactivated_reason`, `role_updated_at`, `role_updated_by_user_id`
- New enum: `notification_event_type`
- `assignment_end_reason` extended with `archived`
- RLS for notifications/audit logs with tenant scoping and role restrictions

## Validation commands

```bash
npm run lint
npx tsc --noEmit
npm test
npx supabase db test
```

`supabase db test` requires a running local Supabase stack (`npx supabase start`).
