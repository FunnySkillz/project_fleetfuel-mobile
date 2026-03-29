# FleetFuel Navigation and Layout QA Guide

Last updated: 2026-03-29

## Purpose

Adapt proven navigation/layout rules from SteuerFuchs to FleetFuel so stack behavior, spacing, and back navigation stay consistent across iOS and Android.

## Scope

This guide applies to stack-based routes where native headers are visible, including:

- `/vehicles/[vehicleId]`
- `/vehicles/new`
- `/trips/[tripId]`
- `/fuel/[fuelEntryId]`
- `/trips/new`
- `/fuel/new`
- `/logs/export`
- `/settings/*`

## Single Source of Truth for Header Ownership

- Native stack header is the default owner for stack route headers.
- In-content custom headers are only allowed when native header is intentionally disabled for that route.
- Never render both a native header and an in-content header for the same screen.

## Route Classification Contract

Every route must be classified before implementation.

### Read-only routes

Examples:
- `/vehicles/[vehicleId]`
- `/trips/[tripId]`
- `/fuel/[fuelEntryId]`
- `/settings/appearance`
- `/settings/about`

Rules:
- Allow frictionless back behavior.
- Allow native iOS swipe-back when navigation history exists.
- Do not add unsaved-changes guards.
- Exception note:
  - `settings/appearance` mutates preferences immediately but is still treated as read-only navigation behavior (no unsaved draft state).

### Mutable routes

Examples:
- `/trips/new`
- `/trips/[tripId]/edit`
- `/fuel/new`
- `/fuel/[fuelEntryId]/edit`
- `/vehicles/new`
- `/vehicles/[vehicleId]/edit`
- `/logs/export`
- `/settings/backup-restore` (when destructive or overwrite actions are active)

Rules:
- Guard unsaved changes on exit attempts.
- Intercept back actions and confirm discard before leaving.
- Keep gestures enabled unless a route-specific risk requires temporary blocking during confirmation.

## Safe-Area Ownership Rules

- Use `SafeAreaView` from `react-native-safe-area-context`.
- For stack screens with visible native headers, use `edges={["bottom"]}`.
- Do not claim top safe-area edges on these screens to avoid double top spacing under native headers.

## Scroll Inset Ownership Rules

For primary vertical `ScrollView` on stack routes:

- Set `contentInsetAdjustmentBehavior="never"`.
- Set `automaticallyAdjustContentInsets={false}`.
- Own spacing explicitly:
  - `paddingTop: 24`
  - `paddingBottom: insets.bottom + 24`

This keeps layout deterministic across iOS versions and prevents automatic inset drift.

## Top Spacing Pattern

- Outer wrappers own horizontal spacing only.
- Main vertical top spacing is owned by the primary scroll content container.
- Do not stack multiple top paddings across wrapper plus content container.

## Fallback Back-Navigation Rules

- Show explicit fallback actions only when `canGoBack` is false.
- Use clear labels such as `Back to Vehicles` or `Back to Settings`.
- Use `replace` for fallback destinations to avoid dead-end back loops.

## Rapid-Tap Navigation Guard Rules

- Guard route push entry points against duplicate pushes on rapid taps.
- Use an in-flight guard reset when the source route regains focus.
- Apply this to high-frequency transitions:
  - Vehicles list -> Vehicle detail
  - Vehicle detail -> Add trip
  - Vehicle detail -> Add fuel entry
  - Logs list -> Entry detail
  - Settings cards -> Settings subroutes

## Tab Scene Background Ownership

- Tab root scene background is owned centrally by tab layout configuration.
- Root routes (Dashboard, Vehicles, Logs, Settings) must not each define conflicting wrapper background colors.
- If a local visual override is needed, document the reason and verify overscroll behavior.

## Manual QA Checklist

- [ ] iOS: no extra top gap under native headers on `Vehicle Detail`, `Trip Detail`, `Fuel Entry Detail`, and settings subroutes.
- [ ] iOS: swipe-back works on read-only routes opened via push navigation.
- [ ] iOS/Android: mutable routes (`Add Trip`, `Add Fuel Entry`, edit routes) block accidental exit with unsaved changes.
- [ ] iOS/Android: no navigation dead ends when entering detail/settings routes directly.
- [ ] iOS/Android: rapid repeated taps do not create duplicate route history entries.
- [ ] iOS/Android: Dashboard, Vehicles, Logs, and Settings root routes share consistent background tone.
- [ ] iOS: overscroll/bounce on root tab scenes does not flash a different background.
