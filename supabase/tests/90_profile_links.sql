-- ════════════════════════════════════════════════════════════════════════════
-- 90_profile_links.sql · Area D (FP-C2 Rev 2 / ADR-011)
--
-- Five additive nullable link columns on `profiles`, governed by the EXISTING RLS:
--   • a user updates their OWN link columns and they persist
--   • a different user's update of those columns affects 0 rows ("profiles update
--     self" USING id = auth.uid())
--   • the columns read back world-readable ("profiles read" using(true))
-- A = 1111 (owner of the links), B = 2222 (the other user).
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

BEGIN;
-- A sets all five of their own social links.
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
update profiles set
  instagram = '@alice_ig',
  tiktok    = '@alice_tt',
  youtube   = 'alicetube',
  x         = '@alice_x',
  website   = 'https://alice.example'
 where id = '11111111-1111-1111-1111-111111111111';
do $$
begin
  if not exists (select 1 from profiles
                 where id = '11111111-1111-1111-1111-111111111111'
                   and instagram = '@alice_ig' and tiktok = '@alice_tt'
                   and youtube = 'alicetube' and x = '@alice_x'
                   and website = 'https://alice.example') then
    raise exception '90 FAIL: self-update of social links did not persist';
  end if;
end $$;
\echo '90 (self-update persists)          : PASS  (all five columns writable by owner)'

-- B cannot update A's links (RLS "profiles update self" → 0 rows).
reset role;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (a different user)
do $$
begin
  update profiles set instagram = '@hacked'
   where id = '11111111-1111-1111-1111-111111111111';   -- filtered out by RLS USING → 0 rows
  if (select instagram from profiles where id = '11111111-1111-1111-1111-111111111111') <> '@alice_ig' then
    raise exception '90 FAIL: another user overwrote A''s social link';
  end if;
end $$;
\echo '90 (other-user update denied)      : PASS  (self-write-only; 0 rows affected)'

-- Links are world-readable (B reads A's links).
do $$
begin
  if (select website from profiles where id = '11111111-1111-1111-1111-111111111111')
     is distinct from 'https://alice.example' then
    raise exception '90 FAIL: social link columns are not world-readable';
  end if;
end $$;
\echo '90 (world-readable)                : PASS  ("profiles read" exposes the columns)'
ROLLBACK;

\echo '── 90_profile_links: ALL PASS (self-write / other-denied / world-read) ──'
