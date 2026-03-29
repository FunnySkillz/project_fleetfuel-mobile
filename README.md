# FleetFuel Mobile (MVP)

FleetFuel is a mobile-first, local-first/offline-first app for tracking:

- vehicles
- trips
- fuel entries
- receipt attachments (photo/image/pdf)
- logs export
- backup/restore

MVP is intentionally backend-free. No sync, no roles, no company/admin workflows.

## Current MVP scope

Implemented core navigation and workflows:

- Root tabs: `Dashboard | Vehicles | Add | Logs | Settings`
- Add actions: `Add Trip`, `Add Fuel`, `Add Vehicle`
- Vehicle insight screen with KPI summaries and recent trips
- Logs export workbench with filters (vehicle/date/usage/fuel-type)
- PDF export generation from local data
- Settings:
  - Appearance (`system | light | dark`)
  - Language (`en | de`)
  - Backup and Restore

Data safety/hardening implemented:

- SQLite local persistence with migrations
- Startup DB health gate + recovery path
- Backup format: ZIP + manifest + payloads (DB/receipts/preferences)
- Restore strategy: preflight validation + full replace
- Receipt orphan scan and manual cleanup action

## Tech stack

- React Native + Expo + Expo Router
- TypeScript
- NativeWind/Tailwind utilities + shared shadcn-style UI primitives
- Expo SQLite for local persistence
- Vitest (logic-first test baseline)

## Project structure

- App routes: `src/app`
- Data layer: `src/data`
- UI primitives: `src/components/ui`
- Services: `src/services`
- Preferences/i18n: `src/preferences`, `src/providers`, `src/i18n`
- Product/engineering docs: `docs/`

## Getting started

1. Install dependencies

```bash
npm install
```

2. Start the app

```bash
npm run start
```

Useful launch commands:

```bash
npm run ios
npm run android
npm run web
```

## Quality commands

```bash
npm run lint
npm test
npx tsc --noEmit
npx expo export --platform web --clear
```

## Scripts

- `npm run start` - start Expo
- `npm run ios` - run iOS target
- `npm run android` - run Android target
- `npm run web` - run web target
- `npm run lint` - run Expo ESLint
- `npm test` - run Vitest suite
- `npm run reset-project` - reset scaffold utility from template

## Platform notes

- Primary target is iOS/Android (mobile-first).
- SQLite-backed data features are designed for mobile runtime.
- Web export build is available for CI/static checks, but local DB features are not intended as a full web product in MVP.

## Documentation

Key internal docs:

- `docs/product/mvp-definition.md`
- `docs/design/navigation-layout-qa.md`
- `docs/release/production-readiness.md`
- `docs/project/lessons-learned-v1.md`
- `docs/design/design-system-direction.md`