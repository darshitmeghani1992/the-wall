-- 56 · Personal-Wall contribution + immutable identity + capabilities
\set ON_ERROR_STOP on

-- Owner self-posting is denied by helper and direct RLS insert.
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';
do $$ declare wid uuid; rejected boolean:=false; begin
 select id into wid from walls where owner_id=auth.uid() and type='personal';
 if current_user_can_contribute(wid) then raise exception '56 FAIL: owner contribution helper true'; end if;
 begin insert into marks(wall_id,author_id,type,text) values(wid,auth.uid(),'text','self');
 exception when others then rejected:=true; end;
 if not rejected then raise exception '56 FAIL: owner self-posted ordinary Personal Mark'; end if;
end $$;
ROLLBACK;
\echo '56 (Personal owner self-post)      : PASS  (Status only; ordinary Mark denied)'

-- Everyone/friends/selected remain distinct, with private visibility winning.
BEGIN;
reset role;
update walls set visibility='public', contribution_policy='everyone'
 where owner_id='55555555-5555-5555-5555-555555555555' and type='personal';
do $$ declare wid uuid; begin
 select id into wid from walls where owner_id='55555555-5555-5555-5555-555555555555' and type='personal';
 if not can_contribute(wid,'11111111-1111-1111-1111-111111111111') then raise exception '56 FAIL: everyone policy denied'; end if;
 update walls set visibility='private' where id=wid;
 if can_contribute(wid,'11111111-1111-1111-1111-111111111111') then raise exception '56 FAIL: private visibility did not win'; end if;
end $$;
ROLLBACK;
\echo '56 (policy/privacy separation)     : PASS'

-- Wall identity/type and Mark identity/type/modes cannot be rewritten by app callers.
BEGIN;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';
do $$ declare wid uuid; a boolean:=false; b boolean:=false; begin
 select id into wid from walls where owner_id=auth.uid() and type='personal';
 begin update walls set type='shared' where id=wid; exception when others then a:=true; end;
 begin update walls set owner_id='11111111-1111-1111-1111-111111111111' where id=wid; exception when others then b:=true; end;
 if not(a and b) then raise exception '56 FAIL: Wall identity/type mutable'; end if;
end $$;
ROLLBACK;

BEGIN;
reset role;
insert into marks(id,wall_id,author_id,type,text) values
 ('56000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111','text','immutable');
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ declare a boolean:=false; b boolean:=false; c boolean:=false; begin
 begin update marks set wall_id='dddddddd-dddd-dddd-dddd-dddddddddddd' where id='56000000-0000-0000-0000-000000000001'; exception when others then a:=true; end;
 begin update marks set type='photo' where id='56000000-0000-0000-0000-000000000001'; exception when others then b:=true; end;
 begin update marks set anonymous=true where id='56000000-0000-0000-0000-000000000001'; exception when others then c:=true; end;
 if not(a and b and c) then raise exception '56 FAIL: Mark identity/type/mode mutable'; end if;
end $$;
ROLLBACK;
\echo '56 (identity/type immutability)    : PASS  (Wall + Mark boundaries)'

-- Missing/private/blocked/deactivated all expose the identical unavailable shape.
BEGIN;
reset role;
update walls set visibility='private'
 where owner_id='11111111-1111-1111-1111-111111111111' and type='personal';
create temp table capability_fixture(blocked_wall uuid not null, private_wall uuid not null) on commit drop;
insert into capability_fixture
select
 (select id from walls where owner_id='44444444-4444-4444-4444-444444444444' and type='personal'),
 (select id from walls where owner_id='11111111-1111-1111-1111-111111111111' and type='personal');
grant select on capability_fixture to authenticated;
set local role authenticated;
set local "test.uid"='33333333-3333-3333-3333-333333333333'; -- blocked by O
do $$ declare missing jsonb; blocked jsonb; blocked_wall uuid; private_wall uuid; private_result jsonb; begin
 missing := get_wall_capabilities('ffffffff-ffff-ffff-ffff-ffffffffffff');
 select f.blocked_wall,f.private_wall into strict blocked_wall,private_wall from capability_fixture f;
 blocked := get_wall_capabilities(blocked_wall);
 private_result := get_wall_capabilities(private_wall);
 if missing <> '{"status":"unavailable"}'::jsonb or blocked <> missing or private_result <> missing then
   raise exception '56 FAIL: unavailable capability response enumerates state'; end if;
end $$;
ROLLBACK;
\echo '56 (capability non-enumeration)    : PASS  (one unavailable response)'

-- Shared ownership transfer is atomic and only current-owner → accepted active member.
BEGIN;
reset role;
do $$ declare rejected boolean:=false; begin
 begin
   update walls set owner_id='22222222-2222-2222-2222-222222222222'
    where id='dddddddd-dddd-dddd-dddd-dddddddddddd';
 exception when others then rejected := (SQLERRM like '%WALL_OWNER_RPC_ONLY%'); end;
 if not rejected then raise exception '56 FAIL: privileged direct owner rewrite bypassed RPC'; end if;
end $$;
set local role authenticated;
set local "test.uid"='44444444-4444-4444-4444-444444444444';
do $$ begin
 if not transfer_shared_wall_ownership('dddddddd-dddd-dddd-dddd-dddddddddddd',
       '22222222-2222-2222-2222-222222222222') then raise exception '56 FAIL: valid transfer denied'; end if;
 if (select owner_id from walls where id='dddddddd-dddd-dddd-dddd-dddddddddddd') <> '22222222-2222-2222-2222-222222222222' then
   raise exception '56 FAIL: transfer did not set owner'; end if;
 if not exists(select 1 from wall_members where wall_id='dddddddd-dddd-dddd-dddd-dddddddddddd'
   and user_id='44444444-4444-4444-4444-444444444444' and status='accepted') then
   raise exception '56 FAIL: prior owner did not become member'; end if;
end $$;
ROLLBACK;
\echo '56 (Shared ownership transfer)     : PASS  (atomic owner/member swap)'
