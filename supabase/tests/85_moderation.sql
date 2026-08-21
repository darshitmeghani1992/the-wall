-- ════════════════════════════════════════════════════════════════════════════
-- 85_moderation.sql · Reporting §52 + Moderation/Admin §53 (migration 0017)
--
-- Proves, as the acting roles:
--   • a report targets EXACTLY one of Mark/user/Wall; reason from the vocab;
--     reporter reads own report, a stranger does not, an admin does
--   • admin RPCs are is_admin-gated: a non-admin is rejected (not_authorized)
--   • admin can remove a Mark (no quota), suspend an account, resolve a report —
--     each logged in moderation_actions (admin-only readable)
--   • a suspended account cannot self-reactivate
--
-- Admin = D (5555, set is_admin inline). Reporter = A (1111). Targets: M_active
-- (bbbb…b1) and user C (3333). Non-admin/stranger = B (2222).
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── Report validity: one target, reason vocab; read scope ────────────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A (reporter)
-- Valid: single target (a Mark) + vocab reason.
insert into reports (id, reporter_id, mark_id, reason, details)
  values ('99000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','harassment','not nice');

-- Invalid: two targets at once → reports_one_target.
do $$
declare rejected boolean := false;
begin
  begin
    insert into reports (reporter_id, mark_id, reported_user_id, reason)
      values ('11111111-1111-1111-1111-111111111111',
              'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','33333333-3333-3333-3333-333333333333','spam');
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception '85 FAIL: a report with two targets was accepted'; end if;
end $$;

-- Invalid: reason outside the vocabulary → reports_reason_chk.
do $$
declare rejected boolean := false;
begin
  begin
    insert into reports (reporter_id, reported_user_id, reason)
      values ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','because');
  exception when check_violation then rejected := true;
  end;
  if not rejected then raise exception '85 FAIL: an out-of-vocab reason was accepted'; end if;
end $$;
\echo '85 (report: one target + vocab)    : PASS  (§52 targets & reasons constrained)'

-- Read scope: a stranger (B) cannot see A's report; the reporter can.
reset role;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (stranger)
do $$
begin
  if (select count(*) from reports where id = '99000000-0000-0000-0000-000000000001') <> 0 then
    raise exception '85 FAIL: a stranger read someone else''s report';
  end if;
end $$;
reset role;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A (reporter)
do $$
begin
  if (select count(*) from reports where id = '99000000-0000-0000-0000-000000000001') <> 1 then
    raise exception '85 FAIL: reporter cannot read their own report';
  end if;
end $$;
\echo '85 (report read scope)             : PASS  (reporter sees own; stranger does not)'
ROLLBACK;

-- ── A client cannot self-promote to admin (privilege-escalation guard) ───────
BEGIN;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (ordinary user)
-- B tries to grant themselves admin via the profiles-update-self policy.
update profiles set is_admin = true where id = '22222222-2222-2222-2222-222222222222';
-- And tries to flip their own account_status directly (must also be inert now).
update profiles set account_status = 'suspended' where id = '22222222-2222-2222-2222-222222222222';
reset role;
do $$
begin
  if (select is_admin from profiles where id = '22222222-2222-2222-2222-222222222222') then
    raise exception '85 FAIL: a user self-promoted to admin';
  end if;
  if (select account_status from profiles where id = '22222222-2222-2222-2222-222222222222') <> 'active' then
    raise exception '85 FAIL: a user changed account_status via a direct update (bypassing the RPCs)';
  end if;
end $$;
\echo '85 (no self-promote to admin)      : PASS  (is_admin + status client-immutable)'
ROLLBACK;

-- ── Admin gating: non-admin cannot moderate; admin can, and it is logged ─────
BEGIN;
-- Make D an admin.
reset role;
update profiles set is_admin = true where id = '55555555-5555-5555-5555-555555555555';
-- Seed a report to resolve.
insert into reports (id, reporter_id, mark_id, reason)
  values ('99000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',
          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','spam');

-- A non-admin (B) cannot call the admin RPCs.
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (not admin)
do $$
declare rejected boolean := false;
begin
  begin perform admin_remove_mark('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','x');
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception '85 FAIL: a non-admin removed a Mark'; end if;
end $$;
\echo '85 (admin RPCs gated)              : PASS  (non-admin → not_authorized)'

-- Admin (D) removes a Mark — no quota limit — and it is logged.
reset role;
set local role authenticated;
set local "test.uid" = '55555555-5555-5555-5555-555555555555';   -- D (admin)
select admin_remove_mark('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','abuse');
reset role;
do $$
begin
  if (select status from marks where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1') <> 'removed' then
    raise exception '85 FAIL: admin_remove_mark did not remove the Mark';
  end if;
  if (select removal_reason from marks where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1') <> 'moderation' then
    raise exception '85 FAIL: admin removal not tagged moderation';
  end if;
  if (select count(*) from moderation_actions
      where action = 'remove_mark' and target_mark_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
        and actor_id = '55555555-5555-5555-5555-555555555555') <> 1 then
    raise exception '85 FAIL: admin mark removal not logged';
  end if;
end $$;
\echo '85 (admin remove mark + log)       : PASS  (moderation removal unlimited + audited)'

-- Admin suspends C; C cannot self-reactivate.
set local role authenticated;
set local "test.uid" = '55555555-5555-5555-5555-555555555555';   -- D (admin)
select admin_suspend_account('33333333-3333-3333-3333-333333333333','abuse');
reset role;
do $$
begin
  if (select account_status from profiles where id = '33333333-3333-3333-3333-333333333333') <> 'suspended' then
    raise exception '85 FAIL: account not suspended';
  end if;
  if is_active_account('33333333-3333-3333-3333-333333333333') then
    raise exception '85 FAIL: suspended account still active';
  end if;
end $$;
-- C tries to self-reactivate → stays suspended.
set local role authenticated;
set local "test.uid" = '33333333-3333-3333-3333-333333333333';   -- C (suspended)
select reactivate_account();
reset role;
do $$
begin
  if (select account_status from profiles where id = '33333333-3333-3333-3333-333333333333') <> 'suspended' then
    raise exception '85 FAIL: suspended user self-reactivated';
  end if;
end $$;
\echo '85 (suspend + no self-reactivate)  : PASS  (§53 suspension; can''t be self-lifted)'

-- Admin resolves the report; logged; report status updated.
set local role authenticated;
set local "test.uid" = '55555555-5555-5555-5555-555555555555';   -- D (admin)
select admin_resolve_report('99000000-0000-0000-0000-000000000002','resolved','handled');
do $$
begin
  if (select status from reports where id = '99000000-0000-0000-0000-000000000002') <> 'resolved' then
    raise exception '85 FAIL: report not resolved';
  end if;
  if (select resolved_by from reports where id = '99000000-0000-0000-0000-000000000002')
     is distinct from '55555555-5555-5555-5555-555555555555'::uuid then
    raise exception '85 FAIL: resolver not stamped';
  end if;
  -- Admin can read the moderation log; a non-admin cannot (checked below).
  if (select count(*) from moderation_actions where action = 'resolve_report') < 1 then
    raise exception '85 FAIL: report resolution not logged';
  end if;
end $$;
\echo '85 (admin resolve report + log)    : PASS  (report lifecycle + audit)'

-- moderation_actions is admin-only readable.
reset role;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';   -- B (not admin)
do $$
begin
  if (select count(*) from moderation_actions) <> 0 then
    raise exception '85 FAIL: a non-admin read the moderation log';
  end if;
end $$;
\echo '85 (moderation log admin-only)     : PASS  (non-admin sees 0 rows)'
ROLLBACK;

\echo '── 85_moderation: ALL PASS (§52 reporting + §53 admin/moderation + audit) ──'
