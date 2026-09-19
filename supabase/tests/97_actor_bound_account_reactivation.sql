-- 0029 actor-bound account reactivation.
\set ON_ERROR_STOP on

-- Exact callable surface and execution mode.
do $$ begin
  if has_function_privilege('anon', 'public.reactivate_account()', 'execute')
     or has_function_privilege('authenticated', 'public.reactivate_account()', 'execute')
     or has_function_privilege('service_role', 'public.reactivate_account()', 'execute') then
    raise exception '97 FAIL: legacy reactivate_account() remains API-callable';
  end if;
  if has_function_privilege('anon', 'public.reactivate_account(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.reactivate_account(uuid)', 'execute')
     or has_function_privilege('service_role', 'public.reactivate_account(uuid)', 'execute') then
    raise exception '97 FAIL: actor-bound reactivate_account ACL is not exact';
  end if;
  if not (select prosecdef from pg_catalog.pg_proc
           where oid='public.reactivate_account(uuid)'::regprocedure) then
    raise exception '97 FAIL: reactivate_account(uuid) is not SECURITY DEFINER';
  end if;
end $$;
\echo '97 (exact reactivation RPC ACL)     : PASS'

-- Mismatch wins before status lookup, including for a suspended actual actor.
begin;
update public.profiles set account_status='deactivated', deactivated_at=clock_timestamp()
 where id='11111111-1111-1111-1111-111111111111';
update public.profiles set account_status='suspended', deactivated_at=clock_timestamp()
 where id='22222222-2222-2222-2222-222222222222';
set local role authenticated;
set local "test.uid"='22222222-2222-2222-2222-222222222222';
do $$ declare v_state text; v_message text; begin
  begin
    perform public.reactivate_account('11111111-1111-1111-1111-111111111111');
    raise exception '97 FAIL: mismatched reactivation succeeded';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_state<>'42501' or v_message<>'ACTOR_MISMATCH' then
      raise exception '97 FAIL: mismatch precedence was % %',v_state,v_message; end if;
  end;
end $$;
reset role;
do $$ begin
  if (select account_status from public.profiles where id='11111111-1111-1111-1111-111111111111')<>'deactivated'
     or (select account_status from public.profiles where id='22222222-2222-2222-2222-222222222222')<>'suspended' then
    raise exception '97 FAIL: mismatch changed an account'; end if;
end $$;
rollback;
\echo '97 (reactivate mismatch precedence): PASS  (42501 ACTOR_MISMATCH; no mutation)'

-- A missing request subject fails with the same first-priority mismatch.
begin;
set local role authenticated;
set local "test.uid"='';
do $$ declare v_state text; v_message text; begin
  begin
    perform public.reactivate_account('11111111-1111-1111-1111-111111111111');
    raise exception '97 FAIL: null-actor reactivation succeeded';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_state<>'42501' or v_message<>'ACTOR_MISMATCH' then
      raise exception '97 FAIL: null actor was % %',v_state,v_message; end if;
  end;
end $$;
rollback;
\echo '97 (null actor mismatch precedence) : PASS'

-- Deactivated -> active clears the timestamp; an active retry is a no-op.
begin;
update public.profiles set account_status='deactivated', deactivated_at=clock_timestamp()
 where id='88888888-8888-8888-8888-888888888888';
set local role authenticated;
set local "test.uid"='88888888-8888-8888-8888-888888888888';
select public.reactivate_account('88888888-8888-8888-8888-888888888888');
select public.reactivate_account('88888888-8888-8888-8888-888888888888');
reset role;
do $$ begin
  if (select account_status from public.profiles where id='88888888-8888-8888-8888-888888888888')<>'active'
     or (select deactivated_at from public.profiles where id='88888888-8888-8888-8888-888888888888') is not null then
    raise exception '97 FAIL: successful reactivation/retry state is wrong'; end if;
end $$;
rollback;
\echo '97 (reactivate success + retry)     : PASS  (active; timestamp cleared)'

-- Suspended and missing profiles fail closed with the exact action error.
begin;
update public.profiles set account_status='suspended', deactivated_at=clock_timestamp()
 where id='77777777-7777-7777-7777-777777777777';
set local role authenticated;
set local "test.uid"='77777777-7777-7777-7777-777777777777';
do $$ declare v_state text; v_message text; begin
  begin
    perform public.reactivate_account('77777777-7777-7777-7777-777777777777');
    raise exception '97 FAIL: suspended account self-reactivated';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_state<>'42501' or v_message<>'ACCOUNT_ACTION_NOT_ALLOWED' then
      raise exception '97 FAIL: suspended result was % %',v_state,v_message; end if;
  end;
end $$;
rollback;

begin;
insert into auth.users(id,email) values('97000000-0000-4000-8000-000000000099','missing-profile-97@test');
set local role authenticated;
set local "test.uid"='97000000-0000-4000-8000-000000000099';
do $$ declare v_state text; v_message text; begin
  begin
    perform public.reactivate_account('97000000-0000-4000-8000-000000000099');
    raise exception '97 FAIL: missing profile reactivation succeeded';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_state<>'42501' or v_message<>'ACCOUNT_ACTION_NOT_ALLOWED' then
      raise exception '97 FAIL: missing-profile result was % %',v_state,v_message; end if;
  end;
end $$;
rollback;
\echo '97 (reactivate fail-closed states)  : PASS  (suspended + missing)'

\echo '── 97_actor_bound_account_reactivation: ALL PASS ──'
