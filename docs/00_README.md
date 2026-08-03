# The Wall — Documentation

Product-grade specification for **The Wall** (Social Wall): a native app where a
person's identity is written by the people around them — friends leave **Marks**
(sticky, roast, secret, memory, photo, award, poll, doodle, prediction) on a
personal **Wall**.

> **Personal Wall = My Story.** Shared Wall = Our Story (later version).

## How these docs relate

| # | Doc | Answers |
|---|---|---|
| 01 | [Product Spec](01_Product_Spec.md) | *What* are we building and why |
| 02 | [User Flows](02_User_Flows.md) | *How* a user moves through each screen |
| 03 | [Acceptance Criteria](03_Acceptance_Criteria.md) | *When* a feature is correct |
| 04 | [Edge Cases & Errors](04_Edge_Cases_and_Errors.md) | *What can go wrong* and the intended behavior |
| 05 | [Database](05_Database.md) | Tables, RLS, triggers |
| 06 | [Tech Architecture](06_Tech_Architecture.md) | App structure, data layer, games-as-plugins |
| 07 | [Engineering Plan](07_Engineering_Plan.md) | Build order (screen-by-screen) + status |
| 08 | [AI Coding Rules](08_AI_Coding_Rules.md) | Rules every contributor/agent follows |
| 09 | [Definition of Done](09_Definition_of_Done.md) | The gate every feature passes |
| 10 | [Analytics](10_Analytics.md) | Events we track *(living)* |
| 11 | [Performance](11_Performance.md) | Budgets & targets *(living)* |
| 12 | [Security](12_Security.md) | Abuse, privacy, hardening *(living)* |
| 13 | [Release Checklist](13_Release_Checklist.md) | Ship steps *(living)* |
| 14 | [Changelog](14_Changelog.md) | Version-per-feature log *(living)* |

**Core docs (01–09)** are the source of truth and should be kept current.
**Living docs (10–14)** are filled in as each feature ships.

## Conventions

- **Terminology:** a *Mark* is any post on a wall. A *Wall* is owned by exactly
  one user (Personal) — Shared Walls are a later version. A *contributor* can
  leave marks; a *viewer* can only read.
- **Statuses of a Mark:** `active` (visible), `pending` (awaiting owner
  approval), `hidden` (soft-removed), `removed`.
- **IDs & paths** reference this repo — a standalone Expo app (app code at the
  repo root, docs in `docs/`, database in `supabase/`).
- Docs use present tense and describe intended behavior; if code and docs
  disagree, that's a bug in one of them — fix and note it in `14_Changelog.md`.

## Tech at a glance

Native **Expo (React Native)** + **Supabase** (Postgres, Auth, Realtime,
Storage). See `06_Tech_Architecture.md`. This is a standalone repository with its
own Supabase project.
