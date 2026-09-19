-- ════════════════════════════════════════════════════════════════════════════
-- 10_friendships.sql · AC-S1 (BOTH vectors), AC-S2, AC-S3  (F1/F2, G-C/G-D)
--
-- Idiom: per-test BEGIN; set local role …; set local "test.uid" …; …; ROLLBACK
-- so auth.uid() stays set for the whole transaction. Expected-denials are caught
-- in a DO block (`denied` flag / final-state assert); unexpected success RAISES.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── AC-S1 vector (1): requester self-accept via UPDATE → DENIED ──────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A (requester)
do $$
begin
  begin
    update friendships set status = 'accepted'
     where requester_id = '11111111-1111-1111-1111-111111111111'
       and addressee_id = '22222222-2222-2222-2222-222222222222';
  exception when others then null;  -- transition trigger raises; expected
  end;
  if exists (select 1 from friendships
             where requester_id = '11111111-1111-1111-1111-111111111111'
               and addressee_id = '22222222-2222-2222-2222-222222222222'
               and status = 'accepted') then
    raise exception 'AC-S1 FAIL: requester self-accept (UPDATE) succeeded';
  end if;
end $$;
ROLLBACK;
\echo 'AC-S1 (UPDATE self-accept)         : PASS  (denied; request stays pending)'

-- ── AC-S1 vector (2): requester INSERT-as-accepted → DENIED ──────────────────
-- Uses a fresh pair (A→C: no existing row, no block) to isolate the status pin.
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
do $$
declare denied boolean := false;
begin
  begin
    insert into friendships (requester_id, addressee_id, status)
    values ('11111111-1111-1111-1111-111111111111',
            '33333333-3333-3333-3333-333333333333','accepted');
  exception when others then denied := true;  -- RLS WITH CHECK status='pending' fails
  end;
  if not denied then raise exception 'AC-S1 FAIL: INSERT-as-accepted was allowed'; end if;
  if exists (select 1 from friendships
             where requester_id = '11111111-1111-1111-1111-111111111111'
               and addressee_id = '33333333-3333-3333-3333-333333333333'
               and status = 'accepted') then
    raise exception 'AC-S1 FAIL: accepted row created via INSERT';
  end if;
end $$;
ROLLBACK;
\echo 'AC-S1 (INSERT-as-accepted)         : PASS  (denied by status=pending pin)'

-- ── G-C positive: requester MAY create a pending request ─────────────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
do $$
begin
  insert into friendships (requester_id, addressee_id, status)
  values ('11111111-1111-1111-1111-111111111111',
          '33333333-3333-3333-3333-333333333333','pending');
  if not exists (select 1 from friendships
                 where requester_id = '11111111-1111-1111-1111-111111111111'
                   and addressee_id = '33333333-3333-3333-3333-333333333333'
                   and status = 'pending') then
    raise exception 'G-C FAIL: valid pending request not created';
  end if;
end $$;
ROLLBACK;
\echo 'G-C  (pending request allowed)     : PASS  (honest path unblocked)'

-- ── AC-S2: addressee accepts → SUCCEEDS ──────────────────────────────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (addressee)
do $$
begin
  update friendships set status = 'accepted'
   where requester_id = '11111111-1111-1111-1111-111111111111'
     and addressee_id = '22222222-2222-2222-2222-222222222222';
  if not exists (select 1 from friendships
                 where requester_id = '11111111-1111-1111-1111-111111111111'
                   and addressee_id = '22222222-2222-2222-2222-222222222222'
                   and status = 'accepted') then
    raise exception 'AC-S2 FAIL: addressee accept did not persist';
  end if;
end $$;
ROLLBACK;
\echo 'AC-S2 (addressee accept)           : PASS  (request becomes accepted)'

-- ── AC-S3: reverse-duplicate pair → PREVENTED ────────────────────────────────
-- A→B pending already exists; B attempts to insert the reverse B→A.
BEGIN;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B
do $$
declare denied boolean := false;
begin
  begin
    insert into friendships (requester_id, addressee_id, status)
    values ('22222222-2222-2222-2222-222222222222',
            '11111111-1111-1111-1111-111111111111','pending');
  exception when others then denied := true;  -- friendships_pair_uniq violation
  end;
  if not denied then raise exception 'AC-S3 FAIL: reverse-duplicate pair allowed'; end if;
end $$;
ROLLBACK;
\echo 'AC-S3 (reverse-duplicate pair)     : PASS  (one logical friendship per pair)'

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 0008 hardening · status-unchanged pair reassignment (fail-open close)     │
-- ╰─────────────────────────────────────────────────────────────────────────╯
-- Fixture: A↔G is ACCEPTED (requester A, addressee G). The attack: a party
-- rewrites the OTHER party of an already-accepted friendship WITHOUT changing
-- status, fabricating a
-- non-consensual friendship. Pre-0008 the unchanged-status early return fired
-- before the pair-identity check → the reassignment persisted. 0008 moves the
-- immutability check ABOVE the early return, so both reassignments are rejected.
-- Each UPDATE below keeps `status='accepted'` unchanged and passes the RLS
-- WITH CHECK (actor stays a party), isolating the TRIGGER as the rejecter.

-- ── 0008 (a): addressee reassign, status unchanged (A rewrites G→C) → DENIED ──
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A (requester of A↔G)
do $$
declare denied boolean := false; v_sqlstate text := '';
begin
  begin
    update friendships set addressee_id = '33333333-3333-3333-3333-333333333333'  -- G→C
     where requester_id = '11111111-1111-1111-1111-111111111111'
       and addressee_id = '88888888-8888-8888-8888-888888888888'
       and status = 'accepted';   -- status left unchanged
  exception when others then
    denied := true;
    get stacked diagnostics v_sqlstate = returned_sqlstate;   -- capture SQLSTATE
  end;
  if not denied then raise exception 'AC-S1/0008 FAIL: addressee reassign (status unchanged) allowed'; end if;
  raise notice '0008 addressee-reassign rejected SQLSTATE=%', v_sqlstate;
  -- The pair was NOT mutated onto C, and A↔C never became a friendship.
  if exists (select 1 from friendships
             where requester_id = '11111111-1111-1111-1111-111111111111'
               and addressee_id = '33333333-3333-3333-3333-333333333333') then
    raise exception 'AC-S1/0008 FAIL: A↔C row fabricated via addressee reassign';
  end if;
end $$;
reset role; -- protected contract-level verification; app roles cannot call are_friends(a,b)
do $$
begin
  -- Positive control keeps the helper assertion non-vacuous: A↔G is an
  -- accepted, unblocked friendship in 01_seed.sql.
  if not are_friends('11111111-1111-1111-1111-111111111111',
                     '88888888-8888-8888-8888-888888888888') then
    raise exception 'AC-S1/0008 FIXTURE FAIL: are_friends(A,G) is not true';
  end if;
  if are_friends('11111111-1111-1111-1111-111111111111',
                 '33333333-3333-3333-3333-333333333333') then
    raise exception 'AC-S1/0008 FAIL: are_friends(A,C) became true via addressee reassign';
  end if;
end $$;
ROLLBACK;
\echo '0008 (addressee reassign)          : PASS  (rejected; are_friends(A,C) stays false)'

-- ── 0008 (b): requester reassign, status unchanged (G, addressee of A↔G, ──────
--     rewrites requester A→C) → DENIED. G stays a party (addressee) so RLS
--     WITH CHECK passes; the trigger's requester-immutability branch rejects.
BEGIN;
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';   -- G (addressee of A↔G)
do $$
declare denied boolean := false; v_sqlstate text := '';
begin
  begin
    update friendships set requester_id = '33333333-3333-3333-3333-333333333333'  -- A→C
     where requester_id = '11111111-1111-1111-1111-111111111111'
       and addressee_id = '88888888-8888-8888-8888-888888888888'
       and status = 'accepted';   -- status left unchanged
  exception when others then
    denied := true;
    get stacked diagnostics v_sqlstate = returned_sqlstate;   -- capture SQLSTATE
  end;
  if not denied then raise exception 'AC-S1/0008 FAIL: requester reassign (status unchanged) allowed'; end if;
  raise notice '0008 requester-reassign rejected SQLSTATE=%', v_sqlstate;
  if exists (select 1 from friendships
             where requester_id = '33333333-3333-3333-3333-333333333333'
               and addressee_id = '88888888-8888-8888-8888-888888888888') then
    raise exception 'AC-S1/0008 FAIL: C↔G row fabricated via requester reassign';
  end if;
end $$;
reset role; -- protected contract-level verification; app roles cannot call are_friends(a,b)
do $$
begin
  -- Repeat the positive control in this isolated transaction so a missing or
  -- broken fixture cannot make the negative assertion pass trivially.
  if not are_friends('11111111-1111-1111-1111-111111111111',
                     '88888888-8888-8888-8888-888888888888') then
    raise exception 'AC-S1/0008 FIXTURE FAIL: are_friends(A,G) is not true';
  end if;
  if are_friends('33333333-3333-3333-3333-333333333333',
                 '88888888-8888-8888-8888-888888888888') then
    raise exception 'AC-S1/0008 FAIL: are_friends(C,G) became true via requester reassign';
  end if;
end $$;
ROLLBACK;
\echo '0008 (requester reassign)          : PASS  (rejected; are_friends(C,G) stays false)'

-- ── 0008 (c): identity-unchanged NO-OP accept still passes (regression) ───────
-- A↔G already accepted; A re-sets status='accepted' (identity unchanged). Now
-- falls through the top immutability check → unchanged-status early return.
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A (party)
do $$
begin
  update friendships set status = 'accepted'
   where requester_id = '11111111-1111-1111-1111-111111111111'
     and addressee_id = '88888888-8888-8888-8888-888888888888';   -- no-op re-accept
  if not exists (select 1 from friendships
                 where requester_id = '11111111-1111-1111-1111-111111111111'
                   and addressee_id = '88888888-8888-8888-8888-888888888888'
                   and status = 'accepted') then
    raise exception '0008 FAIL: identity-unchanged no-op accept was rejected';
  end if;
end $$;
ROLLBACK;
\echo '0008 (no-op accept preserved)      : PASS  (identity-unchanged status-only allowed)'

-- ── 0008 (d): legitimate addressee accept still passes (regression) ───────────
-- A→B pending; B (addressee) accepts. Top immutability check passes (identity
-- unchanged), then pending→accepted by the addressee succeeds.
BEGIN;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (addressee)
do $$
begin
  update friendships set status = 'accepted'
   where requester_id = '11111111-1111-1111-1111-111111111111'
     and addressee_id = '22222222-2222-2222-2222-222222222222';
  if not exists (select 1 from friendships
                 where requester_id = '11111111-1111-1111-1111-111111111111'
                   and addressee_id = '22222222-2222-2222-2222-222222222222'
                   and status = 'accepted') then
    raise exception '0008 FAIL: legitimate addressee accept was rejected';
  end if;
end $$;
ROLLBACK;
\echo '0008 (addressee accept preserved)  : PASS  (pending→accepted by addressee allowed)'

-- ── 0008 (e): backward move to pending still rejected (regression) ────────────
-- A↔G accepted; A attempts accepted→pending. Identity unchanged → top check
-- passes; status distinct → elsif new.status='pending' → rejected.
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A (party)
do $$
begin
  begin
    update friendships set status = 'pending'
     where requester_id = '11111111-1111-1111-1111-111111111111'
       and addressee_id = '88888888-8888-8888-8888-888888888888';
  exception when others then null;   -- transition guard raises; expected
  end;
  if (select status from friendships
        where requester_id = '11111111-1111-1111-1111-111111111111'
          and addressee_id = '88888888-8888-8888-8888-888888888888') <> 'accepted' then
    raise exception '0008 FAIL: accepted friendship moved back to pending';
  end if;
end $$;
ROLLBACK;
\echo '0008 (no backward transition)      : PASS  (accepted cannot revert to pending)'

\echo '── 10_friendships: ALL PASS (AC-S1 both vectors, AC-S2, AC-S3, 0008 hardening) ──'
