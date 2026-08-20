# 15 · Engineering Workflow (single source of truth)

How we build The Wall as an AI-first team. This is **the** workflow doc — if a
process question isn't answered here (or in `07`/`08`/`09`), it isn't policy yet.

## Philosophy

AI accelerates implementation; a human provides direction, judgment, and quality
control. Treat AI as a set of *roles/concerns* to satisfy on every change —
product, architecture, frontend, backend, QA, security, performance, review — not
seven separate ceremonies. The founder is the CTO: define the product, break work
down, give clear requirements, review output, verify it works, keep architecture
clean.

## Scale the process to the change (lean vs full)

Don't run 16 phases for a one-screen slice. Match ceremony to size:

- **Lean (default — small slices, one screen/component):** clarify intent →
  build → wire workflow (real Supabase under RLS) → **CI green** → preview → your
  on-device check → merge. Phases below collapse into a paragraph.
- **Full (large/architectural features — e.g. Shared Walls, payments, games
  platform):** run the whole lifecycle, with explicit spec, architecture, DB/API
  design, and review gates.

## The pipeline

```
Idea → Spec (01/03) → Design → Components → DB design (05) → API/contract
     → Build (one responsibility at a time) → CI (type-check + lint)
     → On-device test → DB verify → Manual QA (03 criteria) → Review
     → Merge → EAS build → Beta (TestFlight / Play internal) → Production → Monitor
```

**CI is an explicit stage.** Every PR runs `.github/workflows/ci.yml`
(type-check + lint) and must be **green before merge** — the automated half of
review/QA. It gates every commit; the human on-device pass gates the merge.

## Who runs what (division of labor)

| Stage | Owner |
|---|---|
| Spec, architecture, DB/API design, **code + migrations**, docs | **AI agent** |
| Type-check + lint (**CI**), design previews | **AI agent** (automated/visual) |
| Run the app (Expo Go / simulators), **on-device QA** | **Founder / dev** |
| **Database verification** (Supabase dashboard/SQL) | **Founder / dev** |
| **EAS build**, TestFlight / Play, store submission | **Founder / dev** |
| Product decisions, prioritization, final sign-off | **Founder** |

The agent never claims a device/DB/store step is "verified" — those are the
founder's checkpoints, cleared using what the agent hands over.

## Testing policy (MVP-practical)

- **Mandatory every feature:** type-check clean, lint clean, **manual QA** against
  the feature's acceptance criteria (`03`).
- **Lightweight unit tests** for **core business logic** (`src/lib/*` — mark
  building, permissions helpers, validation). Jest + React Native Testing Library.
- **Broaden as the product matures:** component tests, then **E2E** (Maestro) for
  the core loops (sign-in, leave-a-mark, friend request). Not required for MVP.

## Feature flags

Risky or incomplete features ship **behind a flag** (PostHog feature flags), so
they can be dark-launched, rolled out gradually, or killed without a redeploy.
Default new user-facing surfaces to off until validated.

## Environments & secrets

- **Two environments:** `dev` and `prod`, each its **own Supabase project**.
- Client config via `EXPO_PUBLIC_*` (safe: anon key only). Server-only secrets
  (service-role key, moderation API keys) live in **EAS secrets / Edge Function
  env**, never in the app bundle or git.
- Migrations run against `dev` first, then `prod` on release. See `05`, `06`.

## Hotfix & rollback

- **JS-only regression:** ship an **EAS Update (OTA)** to the affected channel;
  if bad, **roll back to the previous OTA** immediately. No store review needed.
- **Native/build regression:** revert the offending commit (`git revert`), CI
  green, new EAS build; halt the rollout in App Store Connect / Play Console.
- **Bad migration:** never destructive-migrate in one step — additive first, then
  backfill, then remove. Keep a down/forward-fix path; prefer a new corrective
  migration over editing a shipped one.
- Every hotfix gets a `14_Changelog` entry and, if user-visible, a flag.

## Definition of Done

See **`09_Definition_of_Done.md`** — the single DoD. A feature is done only when
it clears those gates (including CI green and the founder's on-device pass).
