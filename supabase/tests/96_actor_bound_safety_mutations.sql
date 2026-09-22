-- 0027 actor-bound account deactivation and owner Mark removal.
\set ON_ERROR_STOP on

-- Exact callable surface: legacy deactivation is retired; only authenticated
-- may call the actor-bound RPCs; trigger helpers are never API-callable.
do $$ begin
  if has_function_privilege('anon', 'public.deactivate_account()', 'execute')
     or has_function_privilege('authenticated', 'public.deactivate_account()', 'execute')
     or has_function_privilege('service_role', 'public.deactivate_account()', 'execute') then
    raise exception '96 FAIL: legacy deactivate_account() remains API-callable';
  end if;
  if has_function_privilege('anon', 'public.deactivate_account(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.deactivate_account(uuid)', 'execute')
     or has_function_privilege('service_role', 'public.deactivate_account(uuid)', 'execute') then
    raise exception '96 FAIL: actor-bound deactivate_account ACL is not exact';
  end if;
  if has_function_privilege('anon', 'public.remove_mark(uuid,uuid,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.remove_mark(uuid,uuid,text)', 'execute')
     or has_function_privilege('service_role', 'public.remove_mark(uuid,uuid,text)', 'execute') then
    raise exception '96 FAIL: remove_mark ACL is not exact';
  end if;
  if has_function_privilege('anon', 'public.guard_mark_removal_actor_state()', 'execute')
     or has_function_privilege('authenticated', 'public.guard_mark_removal_actor_state()', 'execute')
     or has_function_privilege('service_role', 'public.guard_mark_removal_actor_state()', 'execute') then
    raise exception '96 FAIL: trigger guard is API-callable';
  end if;
  if not (select prosecdef from pg_catalog.pg_proc where oid='public.deactivate_account(uuid)'::regprocedure)
     or (select prosecdef from pg_catalog.pg_proc where oid='public.remove_mark(uuid,uuid,text)'::regprocedure)
     or (select prosecdef from pg_catalog.pg_proc where oid='public.guard_mark_removal_actor_state()'::regprocedure) then
    raise exception '96 FAIL: function security modes differ from contract';
  end if;
  if (select count(*) from pg_catalog.pg_trigger
       where tgrelid='public.marks'::regclass and not tgisinternal
         and tgname='a0_marks_removal_actor_state')<>1
     or not exists(select 1 from pg_catalog.pg_trigger
       where tgrelid='public.marks'::regclass and not tgisinternal and tgname='marks_moderation') then
    raise exception '96 FAIL: ordered Mark removal guards are not installed';
  end if;
end $$;
\echo '96 (exact RPC + guard ACLs)         : PASS'

-- Mismatch wins before account lookup/status and performs no mutation.
begin;
update public.profiles set account_status='suspended',deactivated_at=clock_timestamp()
 where id='22222222-2222-2222-2222-222222222222';
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';
do $$
declare v_state text; v_message text;
begin
  begin
    perform public.deactivate_account('11111111-1111-1111-1111-111111111111');
    raise exception '96 FAIL: mismatched deactivation succeeded';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    if v_state <> '42501' or v_message <> 'ACTOR_MISMATCH' then
      raise exception '96 FAIL: deactivation mismatch precedence was % %', v_state, v_message;
    end if;
  end;
end $$;
reset role;
do $$ begin
  if (select account_status from public.profiles where id='11111111-1111-1111-1111-111111111111') <> 'active'
     or (select account_status from public.profiles where id='22222222-2222-2222-2222-222222222222') <> 'suspended' then
    raise exception '96 FAIL: mismatch changed an account';
  end if;
end $$;
rollback;
\echo '96 (deactivate mismatch precedence): PASS  (42501 ACTOR_MISMATCH; no mutation)'

-- A missing authenticated subject uses the same first-priority mismatch error.
begin;
set local role authenticated;
set local "test.uid"='';
do $$ declare v_state text; v_message text; begin
  begin
    perform public.deactivate_account('11111111-1111-1111-1111-111111111111');
    raise exception '96 FAIL: null-actor deactivation succeeded';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_state<>'42501' or v_message<>'ACTOR_MISMATCH' then
      raise exception '96 FAIL: null deactivation actor was % %',v_state,v_message; end if;
  end;
  begin
    perform public.remove_mark('44444444-4444-4444-4444-444444444444',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','invalid');
    raise exception '96 FAIL: null-actor removal succeeded';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_state<>'42501' or v_message<>'ACTOR_MISMATCH' then
      raise exception '96 FAIL: null removal actor was % %',v_state,v_message; end if;
  end;
end $$;
rollback;
\echo '96 (null actor mismatch precedence) : PASS  (both RPCs fail before access)'

-- Successful deactivation is retry-safe and preserves the first timestamp.
begin;
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';
select public.deactivate_account('88888888-8888-8888-8888-888888888888');
reset role;
select set_config('test.actor96_deactivated_at', deactivated_at::text, true)
  from public.profiles where id='88888888-8888-8888-8888-888888888888';
select pg_sleep(0.01);
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';
select public.deactivate_account('88888888-8888-8888-8888-888888888888');
reset role;
do $$ begin
  if (select account_status from public.profiles where id='88888888-8888-8888-8888-888888888888') <> 'deactivated'
     or (select deactivated_at::text from public.profiles where id='88888888-8888-8888-8888-888888888888')
          <> current_setting('test.actor96_deactivated_at') then
    raise exception '96 FAIL: deactivation retry changed state or timestamp';
  end if;
end $$;
rollback;
\echo '96 (deactivate success + retry)     : PASS  (first timestamp retained)'

-- Suspended and missing profiles fail closed with the exact action error.
begin;
update public.profiles set account_status='suspended', deactivated_at=clock_timestamp()
 where id='77777777-7777-7777-7777-777777777777';
set local role authenticated;
set local "test.uid" = '77777777-7777-7777-7777-777777777777';
do $$ declare v_state text; v_message text; begin
  begin
    perform public.deactivate_account('77777777-7777-7777-7777-777777777777');
    raise exception '96 FAIL: suspended account self-deactivated';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_state<>'42501' or v_message<>'ACCOUNT_ACTION_NOT_ALLOWED' then
      raise exception '96 FAIL: suspended result was % %',v_state,v_message; end if;
  end;
end $$;
reset role;
do $$ begin
  if (select account_status from public.profiles where id='77777777-7777-7777-7777-777777777777')<>'suspended' then
    raise exception '96 FAIL: suspended account changed'; end if;
end $$;
rollback;

begin;
insert into auth.users(id,email) values('96000000-0000-4000-8000-000000000099','missing-profile-96@test');
-- Deliberately omit the profile row to exercise the fail-closed lookup.
set local role authenticated;
set local "test.uid"='96000000-0000-4000-8000-000000000099';
do $$ declare v_state text; v_message text; begin
  begin
    perform public.deactivate_account('96000000-0000-4000-8000-000000000099');
    raise exception '96 FAIL: missing profile deactivation succeeded';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_state<>'42501' or v_message<>'ACCOUNT_ACTION_NOT_ALLOWED' then
      raise exception '96 FAIL: missing-profile result was % %',v_state,v_message; end if;
  end;
end $$;
rollback;
\echo '96 (deactivate fail-closed states)  : PASS  (suspended + missing)'

-- Reason validation precedes the owned target's inactive-state trigger.
begin;
insert into public.marks(id,wall_id,author_id,type,text)
values('96000000-0000-4000-8000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '11111111-1111-1111-1111-111111111111','text','reason-precedence');
update public.profiles set account_status='deactivated',deactivated_at=clock_timestamp()
 where id='44444444-4444-4444-4444-444444444444';
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
do $$ declare v_state text; v_message text; begin
  begin
    perform public.remove_mark('44444444-4444-4444-4444-444444444444',
      '96000000-0000-4000-8000-000000000000','invalid');
    raise exception '96 FAIL: invalid reason reached inactive-state guard';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_state<>'22023' or v_message<>'MARK_REMOVAL_REASON' then
      raise exception '96 FAIL: reason precedence was % %',v_state,v_message; end if;
  end;
end $$;
rollback;
\echo '96 (reason precedes actor state)    : PASS  (22023 MARK_REMOVAL_REASON)'

-- Owner removal contract, mismatch/reason precedence, quota, and safety path.
begin;
insert into public.marks(id,wall_id,author_id,type,text) values
 ('96000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','text','r1'),
 ('96000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','text','r2'),
 ('96000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','text','r3'),
 ('96000000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','text','r4'),
 ('96000000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','text','r5');
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
do $$ declare v_state text; v_message text; begin
  begin
    perform public.remove_mark('11111111-1111-1111-1111-111111111111',
      '96000000-0000-4000-8000-000000000001','invalid');
    raise exception '96 FAIL: mismatched removal succeeded';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_state<>'42501' or v_message<>'ACTOR_MISMATCH' then
      raise exception '96 FAIL: remove mismatch precedence was % %',v_state,v_message; end if;
  end;
  begin
    perform public.remove_mark('44444444-4444-4444-4444-444444444444',
      '96000000-0000-4000-8000-000000000001',null);
    raise exception '96 FAIL: null removal reason succeeded';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_state<>'22023' or v_message<>'MARK_REMOVAL_REASON' then
      raise exception '96 FAIL: null reason result was % %',v_state,v_message; end if;
  end;
  begin
    perform public.remove_mark('44444444-4444-4444-4444-444444444444',
      '96000000-0000-4000-8000-000000000001','moderation');
    raise exception '96 FAIL: invalid removal reason succeeded';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_state<>'22023' or v_message<>'MARK_REMOVAL_REASON' then
      raise exception '96 FAIL: invalid reason result was % %',v_state,v_message; end if;
  end;
  perform public.remove_mark('44444444-4444-4444-4444-444444444444','96000000-0000-4000-8000-000000000001','normal');
  perform public.remove_mark('44444444-4444-4444-4444-444444444444','96000000-0000-4000-8000-000000000002','normal');
  perform public.remove_mark('44444444-4444-4444-4444-444444444444','96000000-0000-4000-8000-000000000003','normal');
  begin
    perform public.remove_mark('44444444-4444-4444-4444-444444444444','96000000-0000-4000-8000-000000000004','normal');
    raise exception '96 FAIL: fourth normal removal succeeded';
  exception when others then
    get stacked diagnostics v_message=message_text;
    if v_message not like 'MARK_REMOVAL_QUOTA:%' then
      raise exception '96 FAIL: fourth removal result was %',v_message; end if;
  end;
  perform public.remove_mark('44444444-4444-4444-4444-444444444444','96000000-0000-4000-8000-000000000005','safety');
end $$;
reset role;
do $$ begin
  if (select count(*) from public.marks where id::text like '96000000-0000-4000-8000-00000000000%'
      and status='removed' and removed_by='44444444-4444-4444-4444-444444444444')<>4
     or (select status from public.marks where id='96000000-0000-4000-8000-000000000004')='removed'
     or (select removal_reason from public.marks where id='96000000-0000-4000-8000-000000000005')<>'safety' then
    raise exception '96 FAIL: owner removal/quota/safety state wrong'; end if;
end $$;
rollback;
\echo '96 (remove normal/safety/quota)     : PASS'

-- Non-owner and missing targets collapse to the same exact authorization error.
begin;
insert into public.marks(id,wall_id,author_id,type,text)
values('96000000-0000-4000-8000-000000000011','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       '22222222-2222-2222-2222-222222222222','text','owned by wall, not caller');
update public.profiles set account_status='deactivated',deactivated_at=clock_timestamp()
 where id='11111111-1111-1111-1111-111111111111';
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare v_state text; v_message text; v_id uuid; begin
  foreach v_id in array array[
    '96000000-0000-4000-8000-000000000011'::uuid,
    '96000000-0000-4000-8000-000000000012'::uuid
  ] loop
    begin
      perform public.remove_mark('11111111-1111-1111-1111-111111111111',v_id,'safety');
      raise exception '96 FAIL: forbidden/missing Mark removal succeeded';
    exception when others then
      get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
      if v_state<>'42501' or v_message<>'MARK_ACTION_NOT_ALLOWED' then
        raise exception '96 FAIL: forbidden/missing result was % %',v_state,v_message; end if;
    end;
  end loop;
end $$;
reset role;
do $$ begin
  if (select status from public.marks where id='96000000-0000-4000-8000-000000000011')='removed' then
    raise exception '96 FAIL: non-owner changed Mark'; end if;
end $$;
rollback;
\echo '96 (remove non-owner + missing)     : PASS  (target denial precedes inactive state)'

-- A committed-inactive owner is filtered before any BEFORE UPDATE trigger runs.
-- The RPC converts UPDATE 0 into its non-enumerating action error; a legacy
-- direct update is a safe zero-row no-op. Physical races below prove the a0
-- trigger separately when RLS admitted the row under an active snapshot.
begin;
insert into public.marks(id,wall_id,author_id,type,text) values
 ('96000000-0000-4000-8000-000000000021','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111','text','inactive-owner RPC target'),
 ('96000000-0000-4000-8000-000000000022','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111','text','inactive-owner direct target');
update public.profiles set account_status='deactivated',deactivated_at=clock_timestamp()
 where id='44444444-4444-4444-4444-444444444444';
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
do $$ declare v_state text; v_message text; begin
  begin
    perform public.remove_mark('44444444-4444-4444-4444-444444444444',
      '96000000-0000-4000-8000-000000000021','safety');
    raise exception '96 FAIL: inactive owner removed Mark';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate, v_message=message_text;
    if v_state<>'42501' or v_message<>'MARK_ACTION_NOT_ALLOWED' then
      raise exception '96 FAIL: inactive owner result was % %',v_state,v_message; end if;
  end;
end $$;
do $$ declare v_rows integer; begin
  update public.marks set status='removed',removal_reason='safety'
   where id='96000000-0000-4000-8000-000000000022';
  get diagnostics v_rows=row_count;
  if v_rows<>0 then
    raise exception '96 FAIL: inactive owner direct update affected % rows',v_rows; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.marks
             where id in ('96000000-0000-4000-8000-000000000021',
                          '96000000-0000-4000-8000-000000000022')
               and (status='removed' or removed_by is not null
                    or removed_at is not null or removal_reason is not null)) then
    raise exception '96 FAIL: inactive-owner Mark/accounting changed'; end if;
end $$;
rollback;
\echo '96 (committed inactive owner)       : PASS  (RPC action denial + direct UPDATE 0)'

\echo '── 96_actor_bound_safety_mutations: ALL PASS ──'
