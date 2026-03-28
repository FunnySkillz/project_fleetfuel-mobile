# FleetFuel MVP Definition

Last updated: 2026-03-28

## Purpose

Define FleetFuel MVP scope in strict terms and prevent scope creep before implementation starts.

## Product Summary

FleetFuel is a mobile-first app for private and self-employed users to track vehicles, trips, fuel events, mileage, and receipts with a clean local workflow. MVP is fully local-first and offline-first with no backend dependency.

## Problem Statement

Users currently track trips, fuel, odometer events, and receipts manually across notes, spreadsheets, and files. This creates fragmented records, missing evidence, and painful export/backup workflows. FleetFuel MVP replaces this with one local mobile workflow.

## Target Users (MVP)

- Private user managing one vehicle.
- Freelancer or self-employed user tracking personal and business usage.
- Single-vehicle owner with regular trip and fuel logging needs.
- Small manual fleet use case where one person records multiple vehicles on one device without backend sync.

## Explicit Non-Goals (MVP)

- No company admin system.
- No online sync.
- No role management.
- No shared vehicle access.
- No rental/company invitation workflows.
- No live collaborative data.
- No backend API integration.

## Core MVP Entities

| Entity | MVP Role |
| --- | --- |
| Vehicle | Central object for trip, fuel, and odometer records. |
| Trip | Manual movement log tied to one vehicle. |
| FuelEntry | Fuel purchase/refuel event tied to one vehicle. |
| Attachment/Receipt | Photo or PDF evidence linked to trip/fuel events as needed. |
| Odometer/Mileage Event | Manual mileage checkpoints and corrections. |
| Export | Local file output for reporting and sharing. |
| App Settings | Preferences for app behavior, display, and data utilities (backup/restore). |

## Core MVP Features

- Create and manage vehicles.
- Log trips.
- Log fuel entries.
- Attach receipt photos/PDFs.
- Capture odometer values manually.
- Export records locally.
- Backup and restore local data.

## Suggested Trip Fields

- Vehicle
- Date/time
- Start odometer
- End odometer
- Distance
- Purpose
- Private/business tag
- Optional notes
- Optional start location text
- Optional end location text

Notes:
- No live GPS tracking in MVP.
- Location fields are text only.

## Suggested Fuel Entry Fields

- Vehicle
- Date
- Liters
- Total price
- Fuel type
- Station/vendor
- Odometer at refuel
- Receipt attachment
- Notes

## MVP Screens and Route Map

| Screen | Sample Route | Route Type |
| --- | --- | --- |
| Home/Dashboard | `/` | read-only |
| Vehicles | `/vehicles` | read-only |
| Vehicle Detail | `/vehicles/[vehicleId]` | read-only |
| Add Trip | `/trips/new` | mutable |
| Add Fuel Entry | `/fuel/new` | mutable |
| Entry Detail/Edit | `/entries/[entryId]` or `/entries/[entryId]/edit` | read-only or mutable |
| Export | `/export` | mutable |
| Settings | `/settings` and `/settings/*` | read-only or mutable by subroute |

## Navigation Concept (MVP)

- Root navigation is tab-based for primary sections: Home, Vehicles, Export, Settings.
- Detail routes are pushed from list routes to preserve native back/swipe-back behavior.
- Every route is classified before implementation:
  - `read-only`: frictionless back and swipe-back when history exists.
  - `mutable`: unsaved-changes guard required on exit.
- Create/edit flows are stack routes, never modal-only dead ends.

## MVP Success Criteria (Gate-Style)

- Core local flows work fully offline: vehicle create/edit, trip add/edit, fuel add/edit, receipt attach, export, backup/restore.
- Users can complete trip and fuel logging without backend account setup.
- Read-only routes support predictable back navigation and iOS swipe-back.
- Mutable routes block accidental exit when unsaved changes exist.
- Export destination is explicit to the user, and files can be opened/shared.
- Backup ZIP and restore path are understandable and usable without technical steps.

## Deferred Future Platform Scope (Not MVP)

- Company admin workspace.
- Driver roles and account permissions.
- Invited users.
- Company fleet management across users/devices.
- Shared vehicle ownership flows.
- Rental workflows.
- Online reporting dashboards.
- Cloud sync services and conflict resolution.

## MVP Boundary (Decision Lock)

| IN MVP NOW | DEFERRED TO FUTURE PLATFORM |
| --- | --- |
| Local-only data model and offline operation | Any backend-hosted data |
| Single-device usage model | Multi-user collaboration |
| Manual entry for trips/fuel/odometer | Automated telematics/live tracking |
| Local export and backup/restore | Role-based reporting portals |
| Settings for local behavior | Company onboarding/invitation workflows |

Boundary rule:
- If a feature requires internet for core operation, user identity roles, shared access, or server-side processing, it is out of MVP scope.

