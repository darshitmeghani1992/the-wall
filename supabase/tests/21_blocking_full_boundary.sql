-- 21 · Full bilateral boundary, atomic cleanup and non-restoration
\set ON_ERROR_STOP on

BEGIN;
reset role;
-- B/G pair has every direct relationship plus accepted + pending Shared states.
insert into friendships(requester_id,addressee_id,status) values
 ('22222222-2222-2222-2222-222222222222','88888888-8888-8888-8888-888888888888','accepted');
insert into follows values('22222222-2222-2222-2222-222222222222','88888888-8888-8888-8888-888888888888',now());
insert into approved_writers(wall_id,user_id)
 select id,'88888888-8888-8888-8888-888888888888' from walls
  where owner_id='22222222-2222-2222-2222-222222222222' and type='personal';
insert into walls(id,owner_id,type,name,visibility,contribution_policy) values
 ('21000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','shared','pending','private','nobody'),
 ('21000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','shared','accepted','private','nobody');
insert into wall_members values
 ('21000000-0000-0000-0000-000000000001','88888888-8888-8888-8888-888888888888','member','pending',now()),
 ('21000000-0000-0000-0000-000000000002','88888888-8888-8888-8888-888888888888','member','accepted',now());

-- B leaves named + Anonymous Marks on G's friends-only Personal Wall.
set local role authenticated; set local "test.uid"='22222222-2222-2222-2222-222222222222';
insert into marks(id,wall_id,author_id,type,text) select
 '21000000-0000-0000-0000-000000000011',id,auth.uid(),'text','named' from walls
 where owner_id='88888888-8888-8888-8888-888888888888' and type='personal';
insert into marks(id,wall_id,author_id,type,text,anonymous) select
 '21000000-0000-0000-0000-000000000012',id,auth.uid(),'text','anon',true from walls
 where owner_id='88888888-8888-8888-8888-888888888888' and type='personal';
set local "test.uid"='88888888-8888-8888-8888-888888888888';
insert into mark_reactions values('21000000-0000-0000-0000-000000000011',auth.uid(),'❤️');
insert into blocks(blocker_id,blocked_id) values(auth.uid(),'22222222-2222-2222-2222-222222222222');

reset role;
do $$ begin
 if exists(select 1 from friendships where (requester_id,addressee_id) in
   (('22222222-2222-2222-2222-222222222222','88888888-8888-8888-8888-888888888888'),
    ('88888888-8888-8888-8888-888888888888','22222222-2222-2222-2222-222222222222'))) then raise exception '21 FAIL friendship cleanup'; end if;
 if exists(select 1 from follows where follower_id in('22222222-2222-2222-2222-222222222222','88888888-8888-8888-8888-888888888888')
   and followed_id in('22222222-2222-2222-2222-222222222222','88888888-8888-8888-8888-888888888888')) then raise exception '21 FAIL follow cleanup'; end if;
 if exists(select 1 from approved_writers aw join walls w on w.id=aw.wall_id where
   w.owner_id='22222222-2222-2222-2222-222222222222' and aw.user_id='88888888-8888-8888-8888-888888888888') then raise exception '21 FAIL approval cleanup'; end if;
 if exists(select 1 from wall_members where wall_id='21000000-0000-0000-0000-000000000001') then raise exception '21 FAIL pending invite cleanup'; end if;
 if not exists(select 1 from wall_members where wall_id='21000000-0000-0000-0000-000000000002' and status='accepted') then raise exception '21 FAIL accepted membership removed'; end if;
 if exists(select 1 from mark_reactions where mark_id='21000000-0000-0000-0000-000000000011') then raise exception '21 FAIL reaction cleanup'; end if;
 if exists(select 1 from notifications n left join notification_origins no on no.notification_id=n.id
   where (n.user_id='88888888-8888-8888-8888-888888888888' and coalesce(n.actor_id,no.true_actor_id)='22222222-2222-2222-2222-222222222222')
      or (n.user_id='22222222-2222-2222-2222-222222222222' and coalesce(n.actor_id,no.true_actor_id)='88888888-8888-8888-8888-888888888888')) then raise exception '21 FAIL Alert cleanup'; end if;
end $$;

-- Unblocking restores nothing.
set local role authenticated; set local "test.uid"='88888888-8888-8888-8888-888888888888';
delete from blocks where blocker_id=auth.uid() and blocked_id='22222222-2222-2222-2222-222222222222';
reset role;
do $$ begin
 if exists(select 1 from friendships where requester_id in('22222222-2222-2222-2222-222222222222','88888888-8888-8888-8888-888888888888')
 and addressee_id in('22222222-2222-2222-2222-222222222222','88888888-8888-8888-8888-888888888888')) then raise exception '21 FAIL unblock restored relation'; end if;
end $$;
ROLLBACK;
\echo '21 (cleanup + non-restoration)     : PASS  (accepted Shared membership preserved)'

-- Public visibility never bypasses a block; profiles/search are bilateral too.
BEGIN;
set local role authenticated; set local "test.uid"='33333333-3333-3333-3333-333333333333'; -- blocked by O
do $$ declare o_wall uuid; begin
 select id into o_wall from walls where owner_id='44444444-4444-4444-4444-444444444444' and type='personal';
 if can_view_wall(o_wall,auth.uid()) then raise exception '21 FAIL: blocked public Personal Wall visible'; end if;
 if exists(select 1 from profiles where id='44444444-4444-4444-4444-444444444444') then raise exception '21 FAIL: blocked profile visible'; end if;
 if exists(select 1 from walls where id=o_wall) then raise exception '21 FAIL: blocked walls row visible'; end if;
end $$;
ROLLBACK;
\echo '21 (public/profile bilateral block): PASS'

-- A failing later trigger rolls back both the block and all cleanup.
BEGIN;
reset role;
insert into friendships values('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555555','pending',now());
create or replace function test_force_block_failure() returns trigger language plpgsql as $$ begin raise exception 'forced'; end $$;
create trigger zzz_test_force_block_failure after insert on blocks for each row execute function test_force_block_failure();
set local role authenticated; set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare failed boolean:=false; begin
 begin insert into blocks values(auth.uid(),'55555555-5555-5555-5555-555555555555',now()); exception when others then failed:=true; end;
 if not failed then raise exception '21 FAIL forced rollback did not fail'; end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from blocks where blocker_id='11111111-1111-1111-1111-111111111111' and blocked_id='55555555-5555-5555-5555-555555555555') then raise exception '21 FAIL block survived rollback'; end if;
 if not exists(select 1 from friendships where requester_id='11111111-1111-1111-1111-111111111111' and addressee_id='55555555-5555-5555-5555-555555555555') then raise exception '21 FAIL cleanup survived rollback'; end if;
end $$;
ROLLBACK;
\echo '21 (forced cleanup rollback)       : PASS  (all-or-nothing)'
