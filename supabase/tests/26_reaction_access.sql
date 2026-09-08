-- 26 · Mark-aware reaction authorization
\set ON_ERROR_STOP on

BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111'; -- A, accepted W_O member
-- Create named + Anonymous Marks through the real contributor path, then have
-- O block A. Accepted Shared membership/content remain, but pair reactions stop.
do $$ declare named_result jsonb; anon_result jsonb; begin
 named_result := create_mark('26000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','text','named',null,false,false,0,'{}'::uuid[]);
 anon_result := create_mark('26000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','text','anon',null,true,false,0,'{}'::uuid[]);
 if named_result->>'status'<>'created' or anon_result->>'status'<>'created' then
  raise exception '26 FAIL canonical Mark creation: named %, anonymous %',named_result,anon_result;
 end if;
 perform set_config('test.mark26_named',named_result->>'mark_id',true);
 perform set_config('test.mark26_anon',anon_result->>'mark_id',true);
end $$;

set local "test.uid" = '44444444-4444-4444-4444-444444444444'; -- O blocks A
-- Positive controls prove both author-resolution paths are reactable before the
-- block, so the post-block denials cannot pass because either fixture is broken.
insert into mark_reactions values
 (current_setting('test.mark26_named')::uuid,auth.uid(),'❤️'),
 (current_setting('test.mark26_anon')::uuid,auth.uid(),'❤️');
delete from mark_reactions
 where mark_id in (current_setting('test.mark26_named')::uuid,
                   current_setting('test.mark26_anon')::uuid)
   and user_id=auth.uid();
insert into blocks (blocker_id,blocked_id)
values (auth.uid(),'11111111-1111-1111-1111-111111111111');
do $$ declare a boolean:=false; b boolean:=false; begin
  begin insert into mark_reactions values (current_setting('test.mark26_named')::uuid,auth.uid(),'❤️'); exception when insufficient_privilege then a:=true; end;
  begin insert into mark_reactions values (current_setting('test.mark26_anon')::uuid,auth.uid(),'❤️'); exception when insufficient_privilege then b:=true; end;
  if not (a and b) then raise exception '26 FAIL: blocked named/Anonymous author reaction allowed'; end if;
end $$;
ROLLBACK;
\echo '26 (blocked author-aware)          : PASS  (named + Anonymous denied without leak)'

BEGIN;
reset role;
-- Protected lifecycle fixtures must exist in this transaction; the preceding
-- blocked-author test rolls back all of its data. These trusted inserts create
-- lifecycle states that an authenticated writer cannot create directly.
insert into marks (id,wall_id,author_id,type,text,status) values
 ('26000000-0000-0000-0000-000000000003','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111','text','hidden','hidden'),
 ('26000000-0000-0000-0000-000000000004','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111','text','removed','removed'),
 ('26000000-0000-0000-0000-000000000005','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111','text','active control','active');
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';
insert into mark_reactions values
 ('26000000-0000-0000-0000-000000000005',auth.uid(),'❤️');
do $$ declare bademoji boolean:=false; hidden boolean:=false; removed boolean:=false; begin
  begin insert into mark_reactions values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',auth.uid(),'😎'); exception when check_violation then bademoji:=true; end;
  begin insert into mark_reactions values ('26000000-0000-0000-0000-000000000003',auth.uid(),'❤️'); exception when insufficient_privilege then hidden:=true; end;
  begin insert into mark_reactions values ('26000000-0000-0000-0000-000000000004',auth.uid(),'❤️'); exception when insufficient_privilege then removed:=true; end;
  if not (bademoji and hidden and removed) then raise exception '26 FAIL: reaction boundary accepted invalid state'; end if;
end $$;
ROLLBACK;
\echo '26 (emoji + active state)          : PASS  (fixed set; hidden/removed denied)'

BEGIN;
reset role;
insert into mark_reactions values
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','88888888-8888-8888-8888-888888888888','❤️'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1','22222222-2222-2222-2222-222222222222','🔥');
update marks set status='hidden' where id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';
do $$ begin
 if not exists(select 1 from mark_reactions where mark_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1' and user_id=auth.uid()) then
   raise exception '26 FAIL: own reaction hidden after Mark access loss'; end if;
 if exists(select 1 from marks where id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1') then
   raise exception '26 FAIL: hidden Mark exposed by self-delete policy'; end if;
 if exists(select 1 from mark_reactions where mark_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1' and user_id='22222222-2222-2222-2222-222222222222') then
   raise exception '26 FAIL: another user''s reaction exposed after Mark access loss'; end if;
end $$;
delete from mark_reactions where mark_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1' and user_id=auth.uid();
reset role;
do $$ begin
 if exists(select 1 from mark_reactions where mark_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1' and user_id='88888888-8888-8888-8888-888888888888') then
   raise exception '26 FAIL: self-delete after access loss failed'; end if;
 if not exists(select 1 from mark_reactions where mark_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1' and user_id='22222222-2222-2222-2222-222222222222') then
   raise exception '26 FAIL: self-delete removed another user''s reaction'; end if;
end $$;
ROLLBACK;
\echo '26 (self-delete after access loss) : PASS'

BEGIN;
reset role;
insert into mark_reactions values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
 '88888888-8888-8888-8888-888888888888','❤️');
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';
do $$ declare rejected boolean:=false; begin
 begin update mark_reactions set user_id='77777777-7777-7777-7777-777777777777'
  where mark_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1' and user_id=auth.uid();
 exception when others then rejected:=true; end;
 if not rejected then raise exception '26 FAIL: reaction identity reassigned'; end if;
end $$;
ROLLBACK;
\echo '26 (reaction identity immutable)   : PASS'
