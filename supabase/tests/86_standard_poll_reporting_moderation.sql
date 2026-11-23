\set ON_ERROR_STOP on
-- Disposable, rolled-back actor-bound Poll moderation contract. No hosted writes.
begin;

do $$
begin
  if has_table_privilege('authenticated','public.mark_polls','SELECT')
     or has_function_privilege('anon','public.report_poll_mark(uuid,uuid,text,text)','EXECUTE')
     or has_function_privilege('service_role','public.report_poll_mark(uuid,uuid,text,text)','EXECUTE')
     or has_function_privilege('anon','public.admin_remove_poll_mark(uuid,uuid,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.report_poll_mark(uuid,uuid,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_remove_poll_mark(uuid,uuid,text)','EXECUTE')
     or not exists (select 1 from pg_trigger where tgrelid='public.reports'::regclass
       and tgname='reports_private_poll_insert_guard' and not tgisinternal) then
    raise exception '86 FAIL: grants/private reporting guard';
  end if;
  if (select creation_enabled from public.mark_poll_rollout where singleton) then
    raise exception '86 FAIL: poll creation unexpectedly enabled';
  end if;
end $$;

-- Open ONLY for transaction-scoped fixture creation.
update public.mark_poll_rollout set creation_enabled = true where singleton;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';
do $$
declare v_result jsonb; v_poll uuid; v_sqlstate text;
begin
  v_result := public.create_poll_mark(auth.uid(),'86000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','single','Report me?',array['A','B'],false,false);
  if v_result->>'status' is distinct from 'created' then
    raise exception '86 FAIL: fixture creation %',v_result; end if;
  v_poll := (v_result->>'mark_id')::uuid;
  perform set_config('tw.report_poll',v_poll::text,true);

  -- Deny direct client inserts even where the legacy reporter-self policy passes.
  begin
    insert into public.reports(reporter_id,poll_mark_id,reason)
      values(auth.uid(),v_poll,'spam');
    raise exception '86 FAIL: direct Poll report insert succeeded';
  exception when sqlstate '42501' then null;
  end;
  -- Exact session/actor binding, and indistinguishable nonexistent-target denial.
  begin
    perform public.report_poll_mark('22222222-2222-2222-2222-222222222222',v_poll,'spam');
    raise exception '86 FAIL: forged Poll report succeeded';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.report_poll_mark(auth.uid(),'86000000-0000-4000-8000-000000000099','spam');
    raise exception '86 FAIL: unknown Poll report succeeded';
  exception when sqlstate '42501' then null;
  end;
  perform public.report_poll_mark(auth.uid(),v_poll,'spam','   actionable details   ');
  -- Existing ordinary report insert remains legal and typed separately.
  insert into public.reports(reporter_id,mark_id,reason)
    values(auth.uid(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','spam');
end $$;
reset role;
do $$
declare v_poll uuid := current_setting('tw.report_poll')::uuid;
begin
  if (select count(*) from public.reports where poll_mark_id=v_poll) <> 1
     or not exists (select 1 from public.reports
         where poll_mark_id=v_poll and reporter_id='11111111-1111-1111-1111-111111111111'
           and details='actionable details')
     or not exists(select 1 from public.reports
         where mark_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1' and reason='spam') then
    raise exception '86 FAIL: report target/legacy parity';
  end if;
end $$;

-- Distinct ordinary user cannot access admin capability.
set local role authenticated;
set local "test.uid"='22222222-2222-2222-2222-222222222222';
do $$
begin
  begin
    perform public.admin_remove_poll_mark(auth.uid(),current_setting('tw.report_poll')::uuid,'moderation');
    raise exception '86 FAIL: non-admin removed poll';
  exception when sqlstate '42501' then null;
  end;
end $$;
reset role;

update public.profiles set is_admin=true where id='55555555-5555-5555-5555-555555555555';
set local role authenticated;
set local "test.uid"='55555555-5555-5555-5555-555555555555';
do $$
declare v_poll uuid := current_setting('tw.report_poll')::uuid;
begin
  begin
    perform public.admin_remove_poll_mark('11111111-1111-1111-1111-111111111111',v_poll,'moderation');
    raise exception '86 FAIL: forged admin actor';
  exception when sqlstate '42501' then null;
  end;
  perform public.admin_remove_poll_mark(auth.uid(),v_poll,'reviewed Poll violation');
  -- A second admin tap is idempotent and produces no duplicate receipt.
  perform public.admin_remove_poll_mark(auth.uid(),v_poll,'reviewed Poll violation');
end $$;
reset role;
do $$
declare v_poll uuid := current_setting('tw.report_poll')::uuid;
begin
  if (select status from public.mark_polls where mark_id=v_poll) <> 'removed'
     or (select count(*) from public.moderation_actions
          where target_poll_mark_id=v_poll and action='remove_mark') <> 1 then
    raise exception '86 FAIL: Poll removal state/receipt';
  end if;
end $$;

set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$
declare v_poll uuid := current_setting('tw.report_poll')::uuid;
begin
  if public.get_wall_mark_item_v2(auth.uid(),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_poll,'poll')
      <> '{"status":"unavailable"}'::jsonb then
    raise exception '86 FAIL: removed poll still visible';
  end if;
  begin
    perform public.report_poll_mark(auth.uid(),v_poll,'spam');
    raise exception '86 FAIL: removed Poll reported again';
  exception when sqlstate '42501' then null;
  end;
end $$;
reset role;
rollback;
\echo '86 (private Poll reporting and audited admin removal): PASS'
