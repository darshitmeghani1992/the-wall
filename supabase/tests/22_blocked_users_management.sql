-- 22 · Privacy-safe, actor-bound Blocked Users management read
\set ON_ERROR_STOP on

-- Exact function shape and least-privilege ACL. There must be no alternate
-- overload that could bypass the expected-actor contract.
BEGIN;
reset role;
do $$
declare
  v_oid oid := to_regprocedure('public.list_my_blocked_users(uuid,timestamptz,uuid)');
  v_names text[];
begin
  if v_oid is null then raise exception '22 FAIL: exact RPC signature missing'; end if;
  if (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='list_my_blocked_users') <> 1 then
    raise exception '22 FAIL: alternate list_my_blocked_users overload exists';
  end if;
  select proargnames into v_names from pg_proc where oid=v_oid;
  if v_names is distinct from array['p_expected_actor_id','p_before_blocked_at','p_before_user_id']::text[] then
    raise exception '22 FAIL: argument names %',v_names;
  end if;
  if exists (
       select 1
         from pg_proc p,
              aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
        where p.oid=v_oid and acl.grantee=0 and acl.privilege_type='EXECUTE'
     )
     or has_function_privilege('anon',v_oid,'EXECUTE')
     or has_function_privilege('service_role',v_oid,'EXECUTE')
     or not has_function_privilege('authenticated',v_oid,'EXECUTE') then
    raise exception '22 FAIL: RPC ACL is not authenticated-only';
  end if;
  if not (select prosecdef and provolatile='s' and proconfig @> array['search_path=pg_catalog, public']
            from pg_proc where oid=v_oid) then
    raise exception '22 FAIL: RPC is not STABLE SECURITY DEFINER with fixed search_path';
  end if;
end $$;
ROLLBACK;
\echo '22 (signature + ACL)              : PASS'

-- Null/mismatched actors fail before cursor validation and reveal no state.
BEGIN;
set local role authenticated;
set local "test.uid"='';
do $$
declare v_failed boolean:=false;
begin
  begin
    perform list_my_blocked_users(
      '11111111-1111-1111-1111-111111111111',
      now(),
      null
    );
  exception when sqlstate '42501' then
    v_failed := sqlerrm='ACTOR_MISMATCH';
  end;
  if not v_failed then raise exception '22 FAIL: null actor did not win precedence'; end if;
end $$;
ROLLBACK;

BEGIN;
set local role authenticated;
set local "test.uid"='22222222-2222-2222-2222-222222222222';
do $$
declare v_failed boolean:=false;
begin
  begin
    perform list_my_blocked_users(
      '11111111-1111-1111-1111-111111111111',
      now(),
      null
    );
  exception when sqlstate '42501' then
    v_failed := sqlerrm='ACTOR_MISMATCH';
  end;
  if not v_failed then raise exception '22 FAIL: actor mismatch did not win precedence'; end if;
end $$;
ROLLBACK;
\echo '22 (actor precedence)             : PASS'

-- Missing or inactive accounts return only unavailable, before checking a bad
-- cursor pair. This is deliberately non-enumerating.
BEGIN;
set local role authenticated;
set local "test.uid"='aaaaaaaa-0000-4000-8000-000000000001';
do $$ declare v_result jsonb; begin
  v_result:=list_my_blocked_users(auth.uid(),now(),null);
  if v_result is distinct from '{"status":"unavailable"}'::jsonb then
    raise exception '22 FAIL missing actor result %',v_result;
  end if;
end $$;
ROLLBACK;

BEGIN;
reset role;
update profiles set account_status='deactivated'
 where id='55555555-5555-5555-5555-555555555555';
set local role authenticated;
set local "test.uid"='55555555-5555-5555-5555-555555555555';
do $$ declare v_result jsonb; begin
  v_result:=list_my_blocked_users(auth.uid(),now(),null);
  if v_result is distinct from '{"status":"unavailable"}'::jsonb then
    raise exception '22 FAIL inactive actor result %',v_result;
  end if;
end $$;
ROLLBACK;
\echo '22 (unavailable precedence)       : PASS'

-- Active callers must supply both cursor values or neither.
BEGIN;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare v_result jsonb; begin
  v_result:=list_my_blocked_users(auth.uid(),now(),null);
  if v_result is distinct from '{"status":"invalid_input"}'::jsonb then
    raise exception '22 FAIL unpaired timestamp cursor %',v_result;
  end if;
  v_result:=list_my_blocked_users(auth.uid(),null,'22222222-2222-2222-2222-222222222222');
  if v_result is distinct from '{"status":"invalid_input"}'::jsonb then
    raise exception '22 FAIL unpaired user cursor %',v_result;
  end if;
end $$;
ROLLBACK;
\echo '22 (paired cursor validation)     : PASS'

-- Olivia can manage her outbound Carol block even though ordinary profile RLS
-- hides Carol. Carol cannot infer the inbound block from her own empty list.
BEGIN;
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
do $$
declare v_result jsonb; v_item jsonb;
begin
  if exists(select 1 from profiles where id='33333333-3333-3333-3333-333333333333') then
    raise exception '22 FAIL fixture: blocked profile unexpectedly readable';
  end if;
  v_result:=list_my_blocked_users(auth.uid(),null,null);
  if v_result is null or v_result->>'status'<>'available' or jsonb_array_length(v_result->'items')<>1
     or v_result->'next_cursor'<>'null'::jsonb then
    raise exception '22 FAIL outbound list shape %',v_result;
  end if;
  if (select array_agg(k order by k) from jsonb_object_keys(v_result) k)
       is distinct from array['items','next_cursor','status']::text[] then
    raise exception '22 FAIL top-level keys %',v_result;
  end if;
  v_item:=v_result->'items'->0;
  if v_item is null
     or v_item->>'user_id'<>'33333333-3333-3333-3333-333333333333'
     or v_item->>'display_name'<>'Carol' or v_item->>'handle'<>'carol' then
    raise exception '22 FAIL allowed identity values %',v_item;
  end if;
  if (select array_agg(k order by k) from jsonb_object_keys(v_item) k)
       is distinct from array['avatar_url','blocked_at','display_name','handle','user_id']::text[] then
    raise exception '22 FAIL item leaked or omitted keys %',v_item;
  end if;
end $$;
ROLLBACK;

BEGIN;
set local role authenticated;
set local "test.uid"='33333333-3333-3333-3333-333333333333';
do $$ declare v_result jsonb; begin
  v_result:=list_my_blocked_users(auth.uid(),null,null);
  if v_result is distinct from '{"status":"available","items":[],"next_cursor":null}'::jsonb then
    raise exception '22 FAIL inbound block disclosed %',v_result;
  end if;
end $$;
ROLLBACK;
\echo '22 (outbound-only privacy)         : PASS'

-- Target lifecycle state must not make an existing outbound block impossible
-- to manage. Both deactivated and suspended targets retain the same minimal
-- five-field projection; only the actor must be active.
BEGIN;
reset role;
update profiles set account_status='deactivated'
 where id='33333333-3333-3333-3333-333333333333';
update profiles set account_status='suspended'
 where id='66666666-6666-6666-6666-666666666666';
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
do $$ declare v_item jsonb; begin
  v_item:=list_my_blocked_users(auth.uid(),null,null)->'items'->0;
  if v_item->>'user_id'<>'33333333-3333-3333-3333-333333333333'
     or (select array_agg(k order by k) from jsonb_object_keys(v_item) k)
          is distinct from array['avatar_url','blocked_at','display_name','handle','user_id']::text[] then
    raise exception '22 FAIL deactivated blocked target disappeared or leaked fields %',v_item;
  end if;
end $$;
set local "test.uid"='55555555-5555-5555-5555-555555555555';
do $$ declare v_item jsonb; begin
  v_item:=list_my_blocked_users(auth.uid(),null,null)->'items'->0;
  if v_item is null
     or v_item->>'user_id'<>'66666666-6666-6666-6666-666666666666'
     or (select array_agg(k order by k) from jsonb_object_keys(v_item) k)
          is distinct from array['avatar_url','blocked_at','display_name','handle','user_id']::text[] then
    raise exception '22 FAIL suspended blocked target disappeared or leaked fields %',v_item;
  end if;
end $$;
ROLLBACK;
\echo '22 (inactive targets manageable)   : PASS'

-- Fetch 21, return 20, and derive the continuation cursor from the 20th item.
-- Every fixture deliberately has the same timestamp, proving blocked_id is a
-- deterministic tie-breaker and that the tuple cursor has no gap or duplicate.
BEGIN;
reset role;
insert into auth.users(id,email)
select format('90000000-0000-4000-8000-%s',to_char(i,'FM000000000000'))::uuid,
       format('blocked-%s@test',i)
  from generate_series(1,21) i;
insert into profiles(id,handle,display_name,avatar_url)
select format('90000000-0000-4000-8000-%s',to_char(i,'FM000000000000'))::uuid,
       format('blocked%s',i),format('Blocked %s',i),format('avatar-%s',i)
  from generate_series(1,21) i;
insert into blocks(blocker_id,blocked_id,created_at)
select '11111111-1111-1111-1111-111111111111',
       format('90000000-0000-4000-8000-%s',to_char(i,'FM000000000000'))::uuid,
       '2026-09-15 00:00:00+00'::timestamptz
  from generate_series(1,21) i;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$
declare
  v_first jsonb;
  v_second jsonb;
  v_cursor jsonb;
  v_total integer;
  v_distinct integer;
begin
  v_first:=list_my_blocked_users(auth.uid(),null,null);
  if v_first is null or v_first->>'status'<>'available' or jsonb_array_length(v_first->'items')<>20 then
    raise exception '22 FAIL first page count %',v_first;
  end if;
  v_cursor:=v_first->'next_cursor';
  if v_cursor is null or v_cursor='null'::jsonb
     or v_cursor->>'user_id'<>'90000000-0000-4000-8000-000000000002'
     or v_cursor->>'blocked_at' is distinct from v_first->'items'->19->>'blocked_at'
     or v_cursor->>'user_id' is distinct from v_first->'items'->19->>'user_id'
     or (select array_agg(k order by k) from jsonb_object_keys(v_cursor) k)
          is distinct from array['blocked_at','user_id']::text[] then
    raise exception '22 FAIL cursor is not the 20th item %',v_first;
  end if;
  v_second:=list_my_blocked_users(
    auth.uid(),
    (v_cursor->>'blocked_at')::timestamptz,
    (v_cursor->>'user_id')::uuid
  );
  if v_second is null or v_second->>'status'<>'available'
     or jsonb_array_length(v_second->'items')<>1
     or v_second->'items'->0->>'user_id'<>'90000000-0000-4000-8000-000000000001'
     or v_second->'next_cursor'<>'null'::jsonb then
    raise exception '22 FAIL second page %',v_second;
  end if;
  select count(*),count(distinct item->>'user_id')
    into v_total,v_distinct
    from (
      select item from jsonb_array_elements(v_first->'items') as entries(item)
      union all
      select item from jsonb_array_elements(v_second->'items') as entries(item)
    ) pages;
  if v_total<>21 or v_distinct<>21 then
    raise exception '22 FAIL pagination duplicated or dropped rows: total %, distinct %',v_total,v_distinct;
  end if;
  if exists (
    select format('90000000-0000-4000-8000-%s',to_char(i,'FM000000000000'))
      from generate_series(1,21) i
    except
    select item->>'user_id'
      from (
        select item from jsonb_array_elements(v_first->'items') as entries(item)
        union all
        select item from jsonb_array_elements(v_second->'items') as entries(item)
      ) pages
  ) then
    raise exception '22 FAIL pagination has a gap across equal-timestamp rows';
  end if;
end $$;
ROLLBACK;
\echo '22 (20+1 tied-key pagination)      : PASS  (no gaps or duplicates)'

\echo '── 22_blocked_users_management: ALL PASS ──'
