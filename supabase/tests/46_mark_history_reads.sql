-- 46 · Exact active-Mark reads through the same authenticated RLS boundary
-- used by the client. The Wall/id/status predicates mirror the ordinary
-- PostgREST SELECT; no privileged RPC or service role participates in reads.
\set ON_ERROR_STOP on

BEGIN;
reset role;
-- Private Shared Wall: O owns it, B is accepted, F is pending, G is unrelated.
-- Public Shared Wall: O owns it, C is blocked by O. Trusted setup is rolled back.
insert into marks (id,wall_id,author_id,type,text,status) values
 ('46000000-0000-4000-8000-000000000001','dddddddd-dddd-dddd-dddd-dddddddddddd',
  '44444444-4444-4444-4444-444444444444','text','private active','active'),
 ('46000000-0000-4000-8000-000000000002','dddddddd-dddd-dddd-dddd-dddddddddddd',
  '44444444-4444-4444-4444-444444444444','text','private pending','pending'),
 ('46000000-0000-4000-8000-000000000003','dddddddd-dddd-dddd-dddd-dddddddddddd',
  '44444444-4444-4444-4444-444444444444','text','private hidden','hidden'),
 ('46000000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '44444444-4444-4444-4444-444444444444','text','public active','active');

set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444'; -- owner O
do $$ begin
  if (select count(*) from marks where wall_id='dddddddd-dddd-dddd-dddd-dddddddddddd'
       and id='46000000-0000-4000-8000-000000000001' and status='active')<>1 then
    raise exception '46 FAIL: owner cannot open exact active private Mark';
  end if;
  if exists(select 1 from marks where wall_id='dddddddd-dddd-dddd-dddd-dddddddddddd'
       and id in ('46000000-0000-4000-8000-000000000002',
                  '46000000-0000-4000-8000-000000000003') and status='active') then
    raise exception '46 FAIL: exact active filter admitted pending or hidden Mark';
  end if;
  if exists(select 1 from marks where wall_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and id='46000000-0000-4000-8000-000000000001' and status='active') then
    raise exception '46 FAIL: wrong-Wall exact Mark target resolved';
  end if;
end $$;
\echo '46 (owner, state, wrong Wall)      : PASS'

set local "test.uid" = '22222222-2222-2222-2222-222222222222'; -- B accepted member
do $$ begin
  if (select count(*) from marks where wall_id='dddddddd-dddd-dddd-dddd-dddddddddddd'
       and id='46000000-0000-4000-8000-000000000001' and status='active')<>1 then
    raise exception '46 FAIL: accepted member cannot open exact active private Mark';
  end if;
end $$;
\echo '46 (accepted member)              : PASS'

set local "test.uid" = '77777777-7777-7777-7777-777777777777'; -- F pending invitee
do $$ begin
  if exists(select 1 from marks where wall_id='dddddddd-dddd-dddd-dddd-dddddddddddd'
       and id='46000000-0000-4000-8000-000000000001' and status='active') then
    raise exception '46 FAIL: pending invitee read a private exact Mark';
  end if;
end $$;
\echo '46 (pending invitee denied)       : PASS'

set local "test.uid" = '88888888-8888-8888-8888-888888888888'; -- G unrelated
do $$ begin
  if exists(select 1 from marks where wall_id='dddddddd-dddd-dddd-dddd-dddddddddddd'
       and id='46000000-0000-4000-8000-000000000001' and status='active') then
    raise exception '46 FAIL: unrelated viewer read a private exact Mark';
  end if;
  if (select count(*) from marks where wall_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and id='46000000-0000-4000-8000-000000000004' and status='active')<>1 then
    raise exception '46 FAIL: unrelated viewer cannot open a public exact Mark';
  end if;
end $$;
\echo '46 (public control, private deny) : PASS'

set local "test.uid" = '33333333-3333-3333-3333-333333333333'; -- C blocked by O
do $$ begin
  if exists(select 1 from marks where wall_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
       and id='46000000-0000-4000-8000-000000000004' and status='active') then
    raise exception '46 FAIL: blocked viewer read a public exact Mark';
  end if;
end $$;
\echo '46 (blocked public deny)          : PASS'
ROLLBACK;
