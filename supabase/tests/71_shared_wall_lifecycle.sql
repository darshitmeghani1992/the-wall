-- 71_shared_wall_lifecycle.sql · Shared-Wall lifecycle and privacy contract.
\set ON_ERROR_STOP on

-- Schema/grant boundary and protected Personal-Wall creation.
do $$
begin
  if has_table_privilege('authenticated','shared_wall_member_removals','select')
     or has_table_privilege('authenticated','wall_members','insert')
     or has_table_privilege('authenticated','wall_members','update')
     or has_table_privilege('authenticated','wall_members','delete')
     or has_table_privilege('authenticated','walls','delete') then
    raise exception '71 FAIL: lifecycle tables retain direct app DML';
  end if;
  if exists(select 1 from pg_policies where schemaname='public'
             and tablename='shared_wall_member_removals') then
    raise exception '71 FAIL: private removal ledger has an RLS policy';
  end if;
end $$;
\echo '71 (private ledger + RPC-only DML) : PASS'

begin;
set local role authenticated;
set local "test.uid"='88888888-8888-8888-8888-888888888888';
do $$ declare denied boolean:=false; begin
  begin
    insert into walls(owner_id,type,name,visibility)
      values(auth.uid(),'personal','forged personal','private');
  exception when others then denied:=true; end;
  if not denied then raise exception '71 FAIL: app forged a Personal Wall'; end if;
  insert into walls(id,owner_id,type,name,visibility,open_join)
    values('71000000-0000-4000-8000-000000000001',auth.uid(),'shared',
           'Grace Shared','public',true);
end $$;
rollback;
\echo '71 (active shared-only creation)   : PASS'

-- Exact invite preview: private Wall metadata is non-enumerating and minimal.
begin;
set local role authenticated;
set local "test.uid"='77777777-7777-7777-7777-777777777777';
do $$ declare r jsonb; begin
  r:=get_my_pending_shared_wall_invite('dddddddd-dddd-dddd-dddd-dddddddddddd');
  if r <> jsonb_build_object('status','available','wall_id','dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
      'wall_name','Olivia''s Private Shared Wall','visibility','private',
      'owner_display_name','Olivia') then
    raise exception '71 FAIL: private invite preview shape/value %',r;
  end if;
  r:=get_my_pending_shared_wall_invite('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
  if r<>jsonb_build_object('status','unavailable') then
    raise exception '71 FAIL: non-invite preview enumerated %',r;
  end if;
end $$;
rollback;
\echo '71 (minimal private invite preview): PASS'

-- Exact join-state projection, priority, unavailable equality, and Personal null.
begin;
insert into walls(id,owner_id,type,name,visibility,open_join) values
 ('71000000-0000-4000-8000-000000000041','44444444-4444-4444-4444-444444444444','shared','Join States','public',true),
 ('71000000-0000-4000-8000-000000000042','44444444-4444-4444-4444-444444444444','shared','Closed State','public',false),
 ('71000000-0000-4000-8000-000000000043','44444444-4444-4444-4444-444444444444','shared','Stale Invite','public',false);
insert into wall_members(wall_id,user_id,role,status) values
 ('71000000-0000-4000-8000-000000000041','77777777-7777-7777-7777-777777777777','member','pending'),
 ('71000000-0000-4000-8000-000000000043','88888888-8888-8888-8888-888888888888','member','pending');
insert into shared_wall_member_removals(wall_id,user_id,removed_by) values
 ('71000000-0000-4000-8000-000000000041','77777777-7777-7777-7777-777777777777','44444444-4444-4444-4444-444444444444'),
 ('71000000-0000-4000-8000-000000000041','88888888-8888-8888-8888-888888888888','44444444-4444-4444-4444-444444444444');
set constraints all immediate;
set constraints all deferred;
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
do $$ declare r jsonb; begin
  r:=get_wall_capabilities('71000000-0000-4000-8000-000000000041');
  if r->>'join_state'<>'owner' or (r->>'can_join')::boolean then
    raise exception '71 FAIL: owner join state %',r; end if;
end $$;
set local "test.uid"='77777777-7777-7777-7777-777777777777';
do $$ declare r jsonb; begin
  r:=get_wall_capabilities('71000000-0000-4000-8000-000000000041');
  if r->>'join_state'<>'invited' or (r->>'can_join')::boolean then
    raise exception '71 FAIL: pending+tombstone priority %',r; end if;
end $$;
set local "test.uid"='22222222-2222-2222-2222-222222222222';
do $$ declare r jsonb; begin
  r:=get_wall_capabilities('dddddddd-dddd-dddd-dddd-dddddddddddd');
  if r->>'join_state'<>'member' or (r->>'can_join')::boolean then
    raise exception '71 FAIL: accepted member join state %',r; end if;
end $$;
reset role;
update profiles set account_status='suspended'
 where id='77777777-7777-7777-7777-777777777777';
set local role authenticated;
set local "test.uid"='77777777-7777-7777-7777-777777777777';
do $$ begin
  if get_wall_capabilities('71000000-0000-4000-8000-000000000041')
       <>jsonb_build_object('status','unavailable') then
    raise exception '71 FAIL: suspended caller response not exact unavailable'; end if;
end $$;
set local "test.uid"='88888888-8888-8888-8888-888888888888';
do $$ declare r jsonb; begin
  r:=get_wall_capabilities('71000000-0000-4000-8000-000000000041');
  if r->>'join_state'<>'owner_approval_required' or (r->>'can_join')::boolean then
    raise exception '71 FAIL: removed join state %',r; end if;
  r:=get_wall_capabilities('71000000-0000-4000-8000-000000000042');
  if r->>'join_state'<>'invite_required' or (r->>'can_join')::boolean then
    raise exception '71 FAIL: closed join state %',r; end if;
  if get_wall_capabilities('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')
       <>jsonb_build_object('status','unavailable') then
    raise exception '71 FAIL: private unauthorized response not exact unavailable'; end if;
end $$;
set local "test.uid"='33333333-3333-3333-3333-333333333333';
do $$ begin
  if get_wall_capabilities('71000000-0000-4000-8000-000000000041')
       <>jsonb_build_object('status','unavailable') then
    raise exception '71 FAIL: blocked capability response not exact unavailable'; end if;
end $$;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare r jsonb; wid uuid; begin
  r:=get_wall_capabilities('71000000-0000-4000-8000-000000000041');
  if r->>'join_state'<>'joinable' or not (r->>'can_join')::boolean then
    raise exception '71 FAIL: joinable state %',r; end if;
  if (select count(*) from jsonb_object_keys(r))<>7 then
    raise exception '71 FAIL: available capability key set changed %',r; end if;
  select id into strict wid from walls where owner_id=auth.uid() and type='personal';
  r:=get_wall_capabilities(wid);
  if r->'join_state'<>'null'::jsonb or (r->>'can_join')::boolean then
    raise exception '71 FAIL: Personal join state is not null/false %',r; end if;
end $$;
do $$ begin
  if get_wall_capabilities('71000000-0000-4000-8000-000000000099')
       <>jsonb_build_object('status','unavailable') then
    raise exception '71 FAIL: missing capability response not exact unavailable'; end if;
end $$;
rollback;
\echo '71 (exact join-state contract)     : PASS'

-- Deferred collision invariant permits pending+tombstone but rejects accepted.
begin;
insert into walls(id,owner_id,type,name,visibility)
 values('71000000-0000-4000-8000-000000000044','44444444-4444-4444-4444-444444444444','shared','Collision','private');
insert into wall_members(wall_id,user_id,role,status)
 values
 ('71000000-0000-4000-8000-000000000044','88888888-8888-8888-8888-888888888888','member','pending'),
 ('71000000-0000-4000-8000-000000000044','22222222-2222-2222-2222-222222222222','member','accepted');
insert into shared_wall_member_removals(wall_id,user_id,removed_by)
 values('71000000-0000-4000-8000-000000000044','88888888-8888-8888-8888-888888888888','44444444-4444-4444-4444-444444444444');
set constraints all immediate;
do $$ declare denied boolean:=false; begin
  begin
    insert into shared_wall_member_removals(wall_id,user_id,removed_by)
     values('71000000-0000-4000-8000-000000000044',
            '22222222-2222-2222-2222-222222222222',
            '44444444-4444-4444-4444-444444444444');
    set constraints all immediate;
  exception when check_violation then denied:=true; end;
  if not denied then raise exception '71 FAIL: accepted+tombstone collision allowed'; end if;
end $$;
rollback;
\echo '71 (membership/tombstone collision): PASS'

-- Stale client state never authorizes a mutation after server state changes.
begin;
insert into walls(id,owner_id,type,name,visibility,open_join) values
 ('71000000-0000-4000-8000-000000000045','44444444-4444-4444-4444-444444444444','shared','Stale Join','public',true),
 ('71000000-0000-4000-8000-000000000046','44444444-4444-4444-4444-444444444444','shared','Stale Accept','public',false),
 ('71000000-0000-4000-8000-000000000047','44444444-4444-4444-4444-444444444444','shared','Stale Block','public',true);
insert into wall_members(wall_id,user_id,role,status)
 values('71000000-0000-4000-8000-000000000046','88888888-8888-8888-8888-888888888888','member','pending');
set local role authenticated;
set local "test.uid"='88888888-8888-8888-8888-888888888888';
do $$ begin
  if get_wall_capabilities('71000000-0000-4000-8000-000000000045')->>'join_state'<>'joinable' then
    raise exception '71 FAIL: stale join precondition missing'; end if;
  if get_wall_capabilities('71000000-0000-4000-8000-000000000046')->>'join_state'<>'invited' then
    raise exception '71 FAIL: stale invite precondition missing'; end if;
end $$;
reset role;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ begin
  if get_wall_capabilities('71000000-0000-4000-8000-000000000047')->>'join_state'<>'joinable' then
    raise exception '71 FAIL: stale block precondition missing'; end if;
end $$;
reset role;
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
select update_shared_wall_settings('71000000-0000-4000-8000-000000000045','Stale Join','public',false,false);
select remove_shared_wall_member('71000000-0000-4000-8000-000000000046','88888888-8888-8888-8888-888888888888');
insert into blocks(blocker_id,blocked_id)
 values(auth.uid(),'11111111-1111-1111-1111-111111111111');
reset role;
set local role authenticated;
set local "test.uid"='88888888-8888-8888-8888-888888888888';
do $$ begin
  if join_shared_wall('71000000-0000-4000-8000-000000000045')
       <>jsonb_build_object('status','unavailable')
     or respond_shared_wall_invite('71000000-0000-4000-8000-000000000046',true)
       <>jsonb_build_object('status','unavailable') then
    raise exception '71 FAIL: stale state authorized mutation'; end if;
end $$;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ begin
  if join_shared_wall('71000000-0000-4000-8000-000000000047')
       <>jsonb_build_object('status','unavailable') then
    raise exception '71 FAIL: stale join_state survived a new block'; end if;
end $$;
rollback;
\echo '71 (stale mutations revalidated)   : PASS'

-- Open join, durable removal toggle, reinvite, decline, accept-only clearing,
-- voluntary leave, and idempotent rejoin.
begin;
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
do $$ declare r jsonb; begin
  r:=update_shared_wall_settings('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '  Olivia Open Wall  ','public',true,true);
  if r<>jsonb_build_object('status','updated','wall_id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
      'name','Olivia Open Wall','visibility','public','open_join',true,
      'allow_anonymous',true) then raise exception '71 FAIL: settings result %',r; end if;
  r:=update_shared_wall_settings('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'Olivia Open Wall','private',true,true);
  if r<>jsonb_build_object('status','invalid_input') then
    raise exception '71 FAIL: private+open was not rejected %',r; end if;
end $$;
reset role;
set local role authenticated;
set local "test.uid"='88888888-8888-8888-8888-888888888888';
do $$ declare r jsonb; begin
  r:=join_shared_wall('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  if r->>'status'<>'joined' then raise exception '71 FAIL: open join %',r; end if;
  r:=join_shared_wall('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  if r->>'status'<>'already_member' then raise exception '71 FAIL: duplicate join %',r; end if;
end $$;
reset role;
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
do $$ declare r jsonb; begin
  r:=remove_shared_wall_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '88888888-8888-8888-8888-888888888888');
  if r->>'status'<>'removed' then raise exception '71 FAIL: remove %',r; end if;
  if not exists(select 1 from list_removed_shared_wall_members(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') x
      where x.user_id='88888888-8888-8888-8888-888888888888') then
    raise exception '71 FAIL: owner removal list omitted tombstone'; end if;
  r:=invite_shared_wall_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '88888888-8888-8888-8888-888888888888');
  if r->>'status'<>'invited' then raise exception '71 FAIL: reinvite %',r; end if;
end $$;
reset role;
set local role authenticated;
set local "test.uid"='88888888-8888-8888-8888-888888888888';
do $$ declare r jsonb; begin
  if (get_wall_capabilities('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')->>'can_join')::boolean then
    raise exception '71 FAIL: removed invitee can_join true'; end if;
  r:=respond_shared_wall_invite('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',false);
  if r->>'status'<>'declined' then raise exception '71 FAIL: decline %',r; end if;
  r:=join_shared_wall('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  if r->>'status'<>'unavailable' then raise exception '71 FAIL: decline cleared tombstone %',r; end if;
end $$;
reset role;
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
select invite_shared_wall_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '88888888-8888-8888-8888-888888888888');
reset role;
set local role authenticated;
set local "test.uid"='88888888-8888-8888-8888-888888888888';
do $$ declare r jsonb; begin
  r:=respond_shared_wall_invite('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',true);
  if r->>'status'<>'accepted' then raise exception '71 FAIL: accept %',r; end if;
  r:=leave_shared_wall('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  if r->>'status'<>'left' then raise exception '71 FAIL: leave %',r; end if;
  r:=join_shared_wall('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  if r->>'status'<>'joined' then raise exception '71 FAIL: voluntary rejoin %',r; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from shared_wall_member_removals
             where wall_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
               and user_id='88888888-8888-8888-8888-888888888888') then
    raise exception '71 FAIL: accepted reinvite did not clear tombstone'; end if;
  if not exists(select 1 from notifications
                 where user_id='44444444-4444-4444-4444-444444444444'
                   and actor_id='88888888-8888-8888-8888-888888888888'
                   and kind='shared_wall_invite_accepted'
                   and wall_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') then
    raise exception '71 FAIL: accepted invite Alert missing'; end if;
end $$;
rollback;
\echo '71 (join/removal/reinvite/leave)   : PASS'

-- Owner management, transfer, Alerts, and owner leave protection.
begin;
insert into walls(id,owner_id,type,name,visibility,open_join)
 values('71000000-0000-4000-8000-000000000010',
        '44444444-4444-4444-4444-444444444444','shared','Transfer Wall','private',false);
insert into wall_members(wall_id,user_id,role,status)
 values('71000000-0000-4000-8000-000000000010',
        '22222222-2222-2222-2222-222222222222','member','accepted');
set constraints all immediate;
set constraints all deferred;
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
do $$ begin
  if leave_shared_wall('71000000-0000-4000-8000-000000000010')->>'status'<>'owner_action_required' then
    raise exception '71 FAIL: owner leave not protected'; end if;
  if not transfer_shared_wall_ownership('71000000-0000-4000-8000-000000000010',
      '22222222-2222-2222-2222-222222222222') then
    raise exception '71 FAIL: transfer failed'; end if;
end $$;
reset role;
set constraints all immediate;
do $$ begin
  if (select owner_id from walls where id='71000000-0000-4000-8000-000000000010')
       <>'22222222-2222-2222-2222-222222222222' then
    raise exception '71 FAIL: owner not transferred'; end if;
  if not exists(select 1 from wall_members
                 where wall_id='71000000-0000-4000-8000-000000000010'
                   and user_id='44444444-4444-4444-4444-444444444444'
                   and status='accepted' and role='member') then
    raise exception '71 FAIL: old owner not demoted to member'; end if;
  if exists(select 1 from wall_members
             where wall_id='71000000-0000-4000-8000-000000000010'
               and user_id='22222222-2222-2222-2222-222222222222') then
    raise exception '71 FAIL: new owner still has membership'; end if;
  if not exists(select 1 from notifications
                 where user_id='22222222-2222-2222-2222-222222222222'
                   and actor_id='44444444-4444-4444-4444-444444444444'
                   and kind='shared_wall_ownership_transferred'
                   and wall_id='71000000-0000-4000-8000-000000000010') then
    raise exception '71 FAIL: transfer Alert missing'; end if;
end $$;
rollback;
\echo '71 (owner leave + transfer)       : PASS'

-- Management cleanup remains possible for inactive/missing target profiles;
-- an existing block wins without manufacturing a removal tombstone.
begin;
insert into auth.users(id,email) values
 ('71000000-0000-4000-8000-000000000031','inactive-remove@test'),
 ('71000000-0000-4000-8000-000000000032','suspended-revoke@test'),
 ('71000000-0000-4000-8000-000000000033','missing-profile@test'),
 ('71000000-0000-4000-8000-000000000034','block-first@test'),
 ('71000000-0000-4000-8000-000000000035','remove-first@test');
insert into profiles(id,handle,display_name) values
 ('71000000-0000-4000-8000-000000000031','inactive_remove','Inactive Remove'),
 ('71000000-0000-4000-8000-000000000032','suspended_revoke','Suspended Revoke'),
 ('71000000-0000-4000-8000-000000000033','missing_profile','Missing Profile'),
 ('71000000-0000-4000-8000-000000000034','block_first','Block First'),
 ('71000000-0000-4000-8000-000000000035','remove_first','Remove First');
insert into walls(id,owner_id,type,name,visibility) values
 ('71000000-0000-4000-8000-000000000036','44444444-4444-4444-4444-444444444444','shared','Cleanup Wall','private');
insert into wall_members(wall_id,user_id,role,status) values
 ('71000000-0000-4000-8000-000000000036','71000000-0000-4000-8000-000000000031','member','accepted'),
 ('71000000-0000-4000-8000-000000000036','71000000-0000-4000-8000-000000000032','member','pending'),
 ('71000000-0000-4000-8000-000000000036','71000000-0000-4000-8000-000000000033','member','accepted'),
 ('71000000-0000-4000-8000-000000000036','71000000-0000-4000-8000-000000000034','member','accepted'),
 ('71000000-0000-4000-8000-000000000036','71000000-0000-4000-8000-000000000035','member','accepted');
set constraints all immediate;
set constraints all deferred;
update profiles set account_status='deactivated'
 where id='71000000-0000-4000-8000-000000000031';
update profiles set account_status='suspended'
 where id='71000000-0000-4000-8000-000000000032';
delete from profiles where id='71000000-0000-4000-8000-000000000033';
insert into blocks(blocker_id,blocked_id) values
 ('44444444-4444-4444-4444-444444444444','71000000-0000-4000-8000-000000000034');
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
do $$ declare r jsonb; begin
  r:=remove_shared_wall_member('71000000-0000-4000-8000-000000000036','71000000-0000-4000-8000-000000000031');
  if r->>'status'<>'removed' then raise exception '71 FAIL: inactive accepted cleanup %',r; end if;
  r:=remove_shared_wall_member('71000000-0000-4000-8000-000000000036','71000000-0000-4000-8000-000000000032');
  if r->>'status'<>'revoked' then raise exception '71 FAIL: suspended pending cleanup %',r; end if;
  r:=remove_shared_wall_member('71000000-0000-4000-8000-000000000036','71000000-0000-4000-8000-000000000033');
  if r->>'status'<>'removed' then raise exception '71 FAIL: missing-profile cleanup %',r; end if;
  r:=remove_shared_wall_member('71000000-0000-4000-8000-000000000036','71000000-0000-4000-8000-000000000034');
  if r<>jsonb_build_object('status','unavailable') then raise exception '71 FAIL: block-first removal %',r; end if;
  r:=remove_shared_wall_member('71000000-0000-4000-8000-000000000036','71000000-0000-4000-8000-000000000035');
  if r->>'status'<>'removed' then raise exception '71 FAIL: removal-first %',r; end if;
end $$;
reset role;
insert into blocks(blocker_id,blocked_id) values
 ('44444444-4444-4444-4444-444444444444','71000000-0000-4000-8000-000000000035');
do $$ begin
  if not exists(select 1 from shared_wall_member_removals where wall_id='71000000-0000-4000-8000-000000000036'
      and user_id in ('71000000-0000-4000-8000-000000000031','71000000-0000-4000-8000-000000000033','71000000-0000-4000-8000-000000000035') group by wall_id having count(*)=3) then
    raise exception '71 FAIL: cleanup/removal-first tombstones incorrect'; end if;
  if exists(select 1 from shared_wall_member_removals where wall_id='71000000-0000-4000-8000-000000000036'
      and user_id in ('71000000-0000-4000-8000-000000000032','71000000-0000-4000-8000-000000000034')) then
    raise exception '71 FAIL: revoke/block-first manufactured tombstone'; end if;
end $$;
rollback;
\echo '71 (inactive cleanup + block order): PASS'

-- Deferred invariant blocks every representation of an owner as member/removed.
begin;
do $$ declare denied boolean:=false; begin
  begin
    insert into wall_members(wall_id,user_id,role,status)
      values('dddddddd-dddd-dddd-dddd-dddddddddddd',
             '44444444-4444-4444-4444-444444444444','member','accepted');
    set constraints all immediate;
  exception when check_violation then denied:=true; end;
  if not denied then raise exception '71 FAIL: owner membership invariant open'; end if;
end $$;
rollback;

begin;
do $$ declare denied boolean:=false; begin
  begin
    insert into shared_wall_member_removals(wall_id,user_id,removed_by)
      values('dddddddd-dddd-dddd-dddd-dddddddddddd',
             '44444444-4444-4444-4444-444444444444',null);
    set constraints all immediate;
  exception when check_violation then denied:=true; end;
  if not denied then raise exception '71 FAIL: owner tombstone invariant open'; end if;
end $$;
rollback;
\echo '71 (deferred owner invariant)      : PASS'

-- Owner-only exact-name deletion; non-owner receives the same safe result.
begin;
insert into walls(id,owner_id,type,name,visibility)
 values('71000000-0000-4000-8000-000000000020',
        '44444444-4444-4444-4444-444444444444','shared','Delete Me','private');
insert into marks(id,wall_id,author_id,type,status)
 values('71000000-0000-4000-8000-000000000021',
        '71000000-0000-4000-8000-000000000020',
        '44444444-4444-4444-4444-444444444444','photo','active');
insert into media_uploads(
 id,uploader_id,uploader_tombstone_id,wall_id,wall_tombstone_id,kind,client_upload_id,
 source_path,state,session_state,declared_mime,declared_bytes,detected_mime,
 validated_bytes,actual_input_bytes,sha256,width,height,validated_path,
 cache_control_seconds,expires_at,validated_at,quota_day,reserved_charge,
 consumed_mark_id,consumed_mark_tombstone_id,consumed_at
) values(
 '71000000-0000-4000-8000-000000000022','44444444-4444-4444-4444-444444444444',
 '44444444-4444-4444-4444-444444444444','71000000-0000-4000-8000-000000000020',
 '71000000-0000-4000-8000-000000000020','photo','71000000-0000-4000-8000-000000000023',
 'staging/44444444-4444-4444-4444-444444444444/71000000-0000-4000-8000-000000000022/source',
 'consumed','closed','image/jpeg',1000,'image/jpeg',900,1000,repeat('7',64),100,80,
 'validated/71000000-0000-4000-8000-000000000022/full.jpg',60,
 now()+interval '1 hour',now(),current_date,1000,
 '71000000-0000-4000-8000-000000000021','71000000-0000-4000-8000-000000000021',now()
);
insert into mark_media(id,mark_id,upload_id,media_type,"position",storage_path,
 mime_type,byte_size,sha256,width,height)
 values('71000000-0000-4000-8000-000000000024','71000000-0000-4000-8000-000000000021',
 '71000000-0000-4000-8000-000000000022','photo',0,
 'validated/71000000-0000-4000-8000-000000000022/full.jpg',
 'image/jpeg',900,repeat('7',64),100,80);
set local role authenticated;
set local "test.uid"='22222222-2222-2222-2222-222222222222';
do $$ begin
  if delete_shared_wall('71000000-0000-4000-8000-000000000020','Delete Me')
       <>jsonb_build_object('status','unavailable') then
    raise exception '71 FAIL: non-owner delete enumerates'; end if;
end $$;
reset role;
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
do $$ begin
  if delete_shared_wall('71000000-0000-4000-8000-000000000020','wrong')->>'status'
       <>'confirmation_mismatch' then raise exception '71 FAIL: name confirmation'; end if;
  if delete_shared_wall('71000000-0000-4000-8000-000000000020','Delete Me')->>'status'
       <>'deleted' then raise exception '71 FAIL: owner delete'; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from walls where id='71000000-0000-4000-8000-000000000020') then
    raise exception '71 FAIL: deleted Wall remains'; end if;
  if not exists(select 1 from media_object_deletions
                 where idempotency_key='mark-media:71000000-0000-4000-8000-000000000024'
                   and object_path='validated/71000000-0000-4000-8000-000000000022/full.jpg'
                   and reason='mark_deleted') then
    raise exception '71 FAIL: Shared-Wall deletion did not enqueue exact media cleanup'; end if;
end $$;
rollback;
\echo '71 (confirmed owner delete)        : PASS'
