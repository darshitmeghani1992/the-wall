-- 0030 actor-bound, receipt-safe admin moderation.
\set ON_ERROR_STOP on

do $$ begin
  if has_function_privilege('authenticated','public.admin_remove_mark(uuid,text)','execute')
     or has_function_privilege('authenticated','public.admin_suspend_account(uuid,text)','execute')
     or has_function_privilege('authenticated','public.admin_resolve_report(uuid,text,text)','execute') then
    raise exception '98 FAIL: a legacy moderation RPC remains callable';
  end if;
  if has_function_privilege('anon','public.admin_remove_mark(uuid,uuid,text)','execute')
     or not has_function_privilege('authenticated','public.admin_remove_mark(uuid,uuid,text)','execute')
     or has_function_privilege('service_role','public.admin_remove_mark(uuid,uuid,text)','execute')
     or has_function_privilege('anon','public.admin_suspend_account(uuid,uuid,text)','execute')
     or not has_function_privilege('authenticated','public.admin_suspend_account(uuid,uuid,text)','execute')
     or has_function_privilege('service_role','public.admin_suspend_account(uuid,uuid,text)','execute')
     or has_function_privilege('anon','public.admin_resolve_report(uuid,uuid,text,text)','execute')
     or not has_function_privilege('authenticated','public.admin_resolve_report(uuid,uuid,text,text)','execute')
     or has_function_privilege('service_role','public.admin_resolve_report(uuid,uuid,text,text)','execute') then
    raise exception '98 FAIL: actor-bound moderation ACL is not exact';
  end if;
  if not (select prosecdef from pg_catalog.pg_proc where oid='public.admin_remove_mark(uuid,uuid,text)'::regprocedure)
     or not (select prosecdef from pg_catalog.pg_proc where oid='public.admin_suspend_account(uuid,uuid,text)'::regprocedure)
     or not (select prosecdef from pg_catalog.pg_proc where oid='public.admin_resolve_report(uuid,uuid,text,text)'::regprocedure) then
    raise exception '98 FAIL: moderation RPC security mode is wrong';
  end if;
end $$;
\echo '98 (exact moderation RPC ACLs)      : PASS'

-- Expected-actor mismatch precedes admin and target checks.
begin;
update public.profiles set is_admin=true where id='55555555-5555-5555-5555-555555555555';
set local role authenticated;
set local "test.uid"='55555555-5555-5555-5555-555555555555';
do $$ declare v_state text; v_message text; begin
  begin
    perform public.admin_remove_mark('11111111-1111-1111-1111-111111111111',
      '98000000-0000-4000-8000-000000000099','x');
    raise exception '98 FAIL: mismatched moderation succeeded';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_state<>'42501' or v_message<>'ACTOR_MISMATCH' then
      raise exception '98 FAIL: mismatch result was % %',v_state,v_message; end if;
  end;
end $$;
rollback;
\echo '98 (moderation mismatch precedence): PASS'

-- An ordinary user remains rejected even with their correct expected identity.
begin;
set local role authenticated;
set local "test.uid"='22222222-2222-2222-2222-222222222222';
do $$ declare v_state text; begin
  begin
    perform public.admin_suspend_account('22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333','x');
    raise exception '98 FAIL: non-admin moderation succeeded';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate;
    if v_state<>'42501' then raise exception '98 FAIL: non-admin state was %',v_state; end if;
  end;
end $$;
rollback;
\echo '98 (server admin authorization)     : PASS'

-- Successful actions are retry-safe and create one audit receipt each.
begin;
update public.profiles set is_admin=true where id='55555555-5555-5555-5555-555555555555';
insert into public.marks(id,wall_id,author_id,type,text)
values('98000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '11111111-1111-1111-1111-111111111111','text','moderate me');
insert into public.reports(id,reporter_id,mark_id,reason)
values('98000000-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111',
       '98000000-0000-4000-8000-000000000001','harassment');
set local role authenticated;
set local "test.uid"='55555555-5555-5555-5555-555555555555';
select public.admin_remove_mark('55555555-5555-5555-5555-555555555555',
  '98000000-0000-4000-8000-000000000001','report 98');
select public.admin_remove_mark('55555555-5555-5555-5555-555555555555',
  '98000000-0000-4000-8000-000000000001','report 98 retry');
select public.admin_suspend_account('55555555-5555-5555-5555-555555555555',
  '33333333-3333-3333-3333-333333333333','report 98');
select public.admin_suspend_account('55555555-5555-5555-5555-555555555555',
  '33333333-3333-3333-3333-333333333333','report 98 retry');
select public.admin_resolve_report('55555555-5555-5555-5555-555555555555',
  '98000000-0000-4000-8000-000000000002','resolved','report 98');
select public.admin_resolve_report('55555555-5555-5555-5555-555555555555',
  '98000000-0000-4000-8000-000000000002','resolved','report 98 retry');
reset role;
do $$ begin
  if (select status from public.marks where id='98000000-0000-4000-8000-000000000001')<>'removed'
     or (select account_status from public.profiles where id='33333333-3333-3333-3333-333333333333')<>'suspended'
     or (select status from public.reports where id='98000000-0000-4000-8000-000000000002')<>'resolved'
     or (select count(*) from public.moderation_actions where target_mark_id='98000000-0000-4000-8000-000000000001')<>1
     or (select count(*) from public.moderation_actions where target_user_id='33333333-3333-3333-3333-333333333333')<>1
     or (select count(*) from public.moderation_actions where report_id='98000000-0000-4000-8000-000000000002')<>1 then
    raise exception '98 FAIL: moderation state or retry receipts are wrong'; end if;
end $$;
rollback;
\echo '98 (actions + idempotent receipts)  : PASS'

-- Missing targets and self-suspension fail without audit rows.
begin;
update public.profiles set is_admin=true
 where id in ('22222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555555');
set local role authenticated;
set local "test.uid"='55555555-5555-5555-5555-555555555555';
do $$ declare v_message text; begin
  begin
    perform public.admin_remove_mark('55555555-5555-5555-5555-555555555555',
      '98000000-0000-4000-8000-000000000099','x');
    raise exception '98 FAIL: missing Mark action succeeded';
  exception when others then
    get stacked diagnostics v_message=message_text;
    if v_message<>'MODERATION_ACTION_NOT_ALLOWED' then raise exception '98 FAIL: missing Mark was %',v_message; end if;
  end;
  begin
    perform public.admin_suspend_account('55555555-5555-5555-5555-555555555555',
      '55555555-5555-5555-5555-555555555555','x');
    raise exception '98 FAIL: admin self-suspension succeeded';
  exception when others then
    get stacked diagnostics v_message=message_text;
    if v_message<>'MODERATION_ACTION_NOT_ALLOWED' then raise exception '98 FAIL: self-suspend was %',v_message; end if;
  end;
  begin
    perform public.admin_suspend_account('55555555-5555-5555-5555-555555555555',
      '22222222-2222-2222-2222-222222222222','x');
    raise exception '98 FAIL: administrator suspension succeeded';
  exception when others then
    get stacked diagnostics v_message=message_text;
    if v_message<>'MODERATION_ACTION_NOT_ALLOWED' then raise exception '98 FAIL: admin target was %',v_message; end if;
  end;
  begin
    perform public.admin_resolve_report('55555555-5555-5555-5555-555555555555',
      '98000000-0000-4000-8000-000000000099','resolved','x');
    raise exception '98 FAIL: missing report action succeeded';
  exception when others then
    get stacked diagnostics v_message=message_text;
    if v_message<>'MODERATION_ACTION_NOT_ALLOWED' then raise exception '98 FAIL: missing report was %',v_message; end if;
  end;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.moderation_actions where reason='x') then
    raise exception '98 FAIL: denied actions created audit receipts'; end if;
end $$;
rollback;
\echo '98 (missing/self targets fail closed): PASS'

\echo '── 98_actor_bound_admin_moderation: ALL PASS ──'
