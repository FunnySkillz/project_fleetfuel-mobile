# FleetFuel UI Governance

Last updated: 2026-03-28

## Purpose

Keep the UI implementation consistent and reviewable while FleetFuel grows from MVP screens to full product coverage.

## Primitive-First Rule

- All form, list, and action surfaces must use shared primitives from `src/components/ui`.
- Raw React Native controls (`TextInput`, `Pressable`, ad-hoc row wrappers) are allowed only inside primitive implementations.
- New variants or behaviors must be added in primitives first, then consumed by screens.

## Hybrid Token Strategy

- Semantic theme tokens are the source of truth for colors and state meaning.
- NativeWind utility classes are used for layout/spacing/structure only.
- Screen code must not hardcode color values.
- Light and dark parity is required for every new surface before merge.

## Required Interaction States

- `disabled` and `loading` must be supported for every interactive primitive.
- Semantic tone support must stay consistent across primitives:
  - `neutral`
  - `success`
  - `warning`
  - `destructive`

## Migration Checklist (For New or Legacy Screens)

- Replace ad-hoc controls with primitives for all fields, rows, and actions.
- Ensure labels, hints, and validation errors use `FormField` contracts.
- Ensure list/detail rows use `ListRow` or documented primitive alternatives.
- Confirm no hardcoded colors were introduced.
- Confirm dark/light mode parity.
- Confirm iOS and Android touch behavior, keyboard behavior, and navigation feel remain native.
- Run `npm run lint`, `npx tsc --noEmit`, and `npx expo export --platform web --clear`.

