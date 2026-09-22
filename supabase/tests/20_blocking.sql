-- ════════════════════════════════════════════════════════════════════════════
-- 20_blocking.sql · AC-S4, AC-S5  (F3, G-B)
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── AC-S4: blocked user contributes a Mark to the other's wall → DENIED ──────
-- O blocks C; C attempts to post to O's wall (contribution_policy 'everyone').
BEGIN;
reset role;
do $$ declare wid uuid; begin
  update walls set visibility='public', contribution_policy='everyone'
    where owner_id='44444444-4444-4444-4444-444444444444' and type='personal'
    returning id into strict wid;
  perform set_config('test.wall20_blocked',wid::text,true);
end $$;
set local role authenticated;
set local "test.uid" = '33333333-3333-3333-3333-333333333333';   -- C (blocked by O)
do $$
declare result jsonb;
begin
  result := create_mark(
    '20000000-0000-4000-8000-000000000001',
    current_setting('test.wall20_blocked')::uuid,
    'text', 'sneaky', null, false, false, 0, '{}'::uuid[]
  );
  if result->>'status' <> 'unavailable' then
    raise exception 'AC-S4 FAIL: blocked contribution returned %', result;
  end if;
end $$;
ROLLBACK;
\echo 'AC-S4 (blocked contribution)       : PASS  (denied even on an ''everyone'' wall)'

-- ── AC-S5: interaction eligibility for a blocked pair → all DENIED ───────────
-- Part 1: block overrides an accepted friendship + contribution eligibility.
BEGIN;
reset role; -- protected contract-level verification; app cannot call these predicates
do $$
begin
  if are_friends('44444444-4444-4444-4444-444444444444',
                 '33333333-3333-3333-3333-333333333333') then
    raise exception 'AC-S5 FAIL: are_friends true despite a block (override failed)';
  end if;
  if not is_blocked('44444444-4444-4444-4444-444444444444',
                    '33333333-3333-3333-3333-333333333333') then
    raise exception 'AC-S5 FAIL: is_blocked returned false for a blocked pair';
  end if;
  if can_contribute('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                    '33333333-3333-3333-3333-333333333333') then
    raise exception 'AC-S5 FAIL: blocked user is contribution-eligible';
  end if;
end $$;
ROLLBACK;
\echo 'AC-S5 (block overrides friendship) : PASS  (are_friends/is_blocked/can_contribute)'

-- Part 2: block denies a NEW friend request (pair with no prior friendship).
-- D blocks E; E attempts to request D.
BEGIN;
set local role authenticated;
set local "test.uid" = '66666666-6666-6666-6666-666666666666';   -- E (blocked by D)
do $$
declare denied boolean := false;
begin
  begin
    insert into friendships (requester_id, addressee_id, status)
    values ('66666666-6666-6666-6666-666666666666',
            '55555555-5555-5555-5555-555555555555','pending');
  exception when others then denied := true;  -- insert policy: not is_blocked(...) fails
  end;
  if not denied then raise exception 'AC-S5 FAIL: blocked friend request was allowed'; end if;
end $$;
ROLLBACK;
\echo 'AC-S5 (blocked friend request)     : PASS  (request denied for a blocked pair)'

\echo '── 20_blocking: ALL PASS (AC-S4, AC-S5) ──'
