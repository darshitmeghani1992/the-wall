-- ════════════════════════════════════════════════════════════════════════════
-- 01_seed.sql · Deterministic fixtures for the SEC-001 harness.
--
-- Loaded as superuser (postgres) so seeding bypasses RLS; triggers still fire.
-- Fixed UUIDs so every test references rows without capturing generated ids.
--
-- Users:  A alice (requester)      11111111…
--         B bob   (addressee)      22222222…
--         C carol (blocked/other)  33333333…
--         O olivia(wall owner)     44444444…
--         D dan   (blocker)        55555555…
--         E eve   (blocked req.)   66666666…
--   [C2]  F frank (pending invitee)77777777…
--   [C2]  G grace (non-member/other)8888…      unrelated, non-blocked
-- Wall :  W_O  aaaaaaaa…  olivia's shared, public, contribution 'everyone'
--   [C2]  W_PS dddddddd…  olivia's shared, PRIVATE, contribution 'nobody'
-- Marks:  M_active  bbbb…b1  authored by A, active
--         M_pending bbbb…b2  authored by A, pending (approval-queue fixture)
-- Members[C2] on W_PS: B accepted, F pending (roster + gating fixtures)
-- ════════════════════════════════════════════════════════════════════════════

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','alice@test'),
  ('22222222-2222-2222-2222-222222222222','bob@test'),
  ('33333333-3333-3333-3333-333333333333','carol@test'),
  ('44444444-4444-4444-4444-444444444444','olivia@test'),
  ('55555555-5555-5555-5555-555555555555','dan@test'),
  ('66666666-6666-6666-6666-666666666666','eve@test'),
  ('77777777-7777-7777-7777-777777777777','frank@test'),   -- [C2] pending invitee
  ('88888888-8888-8888-8888-888888888888','grace@test');   -- [C2] non-member/other

insert into profiles (id, handle, display_name) values
  ('11111111-1111-1111-1111-111111111111','alice','Alice'),
  ('22222222-2222-2222-2222-222222222222','bob','Bob'),
  ('33333333-3333-3333-3333-333333333333','carol','Carol'),
  ('44444444-4444-4444-4444-444444444444','olivia','Olivia'),
  ('55555555-5555-5555-5555-555555555555','dan','Dan'),
  ('66666666-6666-6666-6666-666666666666','eve','Eve'),
  ('77777777-7777-7777-7777-777777777777','frank','Frank'),   -- [C2]
  ('88888888-8888-8888-8888-888888888888','grace','Grace');   -- [C2]
-- (profiles_personal_wall trigger creates one personal wall per user; ignored.)

-- Explicit shared test wall: public, contribution 'everyone', allows anonymous.
insert into walls (id, owner_id, type, name, visibility, contribution_policy, allow_anonymous, require_approval)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '44444444-4444-4444-4444-444444444444',
        'shared','Olivia''s Shared Wall','public','everyone', true, false);

-- Friendships:
--   A→B pending    (AC-S1 self-accept / AC-S2 accept / AC-S3 reverse-dup)
--   O↔C accepted   (AC-S5: block must override an accepted friendship)
insert into friendships (requester_id, addressee_id, status) values
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','pending'),
  ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','accepted');

-- Blocks:
--   O blocks C  (AC-S4 contribution denied; AC-S5 overrides O↔C friendship)
--   D blocks E  (AC-S5 friend request denied on a pair with NO friendship)
insert into blocks (blocker_id, blocked_id) values
  ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333'),
  ('55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666');

-- Marks authored by A on O's wall (moderation fixtures).
insert into marks (id, wall_id, author_id, type, text, anonymous, status) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111','text','active mark', false, 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111','text','pending mark', false, 'pending');

-- ── [C2] Batch-C fixtures (additive; existing fixtures above unchanged) ──────
-- Private SHARED wall owned by O. visibility 'private' + contribution 'nobody'
-- deliberately isolates ACCEPTED membership as the sole non-owner view/contribute
-- path, so 70_wall_members proves member-gating cleanly.
insert into walls (id, owner_id, type, name, visibility, contribution_policy, allow_anonymous, require_approval)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd',
        '44444444-4444-4444-4444-444444444444',
        'shared','Olivia''s Private Shared Wall','private','nobody', false, false);

-- Second private shared wall O owns, with NO members (F-B1 attack target): used by
-- 70 to prove an accepted member of W_PS cannot re-point their membership row's
-- wall_id at a wall they were never invited to.
insert into walls (id, owner_id, type, name, visibility, contribution_policy, allow_anonymous, require_approval)
values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        '44444444-4444-4444-4444-444444444444',
        'shared','Olivia''s Other Private Shared Wall','private','nobody', false, false);

-- Membership on W_PS: B accepted (view/contribute fixture), F pending (accept /
-- invite-notification fixture). O needs no membership row (owner via walls.owner_id).
insert into wall_members (wall_id, user_id, role, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','member','accepted'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd','22222222-2222-2222-2222-222222222222','member','accepted'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd','77777777-7777-7777-7777-777777777777','member','pending');

-- Accepted friendship A↔G (no block) → lets G contribute to A's PERSONAL wall
-- (contribution_policy 'friends'), which 80_notifications uses to exercise the
-- personal-wall `mark_left` kind (vs the shared-wall `shared_wall_mark` kind).
insert into friendships (requester_id, addressee_id, status) values
  ('11111111-1111-1111-1111-111111111111','88888888-8888-8888-8888-888888888888','accepted');
