-- 26 · Mark-aware reaction authorization
\set ON_ERROR_STOP on

BEGIN;
reset role;
-- C is blocked with O. Create named + Anonymous C Marks as protected fixtures.
insert into marks (id,wall_id,author_id,type,text,status) values
 ('26000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '33333333-3333-3333-3333-333333333333','text','named','active'),
 ('26000000-0000-0000-0000-000000000003','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111','text','hidden','hidden'),
 ('26000000-0000-0000-0000-000000000004','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111','text','removed','removed');
set local "test.uid" = '33333333-3333-3333-3333-333333333333';
insert into marks (id,wall_id,author_id,type,text,anonymous,status) values
 ('26000000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '33333333-3333-3333-3333-333333333333','text','anon',true,'active');

set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444'; -- O, blocked with C
do $$ declare a boolean:=false; b boolean:=false; begin
  begin insert into mark_reactions values ('26000000-0000-0000-0000-000000000001',auth.uid(),'❤️'); exception when others then a:=true; end;
  begin insert into mark_reactions values ('26000000-0000-0000-0000-000000000002',auth.uid(),'❤️'); exception when others then b:=true; end;
  if not (a and b) then raise exception '26 FAIL: blocked named/Anonymous author reaction allowed'; end if;
end $$;
ROLLBACK;
\echo '26 (blocked author-aware)          : PASS  (named + Anonymous denied without leak)'

BEGIN;
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';
do $$ declare bademoji boolean:=false; hidden boolean:=false; removed boolean:=false; begin
  begin insert into mark_reactions values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',auth.uid(),'😎'); exception when check_violation then bademoji:=true; when others then bademoji:=true; end;
  begin insert into mark_reactions values ('26000000-0000-0000-0000-000000000003',auth.uid(),'❤️'); exception when others then hidden:=true; end;
  begin insert into mark_reactions values ('26000000-0000-0000-0000-000000000004',auth.uid(),'❤️'); exception when others then removed:=true; end;
  if not (bademoji and hidden and removed) then raise exception '26 FAIL: reaction boundary accepted invalid state'; end if;
end $$;
ROLLBACK;
\echo '26 (emoji + active state)          : PASS  (fixed set; hidden/removed denied)'

BEGIN;
reset role;
insert into mark_reactions values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
 '88888888-8888-8888-8888-888888888888','❤️');
update marks set status='hidden' where id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888';
delete from mark_reactions where mark_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1' and user_id=auth.uid();
reset role;
do $$ begin
 if exists(select 1 from mark_reactions where mark_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1' and user_id='88888888-8888-8888-8888-888888888888') then
   raise exception '26 FAIL: self-delete after access loss failed'; end if;
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

