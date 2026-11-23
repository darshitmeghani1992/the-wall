\set ON_ERROR_STOP on
begin;
do $$
begin
  if (select voting_enabled from public.mark_poll_rollout where singleton) is distinct from false
     or has_table_privilege('authenticated','public.mark_poll_ballots','SELECT')
     or has_table_privilege('authenticated','public.mark_poll_ballot_choices','INSERT')
     or has_table_privilege('anon','public.mark_poll_mutation_requests','SELECT')
     or has_function_privilege('anon','public.replace_poll_ballot(uuid,uuid,uuid,uuid,bigint,bigint,uuid[])','EXECUTE')
  then raise exception '83 FAIL: gate or private ACL'; end if;
end $$;
-- The new create and ballot gates are independently held by the server.
update public.mark_poll_rollout set creation_enabled=true where singleton;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$
declare v_result jsonb;
begin
  v_result := public.create_poll_mark(auth.uid(),'83000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','single','Voter test',array['A','B'],false,false);
  if v_result->>'status' is distinct from 'created' then raise exception '83 FAIL: create %',v_result; end if;
  perform set_config('tw.vote_mark',v_result->>'mark_id',true);
  v_result := public.replace_poll_ballot(auth.uid(),'83000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',current_setting('tw.vote_mark')::uuid,1,0,
    array['83000000-0000-4000-8000-000000000003']::uuid[]);
  if v_result<>'{"status":"unavailable"}'::jsonb then
    raise exception '83 FAIL: disabled vote %',v_result;
  end if;
end $$;
reset role;
select set_config('tw.option_a', option_id::text,true)
  from public.mark_poll_options where mark_id=current_setting('tw.vote_mark')::uuid and position=0;
select set_config('tw.option_b', option_id::text,true)
  from public.mark_poll_options where mark_id=current_setting('tw.vote_mark')::uuid and position=1;
-- Enable only inside a rolled-back, disposable test transaction.
update public.mark_poll_rollout set voting_enabled=true where singleton;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$
declare
  v_mark uuid := current_setting('tw.vote_mark')::uuid;
  v_a uuid := current_setting('tw.option_a')::uuid;
  v_b uuid := current_setting('tw.option_b')::uuid;
  v_result jsonb;
begin
  if public.replace_poll_ballot('22222222-2222-2222-2222-222222222222',
      '83000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      v_mark,1,0,array[v_a]) <> '{"status":"unavailable"}'::jsonb then
    raise exception '83 FAIL: forged actor'; end if;
  if public.replace_poll_ballot(auth.uid(),'83000000-0000-4000-8000-000000000002',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_mark,1,0,array[v_a,v_b])
      <> '{"status":"invalid"}'::jsonb then raise exception '83 FAIL: single accepted many'; end if;
  if public.replace_poll_ballot(auth.uid(),'83000000-0000-4000-8000-000000000002',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_mark,1,0,array[v_a,v_a])
      <> '{"status":"invalid"}'::jsonb then raise exception '83 FAIL: duplicate vote'; end if;
  v_result := public.replace_poll_ballot(auth.uid(),'83000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_mark,1,0,array[v_a]);
  if v_result->>'status' is distinct from 'applied' or v_result #>> '{ballot,revision}' is distinct from '1' then
    raise exception '83 FAIL: first vote %',v_result; end if;
  v_result := public.replace_poll_ballot(auth.uid(),'83000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_mark,1,0,array[v_a]);
  if v_result->>'status' is distinct from 'existing' then raise exception '83 FAIL: replay %',v_result; end if;
  if public.replace_poll_ballot(auth.uid(),'83000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_mark,1,0,array[v_b])
    <> '{"status":"request_id_reused"}'::jsonb then raise exception '83 FAIL: changed replay'; end if;
  v_result := public.replace_poll_ballot(auth.uid(),'83000000-0000-4000-8000-000000000005',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_mark,1,1,array[v_b]);
  if v_result->>'status' is distinct from 'applied' or v_result #>> '{ballot,revision}' is distinct from '2'
    then raise exception '83 FAIL: replacement %',v_result; end if;
  v_result := public.get_wall_mark_v2(auth.uid(),'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_mark);
  if v_result #>> '{item,poll,results,ballot_total}' is distinct from '1'
    or v_result #>> '{item,poll,ballot,revision}' is distinct from '2'
    or v_result #>> '{item,poll,capabilities,can_vote}' is distinct from 'true'
    then raise exception '83 FAIL: tally own ballot %',v_result; end if;
  if public.replace_poll_ballot(auth.uid(),'83000000-0000-4000-8000-000000000006',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_mark,1,1,array[v_a])
    <> '{"status":"conflict"}'::jsonb then raise exception '83 FAIL: stale ballot revision'; end if;
  v_result := public.close_poll_mark(auth.uid(),'83000000-0000-4000-8000-000000000007',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_mark,1);
  if v_result->>'status' is distinct from 'closed' or v_result->>'revision' is distinct from '2'
    then raise exception '83 FAIL: author close %',v_result; end if;
  v_result := public.close_poll_mark(auth.uid(),'83000000-0000-4000-8000-000000000007',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_mark,1);
  if v_result->>'status' is distinct from 'existing' then raise exception '83 FAIL: close replay %',v_result; end if;
  if public.replace_poll_ballot(auth.uid(),'83000000-0000-4000-8000-000000000008',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_mark,2,2,array[v_a])
    <> '{"status":"closed"}'::jsonb then raise exception '83 FAIL: voted after close'; end if;
end $$;
set local "test.uid"='33333333-3333-3333-3333-333333333333';
do $$
declare v_mark uuid := current_setting('tw.vote_mark')::uuid;
begin
  if public.get_wall_mark_v2(auth.uid(),'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_mark)
       <> '{"status":"unavailable"}'::jsonb
    or public.replace_poll_ballot(auth.uid(),'83000000-0000-4000-8000-000000000009',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',v_mark,2,0,
      array[current_setting('tw.option_a')::uuid])
      <> '{"status":"unavailable"}'::jsonb then
    raise exception '83 FAIL: blocked outsider saw/voted'; end if;
end $$;
reset role;
-- A separate, disposable voter on someone else's personal Wall proves
-- deleting the Auth identity removes votes from a CLOSED poll without
-- deleting the poll, its author, or the Wall owner.
update public.walls set visibility='public',contribution_policy='everyone'
  where type='personal' and owner_id='44444444-4444-4444-4444-444444444444';
insert into auth.users(id,email) values
  ('89999999-9999-4999-8999-999999999999','poll-purge-fixture@test');
insert into public.profiles(id,handle,display_name)
  values ('89999999-9999-4999-8999-999999999999','pollpurgefixture','Poll purge fixture');
select set_config('tw.personal_wall',id::text,true) from public.walls
  where type='personal' and owner_id='44444444-4444-4444-4444-444444444444';
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$
declare v_result jsonb;
begin
  v_result := public.create_poll_mark(auth.uid(),'83000000-0000-4000-8000-000000000011',
    current_setting('tw.personal_wall')::uuid,'multiple','Close tally',
    array['Alpha','Beta','Gamma'],false,false);
  if v_result->>'status' is distinct from 'created' then raise exception '83 FAIL: personal create %',v_result; end if;
  perform set_config('tw.purge_mark',v_result->>'mark_id',true);
end $$;
reset role;
select set_config('tw.purge_option_a',option_id::text,true) from public.mark_poll_options
  where mark_id=current_setting('tw.purge_mark')::uuid and position=0;
select set_config('tw.purge_option_b',option_id::text,true) from public.mark_poll_options
  where mark_id=current_setting('tw.purge_mark')::uuid and position=1;
set local role authenticated;
set local "test.uid"='89999999-9999-4999-8999-999999999999';
do $$
declare v_result jsonb;
begin
  v_result := public.replace_poll_ballot(auth.uid(),'83000000-0000-4000-8000-000000000012',
    current_setting('tw.personal_wall')::uuid,current_setting('tw.purge_mark')::uuid,1,0,
    array[current_setting('tw.purge_option_a')::uuid,current_setting('tw.purge_option_b')::uuid]);
  if v_result->>'status' is distinct from 'applied' then raise exception '83 FAIL: multi vote %',v_result; end if;
end $$;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$
declare v_result jsonb;
begin
  v_result := public.close_poll_mark(auth.uid(),'83000000-0000-4000-8000-000000000013',
    current_setting('tw.personal_wall')::uuid,current_setting('tw.purge_mark')::uuid,1);
  if v_result->>'status' is distinct from 'closed' then raise exception '83 FAIL: multi close %',v_result; end if;
  v_result := public.get_wall_mark_v2(auth.uid(),current_setting('tw.personal_wall')::uuid,
    current_setting('tw.purge_mark')::uuid);
  if v_result #>> '{item,poll,results,ballot_total}' is distinct from '1'
     or v_result #>> '{item,poll,results,counts,0,count}' is distinct from '1'
     or v_result #>> '{item,poll,results,counts,1,count}' is distinct from '1'
     or v_result #>> '{item,poll,ballot}' is not null then
    raise exception '83 FAIL: closed aggregates or voter privacy %',v_result; end if;
end $$;
reset role;
delete from auth.users where id='89999999-9999-4999-8999-999999999999';
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$
declare v_result jsonb;
begin
  v_result := public.get_wall_mark_v2(auth.uid(),current_setting('tw.personal_wall')::uuid,
    current_setting('tw.purge_mark')::uuid);
  if v_result #>> '{item,poll,state}' is distinct from 'closed'
     or v_result #>> '{item,poll,results,ballot_total}' is distinct from '0'
     or v_result #>> '{item,poll,results,counts,0,count}' is distinct from '0'
     or v_result #>> '{item,poll,results,counts,1,count}' is distinct from '0' then
    raise exception '83 FAIL: account deletion retained closed votes %',v_result; end if;
end $$;
reset role;
set constraints all immediate;
rollback;
\echo '83 (standard poll ballots/close, actor replay and deletion tally) : PASS'
