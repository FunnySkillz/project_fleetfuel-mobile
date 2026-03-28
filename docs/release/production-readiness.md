# FleetFuel MVP Production Readiness Gate

Last updated: 2026-03-28

## Purpose

Define a binary release gate for FleetFuel MVP. MVP ships only when all must-have checks are `PASS`.

## Gate Status

- Release target: `MVP 1.0.0`
- Gate owner: `Maintainer`
- Current status: `BLOCKED` until every must-have item is `PASS`

## Must-Have Checklist (Pass/Fail)

### 1) Data Safety

- [ ] PASS: Add/cancel/delete flows leave no orphan files.
  Exit criteria:
  - Canceling add/edit flows cleans staged receipt files.
  - Deleting entries removes linked receipt files.
  - Deleting vehicles handles linked records safely with no file leaks.
- [ ] PASS: Receipts remain linked correctly after create/edit/delete flows.
  Exit criteria:
  - Attachment references match existing entry IDs.
  - Opening entry detail never points to missing or wrong receipt.
- [ ] PASS: Backup ZIP is full fidelity.
  Exit criteria:
  - ZIP contains local database, attachment binaries, and versioned manifest metadata.
  - Restored data matches pre-backup record counts and attachment links.
- [ ] PASS: Restore validates before overwrite.
  Exit criteria:
  - Invalid or unsupported backups are rejected with clear reason.
  - Overwrite confirmation is explicit before destructive restore.

### 2) UX Resilience

- [ ] PASS: Required loading, empty, and error states exist on all core screens.
  Exit criteria:
  - Home, Vehicles, Vehicle Detail, Add Trip, Add Fuel, Export, and Settings are covered.
- [ ] PASS: Permission-denied paths provide useful guidance.
  Exit criteria:
  - Camera/photo/file-denied flows explain next steps.
  - No crashes on denied permission flows.
- [ ] PASS: Startup recovery exists.
  Exit criteria:
  - App initialization failure presents retry and safe recovery path.

### 3) Build and CI Baseline

- [ ] PASS: Type check passes (`npx tsc --noEmit`).
- [ ] PASS: Test suite passes (`npm test` or project test command).
- [ ] PASS: Lint baseline passes (`npm run lint` or project lint command).
- [ ] PASS: Production builds generate successfully for target platforms.

### 4) Local-First Guarantees

- [ ] PASS: App remains fully usable offline for all core MVP workflows.
- [ ] PASS: MVP has zero runtime dependency on cloud sync.
- [ ] PASS: UI and copy do not imply cloud collaboration that does not exist in MVP.

### 5) Export / Backup Guarantees

- [ ] PASS: Export destination is explicit to users.
  Exit criteria:
  - Users can see where files were generated.
- [ ] PASS: Users can open/share generated files after export.
- [ ] PASS: Backup and restore path is understandable from within the app UI.

### 6) Privacy / Permissions

- [ ] PASS: Only minimal required camera/photo/file permissions are requested.
- [ ] PASS: Permission prompts appear only in context of related user action.
- [ ] PASS: No misleading permission or privacy claims are shown.

### 7) Manual QA Matrix

- [ ] PASS: Create vehicle.
- [ ] PASS: Add trip.
- [ ] PASS: Add fuel entry.
- [ ] PASS: Attach receipt.
- [ ] PASS: Edit and delete flows.
- [ ] PASS: Export flow.
- [ ] PASS: Backup and restore flow.
- [ ] PASS: Theme check (light/dark consistency).
- [ ] PASS: iOS navigation checks (header spacing, swipe-back, no dead-end flows).

## Deferred Scope (Not a Release Blocker for MVP)

- Cloud sync behavior.
- Multi-user collaboration.
- Company/admin role workflows.
- Online reporting dashboards.

## Release Decision Rule

MVP is releasable only when:

- All must-have checklist items are `PASS`.
- No blocking local-first, data-safety, or navigation QA regressions remain open.

