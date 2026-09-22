-- 0031 recoverable permanent account deletion.
\set ON_ERROR_STOP on

-- Exact private-table and RPC surface.
do $$ begin
  if has_table_privilege('anon','public.account_deletion_requests','select,insert,update,delete')
     or has_table_privilege('authenticated','public.account_deletion_requests','select,insert,update,delete')
     or has_table_privilege('service_role','public.account_deletion_requests','select,insert,update,delete') then
    raise exception '99 FAIL: private deletion requests have direct DML access';
  end if;
  if has_function_privilege('anon','public.request_account_deletion(uuid,text)','execute')
     or not has_function_privilege('authenticated','public.request_account_deletion(uuid,text)','execute')
     or has_function_privilege('service_role','public.request_account_deletion(uuid,text)','execute') then
    raise exception '99 FAIL: request_account_deletion ACL is not exact';
  end if;
  if has_function_privilege('anon','public.get_my_account_deletion()','execute')
     or not has_function_privilege('authenticated','public.get_my_account_deletion()','execute')
     or has_function_privilege('service_role','public.get_my_account_deletion()','execute') then
    raise exception '99 FAIL: get_my_account_deletion ACL is not exact';
  end if;
  if has_function_privilege('anon','public.prepare_account_deletion_for_purge(uuid,timestamptz)','execute')
     or has_function_privilege('authenticated','public.prepare_account_deletion_for_purge(uuid,timestamptz)','execute')
     or not has_function_privilege('service_role','public.prepare_account_deletion_for_purge(uuid,timestamptz)','execute') then
    raise exception '99 FAIL: prepare_account_deletion_for_purge ACL is not exact';
  end if;
  if has_function_privilege('anon','public.list_due_account_deletions(integer)','execute')
     or has_function_privilege('authenticated','public.list_due_account_deletions(integer)','execute')
     or not has_function_privilege('service_role','public.list_due_account_deletions(integer)','execute') then
    raise exception '99 FAIL: list_due_account_deletions ACL is not exact';
  end if;
  if not (select prosecdef from pg_proc where oid='public.request_account_deletion(uuid,text)'::regprocedure)
     or not (select prosecdef from pg_proc where oid='public.get_my_account_deletion()'::regprocedure)
     or not (select prosecdef from pg_proc where oid='public.list_due_account_deletions(integer)'::regprocedure)
     or not (select prosecdef from pg_proc where oid='public.prepare_account_deletion_for_purge(uuid,timestamptz)'::regprocedure) then
    raise exception '99 FAIL: deletion RPCs are not SECURITY DEFINER';
  end if;
  if exists (
    select 1 from pg_proc
     where oid in (
       'public.request_account_deletion(uuid,text)'::regprocedure,
       'public.get_my_account_deletion()'::regprocedure,
       'public.list_due_account_deletions(integer)'::regprocedure,
       'public.prepare_account_deletion_for_purge(uuid,timestamptz)'::regprocedure
     )
       and not (proconfig @> array['search_path=pg_catalog, public']
         or proconfig @> array['search_path=pg_catalog, public, storage, auth'])
  ) then
    raise exception '99 FAIL: deletion RPC search_path is not pinned';
  end if;
  if to_regclass('public.account_deletion_requests_due_idx') is null then
    raise exception '99 FAIL: due-work index is missing';
  end if;
end $$;
\echo '99 (private state + exact RPC ACLs) : PASS'

-- Actor mismatch wins before confirmation/account/ownership inspection.
begin;
set local role authenticated;
set local "test.uid"='22222222-2222-2222-2222-222222222222';
do $$ declare v_state text; v_message text; begin
  begin
    perform public.request_account_deletion(
      '11111111-1111-1111-1111-111111111111','WRONG');
    raise exception '99 FAIL: mismatched deletion request succeeded';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_state<>'42501' or v_message<>'ACTOR_MISMATCH' then
      raise exception '99 FAIL: mismatch precedence was % %',v_state,v_message;
    end if;
  end;
end $$;
rollback;
\echo '99 (actor mismatch precedence)     : PASS'

-- Strong confirmation and Shared-Wall ownership are server-enforced without
-- changing account state.
begin;
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
do $$ declare v jsonb; begin
  v:=public.request_account_deletion(
    '44444444-4444-4444-4444-444444444444','delete');
  if v->>'status'<>'invalid_confirmation' then
    raise exception '99 FAIL: weak confirmation result %',v;
  end if;
  v:=public.request_account_deletion(
    '44444444-4444-4444-4444-444444444444','DELETE');
  if v->>'status'<>'owner_action_required'
     or (v->>'owned_shared_wall_count')::integer<1 then
    raise exception '99 FAIL: ownership gate result %',v;
  end if;
end $$;
reset role;
do $$ begin
  if (select account_status from profiles where id='44444444-4444-4444-4444-444444444444')<>'active'
     or exists(select 1 from account_deletion_requests where user_id='44444444-4444-4444-4444-444444444444') then
    raise exception '99 FAIL: rejected schedule changed state';
  end if;
end $$;
rollback;
\echo '99 (confirmation + ownership gate) : PASS'

-- Scheduling is server-timed, retry-safe, readable only for the current actor,
-- and reactivation atomically cancels it.
begin;
insert into auth.users(id,email) values
  ('99000000-0000-4000-8000-000000000001','schedule-99@test');
insert into profiles(id,handle,display_name) values
  ('99000000-0000-4000-8000-000000000001','schedule99','Schedule 99');
set local role authenticated;
set local "test.uid"='99000000-0000-4000-8000-000000000001';
do $$ declare first_result jsonb; retry_result jsonb; status_result jsonb; begin
  first_result:=public.request_account_deletion(
    '99000000-0000-4000-8000-000000000001','DELETE');
  retry_result:=public.request_account_deletion(
    '99000000-0000-4000-8000-000000000001','DELETE');
  status_result:=public.get_my_account_deletion();
  if first_result->>'status'<>'scheduled'
     or retry_result<>first_result or status_result<>first_result then
    raise exception '99 FAIL: schedule/status/retry mismatch % % %',
      first_result,retry_result,status_result;
  end if;
end $$;
reset role;
do $$ begin
  if (select account_status from profiles where id='99000000-0000-4000-8000-000000000001')<>'deactivated'
     or (select purge_after-requested_at from account_deletion_requests
          where user_id='99000000-0000-4000-8000-000000000001')<>interval '30 days' then
    raise exception '99 FAIL: scheduled lifecycle state is wrong';
  end if;
end $$;
set local role authenticated;
set local "test.uid"='99000000-0000-4000-8000-000000000001';
do $$ declare denied boolean:=false; begin
  begin
    insert into storage.objects(bucket_id,name,owner,owner_id)
    values('attachments','avatars/99000000-0000-4000-8000-000000000001/late.jpg',
      auth.uid(),auth.uid()::text);
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then
    raise exception '99 FAIL: scheduled account created a new avatar object';
  end if;
end $$;
reset role;
set local role authenticated;
set local "test.uid"='99000000-0000-4000-8000-000000000001';
select public.reactivate_account('99000000-0000-4000-8000-000000000001');
reset role;
do $$ begin
  if (select account_status from profiles where id='99000000-0000-4000-8000-000000000001')<>'active'
     or exists(select 1 from account_deletion_requests where user_id='99000000-0000-4000-8000-000000000001') then
    raise exception '99 FAIL: recovery did not cancel deletion atomically';
  end if;
end $$;
rollback;
\echo '99 (schedule + retry + recovery)    : PASS'

-- Finalization refuses early execution and remaining avatar objects, then
-- removes authored content everywhere before deleting the identity.
begin;
insert into auth.users(id,email) values
  ('99000000-0000-4000-8000-000000000002','purge-99@test'),
  ('99000000-0000-4000-8000-000000000003','other-99@test');
insert into profiles(id,handle,display_name) values
  ('99000000-0000-4000-8000-000000000002','purge99','Purge 99'),
  ('99000000-0000-4000-8000-000000000003','other99','Other 99');
insert into marks(id,wall_id,author_id,type,text)
select '99000000-0000-4000-8000-000000000010',w.id,
       '99000000-0000-4000-8000-000000000002','text','authored elsewhere'
  from walls w where w.owner_id='99000000-0000-4000-8000-000000000003' and w.type='personal';
insert into marks(id,wall_id,author_id,type,text)
select '99000000-0000-4000-8000-000000000011',w.id,
       '99000000-0000-4000-8000-000000000003','text','on deleted personal wall'
  from walls w where w.owner_id='99000000-0000-4000-8000-000000000002' and w.type='personal';
update walls set allow_anonymous=true
 where owner_id='99000000-0000-4000-8000-000000000003' and type='personal';
insert into marks(id,wall_id,author_id,type,text,anonymous)
select '99000000-0000-4000-8000-000000000012',w.id,
       null,'text','anonymous authored elsewhere',true
  from walls w where w.owner_id='99000000-0000-4000-8000-000000000003' and w.type='personal';
insert into anonymous_mark_authors(mark_id,author_id)
values('99000000-0000-4000-8000-000000000012','99000000-0000-4000-8000-000000000002')
on conflict(mark_id) do update set author_id=excluded.author_id;
set local role authenticated;
set local "test.uid"='99000000-0000-4000-8000-000000000002';
select public.request_account_deletion(
  '99000000-0000-4000-8000-000000000002','DELETE');
reset role;
select set_config('test.delete99_requested_at',requested_at::text,true)
  from account_deletion_requests
 where user_id='99000000-0000-4000-8000-000000000002';
set local role service_role;
do $$ begin
  if public.prepare_account_deletion_for_purge(
      '99000000-0000-4000-8000-000000000002',
      current_setting('test.delete99_requested_at')::timestamptz) then
    raise exception '99 FAIL: early purge preparation succeeded';
  end if;
end $$;
reset role;
set local role service_role;
do $$ begin
  if public.prepare_account_deletion_for_purge(
      '99000000-0000-4000-8000-000000000002',
      clock_timestamp()) then
    raise exception '99 FAIL: wrong immutable request timestamp was accepted';
  end if;
end $$;
reset role;
update account_deletion_requests r
   set requested_at=t.value,
       purge_after=t.value+interval '30 days'
  from (select clock_timestamp()-interval '31 days' as value) t
 where user_id='99000000-0000-4000-8000-000000000002';
select set_config('test.delete99_requested_at',requested_at::text,true)
  from account_deletion_requests
 where user_id='99000000-0000-4000-8000-000000000002';
set local role authenticated;
set local "test.uid"='99000000-0000-4000-8000-000000000002';
do $$ declare v_state text; v_message text; v_status jsonb; begin
  v_status:=public.get_my_account_deletion();
  if v_status->>'status'<>'expired' then
    raise exception '99 FAIL: expired server state was %',v_status;
  end if;
  begin
    perform public.reactivate_account('99000000-0000-4000-8000-000000000002');
    raise exception '99 FAIL: expired deletion was restored';
  exception when others then
    get stacked diagnostics v_state=returned_sqlstate,v_message=message_text;
    if v_state<>'42501' or v_message<>'ACCOUNT_DELETION_EXPIRED' then
      raise exception '99 FAIL: expired recovery result was % %',v_state,v_message;
    end if;
  end;
end $$;
reset role;
select set_config('test.uid','',true);
insert into walls(id,owner_id,type,name,visibility,contribution_policy,allow_anonymous,require_approval)
values('99000000-0000-4000-8000-000000000020',
       '99000000-0000-4000-8000-000000000003','shared','Late ownership',
       'private','nobody',false,false);
-- Model a defensive late-ownership anomaly through the same narrow transaction
-- authorization required by the immutable-owner trigger. The public transfer
-- RPC correctly refuses inactive targets; purge must still fail closed if an
-- operator/backfill creates this state.
insert into wall_ownership_transfer_authorizations(
  transaction_id,wall_id,old_owner_id,new_owner_id
) values(
  txid_current(),'99000000-0000-4000-8000-000000000020',
  '99000000-0000-4000-8000-000000000003','99000000-0000-4000-8000-000000000002'
);
update walls set owner_id='99000000-0000-4000-8000-000000000002'
 where id='99000000-0000-4000-8000-000000000020';
set local role service_role;
do $$ begin
  if public.prepare_account_deletion_for_purge(
      '99000000-0000-4000-8000-000000000002',
      current_setting('test.delete99_requested_at')::timestamptz) then
    raise exception '99 FAIL: purge ignored late Shared-Wall ownership';
  end if;
end $$;
reset role;
delete from walls where id='99000000-0000-4000-8000-000000000020';
set local role service_role;
do $$ begin
  if (select count(*) from public.list_due_account_deletions(10)
       where user_id='99000000-0000-4000-8000-000000000002')<>1
     or exists(select 1 from public.list_due_account_deletions(0)) then
    raise exception '99 FAIL: bounded due-work discovery is wrong';
  end if;
end $$;
reset role;
insert into storage.objects(bucket_id,name,owner,owner_id)
values('attachments','avatars/99000000-0000-4000-8000-000000000002/avatar.jpg',
       '99000000-0000-4000-8000-000000000002',
       '99000000-0000-4000-8000-000000000002');
set local role service_role;
do $$ begin
  if public.prepare_account_deletion_for_purge(
      '99000000-0000-4000-8000-000000000002',
      current_setting('test.delete99_requested_at')::timestamptz) then
    raise exception '99 FAIL: purge ignored avatar cleanup precondition';
  end if;
end $$;
reset role;
delete from storage.objects
 where bucket_id='attachments'
   and name='avatars/99000000-0000-4000-8000-000000000002/avatar.jpg';
set local role service_role;
do $$ begin
  if not public.prepare_account_deletion_for_purge(
      '99000000-0000-4000-8000-000000000002',
      current_setting('test.delete99_requested_at')::timestamptz) then
    raise exception '99 FAIL: due purge preparation did not complete';
  end if;
end $$;
reset role;
do $$ begin
  if not exists(select 1 from auth.users where id='99000000-0000-4000-8000-000000000002')
     or exists(select 1 from marks where id in(
       '99000000-0000-4000-8000-000000000010',
       '99000000-0000-4000-8000-000000000012'))
     or exists(select 1 from anonymous_mark_authors
        where mark_id='99000000-0000-4000-8000-000000000012') then
    raise exception '99 FAIL: purge preparation did not preserve auth or delete normal/anonymous Marks';
  end if;
end $$;
-- The hosted worker uses auth.admin.deleteUser(). The local shim has no Auth
-- API, so this direct delete simulates only that API's final FK-cascade effect.
delete from auth.users where id='99000000-0000-4000-8000-000000000002';
do $$ begin
  if exists(select 1 from auth.users where id='99000000-0000-4000-8000-000000000002')
     or exists(select 1 from profiles where id='99000000-0000-4000-8000-000000000002')
     or exists(select 1 from walls where owner_id='99000000-0000-4000-8000-000000000002')
     or exists(select 1 from marks where id in(
       '99000000-0000-4000-8000-000000000010',
       '99000000-0000-4000-8000-000000000011'))
     or exists(select 1 from account_deletion_requests where user_id='99000000-0000-4000-8000-000000000002') then
    raise exception '99 FAIL: final purge left identity/content state behind';
  end if;
  if not exists(select 1 from auth.users where id='99000000-0000-4000-8000-000000000003') then
    raise exception '99 FAIL: final purge removed the unrelated owner';
  end if;
end $$;
rollback;
\echo '99 (deadline + avatar + full purge) : PASS'

\echo '── 99_recoverable_account_deletion: ALL PASS ──'
