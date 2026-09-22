# 05 · Database

This file is a navigation summary, not a duplicate schema specification. The ordered files in
`supabase/migrations/` are the executable database source of truth; the security suite in
`supabase/tests/` is the executable authorization contract. Never apply only `0001_init.sql` or
use this summary to recreate a hosted environment.

## Current stable boundaries

- One Personal Wall is created per profile; users may also own and join Shared Walls.
- Wall visibility and contribution permission are separate and enforced on the server.
- Canonical Mark content types are `text`, `photo`, `voice`, and `video`.
- Anonymous and Secret are modes. Secret payloads use their restricted one-time lifecycle and are
  never copied into ordinary Mark or notification payloads.
- Comments, polls, awards, predictions, doodles, and games are excluded from the MVP. Legacy
  prototype tables or enum values may remain for migration compatibility but are not active
  product contracts.
- Friendships, follows, approved writers, blocking, reactions, Alerts, reports, Shared Wall
  membership, moderation, and account lifecycle are server-authorized.
- Client mutations that can cross an account switch are bound to the expected authenticated actor.
- Mark media uses the private protected-media design in ADR-012. The public `attachments` bucket is
  not a supported Mark-media path; retained avatar use follows the current migrations and runbooks.
- Recoverable account deletion is defined by migration `0031` and its product/architecture
  artifacts. Hosted application and scheduler configuration remain separate release gates.

## Authoritative references

- Product behavior: `THE_WALL_MASTER_BUILD_SPEC_v1.1.md`
- Ordered schema and RLS: `supabase/migrations/`
- Executable database verification: `supabase/tests/run_tests.sh`
- Protected media: `docs/architecture/ADR-012-protected-mark-media.md`
- Deferred destinations: `docs/architecture/ADR-013-durable-deferred-destination.md`
- Recoverable deletion: `docs/architecture/FP-ACL-002-recoverable-account-deletion.md`
- Current evidence boundary: `docs/BUILD_STATUS.md`

Any schema change must be an additive-first migration, receive the applicable Two-Key review, pass
the full database security suite and replay checks, and remain unapplied to hosted environments
until separately authorized.
