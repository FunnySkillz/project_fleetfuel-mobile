# FleetFuel Lessons Learned (Pre-Implementation V1)

Last updated: 2026-03-28

## Purpose

Carry forward the strongest engineering lessons from SteuerFuchs before FleetFuel implementation begins, so we prevent known failure patterns instead of fixing them late.

## 1) Navigation Ownership Must Be Explicit

**Struggle**
- Mixed header ownership patterns caused spacing and back-navigation inconsistency.

**Lesson learned**
- Each route must have one clear header owner.

**Action for FleetFuel**
- Use native stack header by default for stack routes.
- Allow custom in-content header only when native header is intentionally disabled.

## 2) Read-Only vs Mutable Route Behavior Must Be Decided Early

**Struggle**
- Read-only and edit/create flows were treated similarly, causing friction and accidental exits.

**Lesson learned**
- Route behavior is not optional styling; it is navigation safety policy.

**Action for FleetFuel**
- Classify every route as `read-only` or `mutable` before implementation.
- Keep read-only routes frictionless.
- Enforce unsaved-changes guards on mutable routes.

## 3) Safe-Area and Inset Ownership Must Be Standardized

**Struggle**
- Inconsistent safe-area and content inset handling led to iOS layout drift.

**Lesson learned**
- Spacing ownership must be standardized once and reused everywhere.

**Action for FleetFuel**
- Apply one documented safe-area and scroll inset pattern on all stack screens.
- Treat top-spacing regressions as QA blockers.

## 4) Export Destination Must Always Be Discoverable

**Struggle**
- Generated files existed, but users were unsure where to find/open/share them.

**Lesson learned**
- File output without clear destination UX is incomplete.

**Action for FleetFuel**
- Always show destination context after export.
- Always provide immediate open/share affordance for generated files.

## 5) Platform Differences Must Be Designed Up-Front

**Struggle**
- iOS and Android differences in back behavior and file flows caused late rework.

**Lesson learned**
- Platform constraints must be part of design, not post-implementation patch work.

**Action for FleetFuel**
- Include platform-specific acceptance criteria in navigation and release QA docs before coding.

## 6) UI Consistency Must Be Treated as a System Requirement

**Struggle**
- Similar actions were presented with inconsistent labels, affordances, and visual weight.

**Lesson learned**
- Consistency is product trust infrastructure, not cosmetic polish.

**Action for FleetFuel**
- Define shared interaction language for buttons, headers, destructive actions, and list row behaviors.
- Block merges that introduce duplicate or conflicting patterns.

## 7) QA Must Be Continuous, Not Only Final

**Struggle**
- Defects were detected too late because visual/navigation QA happened only near release.

**Lesson learned**
- QA timing is as important as QA coverage.

**Action for FleetFuel**
- Run navigation/layout and state QA while features are built.
- Keep QA docs updated in the same change set as behavior changes.

## 8) Stable Test Scaffolding Matters Early

**Struggle**
- Test instability created noise unrelated to feature quality.

**Lesson learned**
- Stable test scaffolding is part of delivery speed.

**Action for FleetFuel**
- Establish baseline test harness patterns early for navigation, file utilities, and stateful flows.
- Maintain shared mocks for app-wide dependencies.

## Summary Rules We Keep

- Decide route class (`read-only` vs `mutable`) before building screens.
- Keep single header ownership per screen.
- Standardize safe-area and inset ownership across stack routes.
- Make export and backup destinations explicit and user-discoverable.
- Design for platform differences up front.
- Enforce visual and interaction consistency as a system rule.
- Run QA continuously during implementation.
- Protect team velocity with stable test scaffolding early.

