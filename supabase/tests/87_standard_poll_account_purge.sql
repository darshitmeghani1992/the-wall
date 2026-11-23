\set ON_ERROR_STOP on
-- POLL-06: disposable SQL for the held account-deletion + Poll purge wrapper.
-- Both source migrations and worker remain OFF on hosted staging.
begin;

do $$
begin
  if has_function_privilege('anon',
       'public.prepare_account_deletion_for_purge_with_polls(uuid,timestamptz)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.prepare_account_deletion_for_purge_with_polls(uuid,timestamptz)','EXECUTE')
     or not has_function_privilege('service_role',
       'public.prepare_account_deletion_for_purge_with_polls(uuid,timestamptz)','EXECUTE')
     or (select creation_enabled from public.mark_poll_rollout where singleton) is distinct from false
     or (select voting_enabled from public.mark_poll_rollout where singleton) is distinct from false
  then raise exception '87 FAIL: service ACL or Poll activation changed'; end if;
end $$;

-- Identity to erase and two independent private Polls: one authored by the
-- deletion target, one closed Poll with two different voters.
insert into auth.users(id,email)
values('87000000-0000-4000-8000-000000000001','poll-purge-87@test');
insert into public.profiles(id,handle,display_name)
values('87000000-0000-4000-8000-000000000001','pollpurge87','Purge 87');

insert into public.mark_polls(mark_id,wall_id,author_id,status,question,selection_mode)
values
('87000000-0000-4000-8000-000000000011','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 '11111111-1111-1111-1111-111111111111','active','Closed tallies must update','single'),
('87000000-0000-4000-8000-000000000012','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
 '87000000-0000-4000-8000-000000000001','active','Erase authored private Poll','multiple');
update public.mark_polls set closed_at=clock_timestamp()
  where mark_id='87000000-0000-4000-8000-000000000011';

insert into public.mark_poll_options(mark_id,position,label)
values
('87000000-0000-4000-8000-000000000011',0,'Yes'),
('87000000-0000-4000-8000-000000000011',1,'No'),
('87000000-0000-4000-8000-000000000012',0,'One'),
('87000000-0000-4000-8000-000000000012',1,'Two');

insert into public.mark_poll_ballots(mark_id,voter_id)
values
('87000000-0000-4000-8000-000000000011','87000000-0000-4000-8000-000000000001'),
('87000000-0000-4000-8000-000000000011','22222222-2222-2222-2222-222222222222'),
('87000000-0000-4000-8000-000000000012','11111111-1111-1111-1111-111111111111');
insert into public.mark_poll_ballot_choices(mark_id,voter_id,option_id)
select b.mark_id,b.voter_id,o.option_id
from public.mark_poll_ballots b
join public.mark_poll_options o on o.mark_id=b.mark_id and o.position=0
where b.mark_id in ('87000000-0000-4000-8000-000000000011',
                    '87000000-0000-4000-8000-000000000012');

insert into public.mark_poll_creation_requests(actor_id,request_id,request_sha256,mark_id)
values ('87000000-0000-4000-8000-000000000001',
        '87000000-0000-4000-8000-000000000021',repeat('a',64),
        '87000000-0000-4000-8000-000000000012');
insert into public.mark_poll_mutation_requests(actor_id,request_id,kind,mark_id,request_sha256)
values ('87000000-0000-4000-8000-000000000001',
        '87000000-0000-4000-8000-000000000022','ballot',
        '87000000-0000-4000-8000-000000000011',repeat('b',64));

-- Schedule through the real actor-bound lifecycle, not by spoofing profile state.
set local role authenticated;
set local "test.uid"='87000000-0000-4000-8000-000000000001';
do $$
declare v_result jsonb;
begin
  v_result := public.request_account_deletion(auth.uid(),'DELETE');
  if v_result->>'status' is distinct from 'scheduled' then
    raise exception '87 FAIL: schedule %',v_result; end if;
end $$;
reset role;
select set_config('tw.poll_purge_requested_at',requested_at::text,true)
  from public.account_deletion_requests
  where user_id='87000000-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare v_req timestamptz;
begin
  v_req := current_setting('tw.poll_purge_requested_at')::timestamptz;
  if public.prepare_account_deletion_for_purge_with_polls(
      '87000000-0000-4000-8000-000000000001',v_req) then
    raise exception '87 FAIL: premature purge accepted';
  end if;
end $$;
reset role;

-- Simulate passing the immutable 30-day deadline on disposable data only.
update public.account_deletion_requests
  set requested_at='2026-09-01 00:00:00+00'::timestamptz,
      purge_after='2026-10-01 00:00:00+00'::timestamptz
  where user_id='87000000-0000-4000-8000-000000000001';

select set_config('tw.poll_purge_requested_at',requested_at::text,true)
  from public.account_deletion_requests
  where user_id='87000000-0000-4000-8000-000000000001';
set local role service_role;
do $$
declare v_req timestamptz;
begin
  v_req := current_setting('tw.poll_purge_requested_at')::timestamptz;
  if not public.prepare_account_deletion_for_purge_with_polls(
      '87000000-0000-4000-8000-000000000001',v_req)
     or not public.prepare_account_deletion_for_purge_with_polls(
      '87000000-0000-4000-8000-000000000001',v_req) then
    raise exception '87 FAIL: due/idempotent purge refused';
  end if;
end $$;
reset role;

do $$
begin
  if exists(select 1 from public.mark_poll_ballots
      where voter_id='87000000-0000-4000-8000-000000000001')
     or exists(select 1 from public.mark_polls
      where author_id='87000000-0000-4000-8000-000000000001')
     or exists(select 1 from public.mark_poll_creation_requests
      where actor_id='87000000-0000-4000-8000-000000000001')
     or exists(select 1 from public.mark_poll_mutation_requests
      where actor_id='87000000-0000-4000-8000-000000000001')
     or (select count(*) from public.mark_poll_ballots
       where mark_id='87000000-0000-4000-8000-000000000011') <> 1
     or not exists(select 1 from auth.users
       where id='87000000-0000-4000-8000-000000000001')
     or not exists(select 1 from public.account_deletion_requests
       where user_id='87000000-0000-4000-8000-000000000001')
  then raise exception '87 FAIL: before-Auth erased counts/records/identity incorrectly'; end if;
end $$;

-- An unrelated eligible viewer sees the live closed aggregate after purge
-- preparation, while the original deleted voter's choices are absent.
set local role authenticated;
set local "test.uid"='22222222-2222-2222-2222-222222222222';
do $$
declare v_reply jsonb;
begin
  v_reply := public.get_wall_mark_item_v2(auth.uid(),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '87000000-0000-4000-8000-000000000011','poll');
  if v_reply #>> '{item,poll,state}' is distinct from 'closed'
    or v_reply #>> '{item,poll,results,ballot_total}' is distinct from '1'
    or v_reply #>> '{item,poll,results,counts,0,count}' is distinct from '1' then
    raise exception '87 FAIL: closed aggregate did not decrement %',v_reply;
  end if;
end $$;
reset role;

-- Final Auth Admin operation is simulated using Auth FK cascades only.
delete from auth.users where id='87000000-0000-4000-8000-000000000001';
do $$
begin
  if exists(select 1 from public.account_deletion_requests
       where user_id='87000000-0000-4000-8000-000000000001')
     or (select count(*) from public.mark_poll_ballots
       where mark_id='87000000-0000-4000-8000-000000000011') <> 1
  then raise exception '87 FAIL: Auth finalize changed unrelated closed counts'; end if;
end $$;

set constraints all immediate;
rollback;
\echo '87 (atomic Poll author/ballot purge, closed totals and Auth retry): PASS'
