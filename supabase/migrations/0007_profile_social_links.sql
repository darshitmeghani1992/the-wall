-- ════════════════════════════════════════════════════════════════════════════
-- 0007 · MVP Batch C — Area D: Profile Social-Link Columns (FP-C2 Rev 2 / ADR-011)
--
-- Five additive nullable text columns on `profiles`. Governed entirely by the
-- EXISTING RLS (0001): world-readable via "profiles read" (0001:226-227),
-- self-write-only via "profiles update self" (0001:231-233). No new policy.
-- Format/URL validation is left to the client (a UX concern owned by
-- Frontend/Product); no DB CHECK at MVP (premature-constraint avoided).
-- Individual named columns (not a `social_links` jsonb) are chosen for
-- discoverability / naming-as-interface.
--
-- Additive and idempotent. Does NOT modify 0001/0002/0003. Build on top only.
-- ════════════════════════════════════════════════════════════════════════════
alter table profiles
  add column if not exists instagram text,
  add column if not exists tiktok    text,
  add column if not exists youtube   text,
  add column if not exists x         text,
  add column if not exists website   text;
