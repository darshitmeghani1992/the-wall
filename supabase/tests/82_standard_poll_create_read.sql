\set ON_ERROR_STOP on
begin;

do $$
begin
  if (select creation_enabled from public.mark_poll_rollout where singleton) is distinct from false
     or has_table_privilege('authenticated','public.mark_polls','SELECT')
     or has_table_privilege('anon','public.mark_poll_options','SELECT')
     or has_table_privilege('service_role','public.mark_poll_creation_requests','INSERT')
     or has_function_privilege('authenticated','public.poll_mark_envelope_v2(public.marks,uuid)','EXECUTE') then
    raise exception '82 FAIL: default rollout or private grants';
  end if;
  if not exists (select 1 from public.marks where id='82000000-0000-4000-8000-000000000000' and type='poll') then
    raise exception '82 FAIL: missing legacy fixture';
  end if;
  if has_function_privilege('authenticated','public.private_poll_envelope_v2(public.mark_polls,uuid)','EXECUTE')
     or exists (select 1 from pg_publication_tables where schemaname='public'
       and tablename in ('mark_polls','mark_poll_options','mark_poll_rollout','mark_poll_creation_requests')) then
    raise exception '82 FAIL: provider publication or private helper access';
  end if;
end $$;

update public.walls set visibility='private' where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
update public.walls set visibility='public',contribution_policy='everyone'
  where owner_id='44444444-4444-4444-4444-444444444444' and type='personal';
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$
begin
  if public.create_poll_mark(auth.uid(),'82000000-0000-4000-8000-000000000010','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'single','Question',array['A','B'],false,false) <> '{"status":"unavailable"}'::jsonb then
    raise exception '82 FAIL: creation enabled by default';
  end if;
end $$;

-- Disposable only. Production application roles cannot unlock this gate.
reset role;
update public.mark_poll_rollout set creation_enabled=true where singleton;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$
declare
  v_wall uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_request uuid := '82000000-0000-4000-8000-000000000010';
  v_legacy uuid := '82000000-0000-4000-8000-000000000000';
  v_personal uuid;
  v_result jsonb;
  v_poll uuid;
  v_page jsonb;
  v_cursor jsonb;
begin
  if public.create_poll_mark(auth.uid(),v_request,v_wall,'single','Question',array['A',' a '],false,false)
       <> '{"status":"invalid"}'::jsonb
     or public.create_poll_mark(auth.uid(),v_request,v_wall,'single','Question',array['A','B'],false,true)
       <> '{"status":"invalid"}'::jsonb
     or public.create_poll_mark(auth.uid(),v_request,v_wall,'multiple','Question',array['A'],false,false)
       <> '{"status":"invalid"}'::jsonb then raise exception '82 FAIL: forbidden poll input'; end if;
  v_result := public.create_poll_mark(auth.uid(),v_request,v_wall,'single',' Which project? ',array[' A ','B'],false,false);
  if v_result->>'status' is distinct from 'created' then raise exception '82 FAIL: Shared create %',v_result; end if;
  v_poll := (v_result->>'mark_id')::uuid;
  perform set_config('tw.poll_mark',v_poll::text,true);
  v_result := public.create_poll_mark(auth.uid(),v_request,v_wall,'single','Which project?',array['A','B'],false,false);
  if v_result->>'status' is distinct from 'existing' or v_result->>'mark_id' is distinct from v_poll::text then
    raise exception '82 FAIL: normalized replay %',v_result;
  end if;
  if public.create_poll_mark(auth.uid(),v_request,v_wall,'single','Changed',array['A','B'],false,false)
       <> '{"status":"request_id_reused"}'::jsonb then raise exception '82 FAIL: changed replay accepted'; end if;
  if exists(select 1 from public.marks where id in (v_poll,v_legacy)) then
    raise exception '82 FAIL: legacy raw reader saw poll';
  end if;
  v_result := public.get_wall_mark_v2(auth.uid(),v_wall,v_poll);
  if v_result #>> '{item,kind}' is distinct from 'poll'
     or v_result #>> '{item,poll,question}' is distinct from 'Which project?'
     or v_result #>> '{item,poll,options,0,label}' is distinct from 'A'
     or v_result #>> '{item,poll,results,ballot_total}' is distinct from '0'
     or v_result #>> '{item,poll,capabilities,can_vote}' is distinct from 'false' then
    raise exception '82 FAIL: v2 poll detail %',v_result;
  end if;
  v_page := public.list_wall_marks_v2(auth.uid(),v_wall,null,null,null,null,1);
  v_cursor := v_page->'next_cursor';
  if v_page #>> '{items,0,mark,id}' is distinct from v_poll::text or v_cursor = 'null'::jsonb then
    raise exception '82 FAIL: v2 first page %',v_page;
  end if;
  v_page := public.list_wall_marks_v2(auth.uid(),v_wall,(v_cursor->>'pinned')::boolean,
    (v_cursor->>'created_at')::timestamptz,(v_cursor->>'mark_id')::uuid,v_cursor->>'kind',1);
  if v_page #>> '{items,0,kind}' is distinct from 'mark' then raise exception '82 FAIL: mixed pagination %',v_page; end if;
  v_result := public.read_poll_marks(auth.uid(),v_wall,array[v_legacy,v_poll]);
  if jsonb_array_length(v_result->'items') is distinct from 1 or v_result #>> '{items,0,mark_id}' is distinct from v_poll::text then
    raise exception '82 FAIL: batch legacy leakage %',v_result;
  end if;
  select id into v_personal from public.walls where owner_id='44444444-4444-4444-4444-444444444444' and type='personal';
  v_result := public.create_poll_mark(auth.uid(),'82000000-0000-4000-8000-000000000011',
    v_personal,'multiple','Which choices?',array['A','B','C','D','E','F'],false,false);
  if v_result->>'status' is distinct from 'created' then raise exception '82 FAIL: Personal multiple %',v_result; end if;
  v_result := public.get_wall_mark_v2(auth.uid(),v_personal,(v_result->>'mark_id')::uuid);
  if v_result #>> '{item,poll,selection_mode}' is distinct from 'multiple'
     or jsonb_array_length(v_result #> '{item,poll,options}') is distinct from 6 then
    raise exception '82 FAIL: Personal multiple shape %',v_result;
  end if;
end $$;

set local "test.uid"='22222222-2222-2222-2222-222222222222';
do $$
declare v_poll uuid := current_setting('tw.poll_mark')::uuid;
begin
  if public.get_wall_mark_v2(auth.uid(),'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_poll) <> '{"status":"unavailable"}'::jsonb
     or public.get_wall_mark_v2('11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_poll)
       <> '{"status":"unavailable"}'::jsonb then
    raise exception '82 FAIL: outsider or wrong actor acquired poll';
  end if;
end $$;
reset role;
set constraints all immediate;
do $$
begin
  if exists(select 1 from public.notifications where mark_id=current_setting('tw.poll_mark')::uuid) then
    raise exception '82 FAIL: poll escaped to legacy Alerts';
  end if;
  if exists (select 1 from public.marks where id=current_setting('tw.poll_mark')::uuid) then
    raise exception '82 FAIL: new Poll stored in legacy Mark table';
  end if;
end $$;

-- Type-sensitive pagination and focus distinguish a legitimate synthetic tie.
set local "test.uid"='11111111-1111-1111-1111-111111111111';
insert into public.marks(id,wall_id,author_id,type,text,created_at)
select mark_id,wall_id,author_id,'text','Same-key ordinary fixture',created_at
from public.mark_polls where mark_id=current_setting('tw.poll_mark')::uuid;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$
declare
  v_wall uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_poll uuid := current_setting('tw.poll_mark')::uuid;
  v_page jsonb;
  v_cursor jsonb;
begin
  if public.get_wall_mark_v2(auth.uid(),v_wall,v_poll) <> '{"status":"unavailable"}'::jsonb
     or public.get_wall_mark_item_v2(auth.uid(),v_wall,v_poll,'poll') #>> '{item,kind}' is distinct from 'poll'
     or public.get_wall_mark_item_v2(auth.uid(),v_wall,v_poll,'mark') #>> '{item,kind}' is distinct from 'mark'
     or public.get_wall_mark_item_v2(auth.uid(),v_wall,v_poll,'other') <> '{"status":"unavailable"}'::jsonb then
    raise exception '82 FAIL: exact typed focus and ambiguous legacy fallback';
  end if;
  v_page := public.list_wall_marks_v2(auth.uid(),v_wall,null,null,null,null,1);
  v_cursor := v_page->'next_cursor';
  if v_cursor->>'kind' is distinct from 'poll' or v_cursor->>'mark_id' is distinct from v_poll::text then
    raise exception '82 FAIL: mixed tie cursor %',v_page;
  end if;
  v_page := public.list_wall_marks_v2(auth.uid(),v_wall,(v_cursor->>'pinned')::boolean,
    (v_cursor->>'created_at')::timestamptz,(v_cursor->>'mark_id')::uuid,v_cursor->>'kind',1);
  if v_page #>> '{items,0,kind}' is distinct from 'mark' or v_page #>> '{items,0,mark,id}' is distinct from v_poll::text
     or public.list_wall_marks_v2(auth.uid(),v_wall,null,null,null,'poll',1) <> '{"status":"invalid"}'::jsonb then
    raise exception '82 FAIL: keyset skipped same-key ordinary result or accepted partial cursor %',v_page;
  end if;
end $;

-- A mixed v2 Wall history must not strip fields required by ordinary
-- photo/voice/video Marks. Exercise the private projection on a synthetic
-- record derived from a legitimate visible text fixture; no media URI or
-- payload is persisted and this does not grant new table access.
do $media_projection$
declare
  v_mark public.marks%rowtype;
  v_item jsonb;
begin
  select * into v_mark from public.marks
    where id=current_setting('tw.poll_mark')::uuid and type='text';
  if not found then raise exception '82 FAIL: missing ordinary projection fixture'; end if;
  v_mark.type := 'voice'::public.mark_type;
  v_mark.media_url := 'https://example.invalid/synthetic-voice.m4a';
  v_mark.payload := '{"durationMs":59000}'::jsonb;
  v_item := public.poll_mark_envelope_v2(v_mark,auth.uid());
  if v_item #>> '{mark,media_url}' is distinct from v_mark.media_url
     or v_item #>> '{mark,payload,durationMs}' is distinct from '59000'
     or v_item #>> '{mark,type}' is distinct from 'voice'
     or (v_item->'mark') ? 'removed_by' then
    raise exception '82 FAIL: mixed v2 ordinary media projection %',v_item;
  end if;
end $media_projection$;
reset role;
delete from public.mark_polls where mark_id=current_setting('tw.poll_mark')::uuid;
do $$
begin
  if exists (select 1 from public.mark_poll_options where mark_id=current_setting('tw.poll_mark')::uuid)
     or not exists (select 1 from public.marks where id=current_setting('tw.poll_mark')::uuid
       and text='Same-key ordinary fixture') then
    raise exception '82 FAIL: independent parent removal did not preserve the ordinary row';
  end if;
end $$;
rollback;
\echo '82 (standard poll create/read, typed keyset, legacy separation) : PASS'
