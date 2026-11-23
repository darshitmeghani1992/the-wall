-- 63_secret_removed_reveal.sql · issue #66: removing a Secret is irreversible.
-- Disposable DB only; all fixtures roll back and use the existing seeded actors.
\set ON_ERROR_STOP on

do $$ begin
  if has_function_privilege('anon','public.reveal_secret(uuid)','execute')
     or not has_function_privilege('authenticated','public.reveal_secret(uuid)','execute')
     or has_function_privilege('anon','public.scrub_removed_secret_payload()','execute')
     or has_function_privilege('authenticated','public.scrub_removed_secret_payload()','execute')
     or has_function_privilege('authenticated','public.expire_secret_marks()','execute') then
    raise exception '63 FAIL: Secret reveal/scrub/expiry ACLs are unsafe';
  end if;
  if (select count(*) from pg_trigger
       where tgrelid='public.marks'::regclass
         and tgname='zzz_scrub_removed_secret_payload'
         and not tgisinternal) <> 1 then
    raise exception '63 FAIL: removal scrubbing trigger missing or duplicated';
  end if;
end $$;
\echo '63 (Secret reveal/cleanup privilege and trigger guards): PASS'

-- Owner soft-removal must immediately scrub the side-table content. Even a
-- later privileged restoration must NOT resurrect the previously removed text.
begin;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; begin
  r:=public.create_mark('63000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','text','do not reveal after removal',
    null,false,true,0,'{}'::uuid[]);
  if r->>'status'<>'created' then raise exception '63 FAIL: setup %',r; end if;
  perform set_config('test.mark63_removed',r->>'mark_id',true);
end $$;

reset role;
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
update public.marks set status='removed', removal_reason='safety'
 where id=current_setting('test.mark63_removed')::uuid;
do $$ declare r jsonb; begin
  r:=public.reveal_secret(current_setting('test.mark63_removed')::uuid);
  if r <> '{"ok": false, "reason": "missing"}'::jsonb or r ? 'content' then
    raise exception '63 FAIL: removed Secret still yielded a response: %',r;
  end if;
end $$;

reset role;
do $$ begin
  if exists(select 1 from public.mark_secrets
             where mark_id=current_setting('test.mark63_removed')::uuid) then
    raise exception '63 FAIL: removed Secret payload not scrubbed';
  end if;
end $$;
-- Only a privileged service could reactivate this retired row. It must not
-- restore content or allow a second reveal; the grant does not change here.
update public.marks set status='active'
 where id=current_setting('test.mark63_removed')::uuid;
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
do $$ declare r jsonb; begin
  r:=public.reveal_secret(current_setting('test.mark63_removed')::uuid);
  if r <> '{"ok": false, "reason": "missing"}'::jsonb or r ? 'content' then
    raise exception '63 FAIL: restored removed Secret leaked: %',r;
  end if;
end $$;
rollback;
\echo '63 (owner removal scrubs; restoration cannot reveal): PASS'

-- Active Secret one-time reveal still works. An unrelated actor must not learn
-- whether the recipient has opened the Secret.
begin;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; begin
  r:=public.create_mark('63000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','text','active reveal unchanged',
    null,false,true,0,'{}'::uuid[]);
  if r->>'status'<>'created' then raise exception '63 FAIL: active setup %',r; end if;
  perform set_config('test.mark63_active',r->>'mark_id',true);
end $$;
reset role;
set local role authenticated;
set local "test.uid"='22222222-2222-2222-2222-222222222222';
do $$ declare r jsonb; begin
  r:=public.reveal_secret(current_setting('test.mark63_active')::uuid);
  if r <> '{"ok": false, "reason": "not_authorized"}'::jsonb or r ? 'content' then
    raise exception '63 FAIL: outsider received Secret state/content: %',r;
  end if;
end $$;
reset role;
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
do $$ declare r jsonb; begin
  r:=public.reveal_secret(current_setting('test.mark63_active')::uuid);
  if r->>'ok'<>'true' or r->>'content'<>'active reveal unchanged' then
    raise exception '63 FAIL: active first reveal broken: %',r;
  end if;
  r:=public.reveal_secret(current_setting('test.mark63_active')::uuid);
  if r <> '{"ok": false, "reason": "consumed"}'::jsonb or r ? 'content' then
    raise exception '63 FAIL: consumed Secret revealed twice: %',r;
  end if;
end $$;
rollback;
\echo '63 (active/outsider/one-time reveal parity): PASS'

-- The established expiry API must still report purged rows after its Mark
-- update invokes the new scrubbing trigger.
begin;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; begin
  r:=public.create_mark('63000000-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','text','expire with scrub trigger',
    null,false,true,0,'{}'::uuid[]);
  if r->>'status'<>'created' then raise exception '63 FAIL: expiry setup %',r; end if;
  perform set_config('test.mark63_expired',r->>'mark_id',true);
end $$;
reset role;
update public.mark_secrets set expires_at=now()-interval '1 minute'
 where mark_id=current_setting('test.mark63_expired')::uuid;
do $$ declare n integer; begin
  n:=public.expire_secret_marks();
  if n<1 then raise exception '63 FAIL: expiry count not preserved: %',n; end if;
  if exists(select 1 from public.mark_secrets
             where mark_id=current_setting('test.mark63_expired')::uuid)
     or (select status from public.marks
           where id=current_setting('test.mark63_expired')::uuid)<>'removed' then
    raise exception '63 FAIL: expiry did not remove shell and payload';
  end if;
end $$;
rollback;
\echo '63 (expiry count and purge preserved): PASS'
