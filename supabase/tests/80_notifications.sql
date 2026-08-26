-- ════════════════════════════════════════════════════════════════════════════
-- 80_notifications.sql · Area C (FP-C2 Rev 2 / ADR-010)
--
-- The five SECURITY DEFINER triggers populate `notifications` (which has NO client
-- insert policy) for the six Batch-C kinds. Proves each fires for the right
-- recipient/kind; that self-events are skipped; that an anonymous mark's actor is
-- NULL (no de-anon) and a reaction on an anonymous mark notifies the TRUE author
-- without de-anonymizing the base row; and that the kind CHECK rejects an
-- out-of-vocabulary value.
--
-- Idiom note: the triggering action runs as the acting authenticated user (so the
-- SECURITY DEFINER trigger sees the correct auth.uid()); the VERIFICATION runs
-- after `reset role` (superuser, RLS-bypassing) because "notifications view own"
-- (0001) would otherwise hide a row addressed to a DIFFERENT recipient — which
-- would both false-fail the positive checks and false-pass the skip-self checks.
-- Assertions are scoped to fresh, test-created ids so committed seed-time
-- notifications never interfere. All inline, then ROLLBACK.
-- Fixtures: W_O aaaa… (public shared), W_PS dddd… (private shared), M_active bbbb…b1.
-- A=1111 B=2222 D=5555 O=4444 G=8888.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── shared_wall_mark: A posts on O's public SHARED wall → O notified ─────────
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
insert into marks (id, wall_id, author_id, type, text)
values ('cccccccc-cccc-cccc-cccc-cccccccccc80',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111','text','hi olivia');
reset role;
do $$
begin
  if (select count(*) from notifications where mark_id = 'cccccccc-cccc-cccc-cccc-cccccccccc80') <> 1 then
    raise exception '80 FAIL: shared_wall_mark did not create exactly one notification';
  end if;
  if not exists (select 1 from notifications
                 where mark_id = 'cccccccc-cccc-cccc-cccc-cccccccccc80'
                   and user_id = '44444444-4444-4444-4444-444444444444'   -- O (owner)
                   and kind = 'shared_wall_mark'
                   and actor_id = '11111111-1111-1111-1111-111111111111') then  -- A
    raise exception '80 FAIL: shared_wall_mark recipient/kind/actor wrong';
  end if;
end $$;
ROLLBACK;
\echo '80 (shared_wall_mark)              : PASS  (owner notified, actor = author)'

-- ── mark_left: G posts on A's PERSONAL wall (G is A's friend) → A notified ────
BEGIN;
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';   -- G (friend of A)
insert into marks (id, wall_id, author_id, type, text)
values ('cccccccc-cccc-cccc-cccc-cccccccccc81',
        (select id from walls where owner_id = '11111111-1111-1111-1111-111111111111' and type = 'personal'),
        '88888888-8888-8888-8888-888888888888','text','hi alice');
reset role;
do $$
begin
  if not exists (select 1 from notifications
                 where mark_id = 'cccccccc-cccc-cccc-cccc-cccccccccc81'
                   and user_id = '11111111-1111-1111-1111-111111111111'   -- A (owner)
                   and kind = 'mark_left'
                   and actor_id = '88888888-8888-8888-8888-888888888888') then  -- G
    raise exception '80 FAIL: mark_left recipient/kind/actor wrong';
  end if;
end $$;
ROLLBACK;
\echo '80 (mark_left, personal wall)      : PASS  (owner notified, kind by walls.type)'

-- ── skip-self: O posts on O's own wall → NO notification ─────────────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O (owner posts on own wall)
insert into marks (id, wall_id, author_id, type, text)
values ('cccccccc-cccc-cccc-cccc-cccccccccc82',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '44444444-4444-4444-4444-444444444444','text','my own wall');
reset role;
do $$
begin
  if (select count(*) from notifications where mark_id = 'cccccccc-cccc-cccc-cccc-cccccccccc82') <> 0 then
    raise exception '80 FAIL: owner posting on own wall notified themselves';
  end if;
end $$;
ROLLBACK;
\echo '80 (mark skip-self)                : PASS  (no self-notification)'

-- ── anon mark → actor_id NULL (no de-anon via the mark trigger) ──────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';   -- G posts ANON on A's wall
insert into marks (id, wall_id, author_id, type, text, anonymous)
values ('cccccccc-cccc-cccc-cccc-cccccccccc83',
        (select id from walls where owner_id = '11111111-1111-1111-1111-111111111111' and type = 'personal'),
        '88888888-8888-8888-8888-888888888888','text','anon hi', true);
reset role;
do $$
begin
  if not exists (select 1 from notifications
                 where mark_id = 'cccccccc-cccc-cccc-cccc-cccccccccc83'
                   and user_id = '11111111-1111-1111-1111-111111111111'
                   and kind = 'mark_left'
                   and actor_id is null) then
    raise exception '80 FAIL: anon mark notification did not carry actor_id NULL';
  end if;
end $$;
ROLLBACK;
\echo '80 (anon mark actor NULL)          : PASS  (mark trigger cannot de-anonymize)'

-- ── reaction: G reacts to A's mark → A (author) notified, actor = G ──────────
BEGIN;
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';   -- G
insert into mark_reactions (mark_id, user_id, emoji)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','88888888-8888-8888-8888-888888888888','🔥');
reset role;
do $$
begin
  if (select count(*) from notifications
        where mark_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1' and kind = 'reaction') <> 1 then
    raise exception '80 FAIL: reaction did not create exactly one notification';
  end if;
  if not exists (select 1 from notifications
                 where mark_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
                   and kind = 'reaction'
                   and user_id = '11111111-1111-1111-1111-111111111111'   -- A (author)
                   and actor_id = '88888888-8888-8888-8888-888888888888') then  -- G (reactor)
    raise exception '80 FAIL: reaction recipient/actor wrong';
  end if;
end $$;
ROLLBACK;
\echo '80 (reaction)                      : PASS  (author notified, actor = reactor)'

-- ── reaction skip-self: A reacts to A's own mark → NO notification ───────────
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A reacts to own mark
insert into mark_reactions (mark_id, user_id, emoji)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','11111111-1111-1111-1111-111111111111','👏');
reset role;
do $$
begin
  if (select count(*) from notifications
        where mark_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1' and kind = 'reaction') <> 0 then
    raise exception '80 FAIL: self-reaction produced a notification';
  end if;
end $$;
ROLLBACK;
\echo '80 (reaction skip-self)            : PASS  (no self-reaction notification)'

-- ── reaction on an ANONYMOUS mark → TRUE author notified, base row NOT de-anon ─
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A posts anon
insert into marks (id, wall_id, author_id, type, text, anonymous)
values ('cccccccc-cccc-cccc-cccc-cccccccccc84',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111','text','anon mark', true);
reset role;
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';   -- G reacts
insert into mark_reactions (mark_id, user_id, emoji)
values ('cccccccc-cccc-cccc-cccc-cccccccccc84','88888888-8888-8888-8888-888888888888','❤️');
reset role;
do $$
begin
  -- base row must still hide the author (no de-anon)
  if (select author_id from marks where id = 'cccccccc-cccc-cccc-cccc-cccccccccc84') is not null then
    raise exception '80 FAIL: reaction path de-anonymized the base mark row';
  end if;
  -- the TRUE author (A, resolved from anonymous_mark_authors) is notified
  if not exists (select 1 from notifications
                 where mark_id = 'cccccccc-cccc-cccc-cccc-cccccccccc84'
                   and kind = 'reaction'
                   and user_id = '11111111-1111-1111-1111-111111111111'   -- A (true author)
                   and actor_id = '88888888-8888-8888-8888-888888888888') then  -- G
    raise exception '80 FAIL: reaction on anon mark did not notify the true author';
  end if;
end $$;
ROLLBACK;
\echo '80 (reaction on anon mark)         : PASS  (true author notified; base row still anon)'

-- ── friend_request: B requests D → D notified, actor = B ─────────────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B
insert into friendships (requester_id, addressee_id, status)
values ('22222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555555','pending');
reset role;
do $$
begin
  if (select count(*) from notifications
        where user_id = '55555555-5555-5555-5555-555555555555' and kind = 'friend_request') <> 1 then
    raise exception '80 FAIL: friend_request did not create exactly one notification for D';
  end if;
  if not exists (select 1 from notifications
                 where user_id = '55555555-5555-5555-5555-555555555555'   -- D (addressee)
                   and kind = 'friend_request'
                   and actor_id = '22222222-2222-2222-2222-222222222222') then  -- B (requester)
    raise exception '80 FAIL: friend_request recipient/actor wrong';
  end if;
end $$;
ROLLBACK;
\echo '80 (friend_request)                : PASS  (addressee notified, actor = requester)'

-- ── friend_accepted: B accepts A''s pending request → A notified, actor = B ───
BEGIN;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (addressee accepts)
update friendships set status = 'accepted'
 where requester_id = '11111111-1111-1111-1111-111111111111'
   and addressee_id = '22222222-2222-2222-2222-222222222222';
reset role;
do $$
begin
  if (select count(*) from notifications
        where user_id = '11111111-1111-1111-1111-111111111111' and kind = 'friend_accepted') <> 1 then
    raise exception '80 FAIL: friend_accepted did not create exactly one notification for A';
  end if;
  if not exists (select 1 from notifications
                 where user_id = '11111111-1111-1111-1111-111111111111'   -- A (requester)
                   and kind = 'friend_accepted'
                   and actor_id = '22222222-2222-2222-2222-222222222222') then  -- B (accepter)
    raise exception '80 FAIL: friend_accepted recipient/actor wrong';
  end if;
end $$;
ROLLBACK;
\echo '80 (friend_accepted)               : PASS  (requester notified, actor = accepter)'

-- ── shared_wall_invite: O invites G to W_PS → G notified, actor = O ──────────
BEGIN;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';   -- O (owner invites)
insert into wall_members (wall_id, user_id, role, status)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd','88888888-8888-8888-8888-888888888888','member','pending');
reset role;
do $$
begin
  if (select count(*) from notifications
        where user_id = '88888888-8888-8888-8888-888888888888' and kind = 'shared_wall_invite') <> 1 then
    raise exception '80 FAIL: shared_wall_invite did not create exactly one notification for G';
  end if;
  if not exists (select 1 from notifications
                 where user_id = '88888888-8888-8888-8888-888888888888'   -- G (invitee)
                   and kind = 'shared_wall_invite'
                   and actor_id = '44444444-4444-4444-4444-444444444444'   -- O (owner)
                   and wall_id  = 'dddddddd-dddd-dddd-dddd-dddddddddddd') then
    raise exception '80 FAIL: shared_wall_invite recipient/actor/wall wrong';
  end if;
end $$;
ROLLBACK;
\echo '80 (shared_wall_invite)            : PASS  (invitee notified, actor = owner)'

-- ── kind vocabulary CHECK rejects an out-of-vocabulary value ─────────────────
BEGIN;
reset role;   -- superuser: bypass RLS + own the table, so we hit the CHECK, not a grant
do $$
declare rejected boolean := false;
begin
  begin
    insert into notifications (user_id, kind)
    values ('11111111-1111-1111-1111-111111111111','bogus_kind');
  exception when check_violation then rejected := true;   -- notifications_kind_ck
  end;
  if not rejected then raise exception '80 FAIL: out-of-vocabulary notification kind was accepted'; end if;
end $$;
ROLLBACK;
\echo '80 (kind CHECK)                    : PASS  (out-of-vocabulary kind rejected)'

\echo '── 80_notifications: ALL PASS (5 triggers + skip-self + no-leak + kind CHECK) ──'
