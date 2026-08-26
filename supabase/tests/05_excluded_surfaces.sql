-- 05 · Package B + A1 media fail-closed contract
\set ON_ERROR_STOP on

-- Comments/polls have no app privileges and comments left Realtime.
do $$ begin
  if has_table_privilege('authenticated','comments','select')
     or has_table_privilege('authenticated','comments','insert')
     or has_table_privilege('authenticated','poll_votes','select')
     or has_table_privilege('authenticated','poll_votes','insert') then
    raise exception '05 FAIL: excluded surface retains app privileges';
  end if;
  if exists (select 1 from pg_publication_tables
              where pubname='supabase_realtime' and schemaname='public' and tablename='comments') then
    raise exception '05 FAIL: comments remain in Realtime publication';
  end if;
end $$;
\echo '05 (comments/polls disabled)       : PASS  (privileges + Realtime revoked)'

-- Historical rows survive but retired Mark types are invisible to app clients.
BEGIN;
reset role;
insert into marks (id, wall_id, author_id, type, text)
values ('05000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111','poll','legacy');
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';
do $$ declare n int; rejected boolean := false; begin
  select count(*) into n from marks where id='05000000-0000-0000-0000-000000000001';
  if n <> 0 then raise exception '05 FAIL: retired Mark visible to app'; end if;
  begin
    insert into marks (wall_id,author_id,type,text)
      values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',auth.uid(),'doodle','retired');
  exception when others then rejected := true; end;
  if not rejected then raise exception '05 FAIL: app created retired Mark type'; end if;
end $$;
ROLLBACK;
\echo '05 (retired Mark types)            : PASS  (preserved for moderation; app-hidden)'

-- Compatibility phase: only text/null-media inserts survive.
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111'; -- accepted W_O member
do $$ declare rejected_photo boolean:=false; rejected_url boolean:=false; rejected_payload boolean:=false; begin
  begin insert into marks (wall_id,author_id,type,text)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',auth.uid(),'photo','x');
  exception when others then rejected_photo:=true; end;
  begin insert into marks (wall_id,author_id,type,text,media_url)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',auth.uid(),'text','x','https://public/x');
  exception when others then rejected_url:=true; end;
  begin insert into marks (wall_id,author_id,type,text,payload)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',auth.uid(),'text','x','{"url":"x"}'::jsonb);
  exception when others then rejected_payload:=true; end;
  if not (rejected_photo and rejected_url and rejected_payload) then
    raise exception '05 FAIL: old media-bearing Mark shape was accepted';
  end if;
  if exists (select 1 from notifications where actor_id=auth.uid() and mark_id is not null
             and created_at >= transaction_timestamp()) then
    raise exception '05 FAIL: rejected media insert created an Alert';
  end if;
end $$;
ROLLBACK;
\echo '05 (legacy media Mark insert)      : PASS  (photo/url/payload fail atomically)'

-- SECURITY DEFINER hygiene: protected helpers are fixed-path and not app-callable.
do $$ declare bad int; begin
  select count(*) into bad from pg_proc p
   join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and p.proname in ('lock_user_pair','write_notification')
     and (not p.prosecdef or not ('search_path=pg_catalog, public'=any(p.proconfig)));
  if bad <> 0 then raise exception '05 FAIL: protected helper lacks DEFINER/fixed path'; end if;
  if has_function_privilege('authenticated','lock_user_pair(uuid,uuid)','execute')
     or has_function_privilege('authenticated','write_notification(uuid,uuid,uuid,text,uuid,uuid)','execute') then
    raise exception '05 FAIL: protected helper executable by app role';
  end if;
end $$;
\echo '05 (DEFINER hygiene)               : PASS  (fixed path; narrow execution)'

