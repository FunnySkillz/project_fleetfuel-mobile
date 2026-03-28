# FleetFuel Design System Direction

Last updated: 2026-03-28

## Purpose

Define FleetFuel visual and interaction direction before screen implementation so decisions stay consistent and trust-focused across the MVP.

## Product Family Direction

FleetFuel follows the same product family feel as SteuerFuchs:

- Premium but practical.
- Minimal and focused.
- Finance/business trust first.
- High readability in all core workflows.
- Dark mode as a first-class mode, not an afterthought.

## Core Design Principles

- Clarity over decoration.
- Strong hierarchy for decision-heavy data screens.
- Predictable interaction language across all flows.
- Evidence-forward UI for receipts and mileage records.
- Consistent affordances for primary and destructive actions.

## Component Direction

### Cards

- Use cards for grouped vehicle metrics, trip summaries, fuel summaries, and export/backup actions.
- Keep card structure stable: title, key value, supporting metadata, optional actions.

### Tabs

- Tabs are for top-level app areas only.
- Tab labels must be short and unambiguous.
- Active/inactive states must remain readable in light and dark themes.

### Buttons

- Define and reuse three clear button roles:
  - Primary
  - Secondary
  - Destructive
- Never swap semantic role styling between screens.

### Chips and Badges

- Use chips for compact metadata such as private/business tags, fuel type, and status.
- Use badges for state indicators only, not as generic decoration.

### Form Inputs

- Inputs must prioritize numeric readability for odometer, liters, and price values.
- Keep labels persistent and explicit.
- Validation states must be visible and actionable.

### List Rows

- Row layout must support quick scan of date, vehicle, distance/odometer, and monetary values.
- Keep tap targets consistent and clear.

### Empty States

- Empty states must explain what is missing and provide a direct next action.
- Avoid generic placeholder copy.

## Typography Direction

- Use a clean, modern sans-serif with strong legibility at small mobile sizes.
- Keep a tight, stable hierarchy:
  - Page title
  - Section title
  - Primary data value
  - Supporting metadata
- Use monospaced or tabular number treatment where dense numeric alignment improves scan speed.

## Color and Token Direction

- All colors must come from theme tokens; no hardcoded colors in screen UI.
- Define semantic surfaces:
  - Background
  - Elevated surface
  - Border
  - Text primary/secondary
- Define semantic action and state tokens for primary/secondary/destructive/feedback states.
- Ensure contrast remains readable in both light and dark modes.

## Icon Usage Direction

- Use icons to reinforce actions, not replace labels.
- Keep icon style consistent across tabs, row actions, and feedback states.
- Destructive actions must pair icon plus explicit text.

## State Usage

- Neutral: default information and stable states.
- Success: completed save/export/backup actions.
- Warning: potential data risk, unsaved changes, non-blocking issues.
- Destructive: delete and irreversible operations.

State colors and messaging must be consistent across all screens.

## Consistency Rules

- No mixed interaction language for equivalent actions.
- No fake affordances (controls that look interactive but are not).
- No duplicate header patterns on a single screen.
- No hardcoded colors; tokens only.
- No one-off component variants without documented reason.

## Implementation Governance

- Follow the primitive-first implementation contract in [UI Governance](./ui-governance.md).
- Add or change behavior in `src/components/ui` first, then consume in screens.
- New screens must pass the migration checklist from the governance doc before merge.

## FleetFuel-Specific Visual Notes

- Vehicle cards:
  - Emphasize identifier, mileage snapshot, and quick actions.
- Trip rows:
  - Prioritize date, route purpose, distance, and private/business tag.
- Fuel entry rows:
  - Prioritize date, liters, total price, and odometer at refuel.
- Odometer/mileage emphasis:
  - Treat mileage values as high-importance data with strong numeric readability.
- Receipt/fuel evidence surfaces:
  - Evidence attachments must be clearly visible, openable, and status-indicated.

## What FleetFuel Should Feel Like

FleetFuel should feel like a dependable financial logbook on mobile: calm, precise, and trustworthy, with zero ambiguity about data, actions, and evidence.
