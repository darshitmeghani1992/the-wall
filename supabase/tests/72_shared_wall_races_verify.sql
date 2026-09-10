\set ON_ERROR_STOP on
do $$ begin
  if exists(select 1 from wall_members where wall_id='72000000-0000-4000-8000-000000000001'
             and user_id='88888888-8888-8888-8888-888888888888')
     or not exists(select 1 from shared_wall_member_removals
             where wall_id='72000000-0000-4000-8000-000000000001'
               and user_id='88888888-8888-8888-8888-888888888888') then
    raise exception '72 FAIL: remove/join did not preserve removal'; end if;
  if not exists(select 1 from blocks
                 where blocker_id='11111111-1111-1111-1111-111111111111'
                   and blocked_id='22222222-2222-2222-2222-222222222222')
     or exists(select 1 from wall_members
                where wall_id='72000000-0000-4000-8000-000000000002'
                  and user_id='22222222-2222-2222-2222-222222222222') then
    raise exception '72 FAIL: block/join admitted blocked actor'; end if;
  if (select open_join from walls where id='72000000-0000-4000-8000-000000000003')
     or exists(select 1 from wall_members
                where wall_id='72000000-0000-4000-8000-000000000003'
                  and user_id='88888888-8888-8888-8888-888888888888') then
    raise exception '72 FAIL: close/join admitted after close'; end if;
  if exists(select 1 from walls where id='72000000-0000-4000-8000-000000000004') then
    raise exception '72 FAIL: delete/join resurrected Wall'; end if;
  if (select owner_id from walls where id='72000000-0000-4000-8000-000000000005')
       <>'22222222-2222-2222-2222-222222222222'
     or exists(select 1 from wall_members
                where wall_id='72000000-0000-4000-8000-000000000005'
                  and user_id='22222222-2222-2222-2222-222222222222')
     or not exists(select 1 from wall_members
                    where wall_id='72000000-0000-4000-8000-000000000005'
                      and user_id='44444444-4444-4444-4444-444444444444'
                      and status='accepted') then
    raise exception '72 FAIL: transfer/leave final ownership invalid'; end if;
  if exists(select 1 from wall_members
             where wall_id='72000000-0000-4000-8000-000000000006'
               and user_id='77777777-7777-7777-7777-777777777777')
     or not exists(select 1 from shared_wall_member_removals
                    where wall_id='72000000-0000-4000-8000-000000000006'
                      and user_id='77777777-7777-7777-7777-777777777777') then
    raise exception '72 FAIL: accept/revoke produced partial state'; end if;
  if (select account_status from profiles where id='66666666-6666-6666-6666-666666666666')<>'deactivated'
     or exists(select 1 from wall_members
                where wall_id='72000000-0000-4000-8000-000000000007'
                  and user_id='66666666-6666-6666-6666-666666666666') then
    raise exception '72 FAIL: join/deactivation admitted inactive actor'; end if;
  if (select count(*) from wall_members
       where wall_id='72000000-0000-4000-8000-000000000008'
         and user_id='88888888-8888-8888-8888-888888888888'
         and status='accepted')<>1 then
    raise exception '72 FAIL: duplicate join cardinality'; end if;
  if exists(select 1 from walls w join wall_members wm
             on wm.wall_id=w.id and wm.user_id=w.owner_id)
     or exists(select 1 from walls w join shared_wall_member_removals r
                on r.wall_id=w.id and r.user_id=w.owner_id) then
    raise exception '72 FAIL: owner invariant violated after races'; end if;
end $$;
\echo '72 (8 physical lifecycle races)   : PASS'
