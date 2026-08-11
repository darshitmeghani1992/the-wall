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

\echo '── 10_friendships: ALL PASS (AC-S1 both vectors, AC-S2, AC-S3) ──'
