\set ON_ERROR_STOP on

-- Poll moderation remains a held schema draft. These run only in disposable DB.
do $$
begin
  if has_function_privilege('anon','public.admin_remove_poll(uuid,uuid,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.admin_remove_poll(uuid,uuid,text)','EXECUTE')
    or has_function_privilege('service_role','public.admin_remove_poll(uuid,uuid,text)','EXECUTE') then
    raise exception '85 FAIL: privileged Poll removal ACL';
  end if;
  if not (select prosecdef from pg_proc where oid='public.admin_remove_poll(uuid,uuid,text)'::regprocedure) then
    raise exception '85 FAIL: Poll moderation RPC not definer';
  end if;
  if not exists (select 1 from pg_constraint
    where conname='reports_one_target' and pg_get_constraintdef(oid) like '%reported_poll_id%') then
    raise exception '85 FAIL: Poll target is not exclusive';
  end if;
end $$;
\echo '85 (Poll moderation ACL and exclusivity): PASS'

begin;
insert into public.mark_polls(mark_id,wall_id,author_id,status,question,selection_mode)
 values('85000000-0000-4000-8000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111',
        'active','Report this poll','single');
insert into public.mark_poll_options(mark_id,position,label)
 values('85000000-0000-4000-8000-000000000001',0,'One'),
       ('85000000-0000-4000-8000-000000000001',1,'Two');

-- Non-admin cannot remove an otherwise legitimate Poll.
set local role authenticated;
set local "test.uid"='22222222-2222-2222-2222-222222222222';
do $$
declare v_error text;
begin
  begin
    perform public.admin_remove_poll(auth.uid(),'85000000-0000-4000-8000-000000000001','spam');
    raise exception '85 FAIL: ordinary user removed Poll';
  exception when others then
    get stacked diagnostics v_error=returned_sqlstate;
    if v_error <> '42501' then raise exception '85 FAIL: wrong denial %',v_error; end if;
  end;
end $$;

-- Authorized administrator removes the Poll and generates exactly one audit row.
reset role;
update public.profiles set is_admin=true where id='55555555-5555-5555-5555-555555555555';
set local role authenticated;
set local "test.uid"='55555555-5555-5555-5555-555555555555';
select public.admin_remove_poll(auth.uid(),'85000000-0000-4000-8000-000000000001','spam');
select public.admin_remove_poll(auth.uid(),'85000000-0000-4000-8000-000000000001','spam');
reset role;
do $$
begin
  if (select status from public.mark_polls where mark_id='85000000-0000-4000-8000-000000000001') <> 'removed'
     or (select count(*) from public.moderation_actions
         where target_poll_id='85000000-0000-4000-8000-000000000001'
           and action='remove_poll') <> 1 then
    raise exception '85 FAIL: Poll removal not atomic and idempotent';
  end if;
end $$;
rollback;
\echo '85 (admin-only audited Poll removal): PASS'
