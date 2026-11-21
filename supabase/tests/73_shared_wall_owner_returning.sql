\set ON_ERROR_STOP on

-- Regress the precise hosted PG17 failure. Use active seeded Grace as owner.
-- `RETURNING id` was denied before migration 0033, even though INSERT alone
-- passed. New row must be readable only to its active owner/authorized members.
begin;
set local role authenticated;
set local "test.uid"='88888888-8888-8888-8888-888888888888';
do $$ declare wid uuid; begin
  insert into public.walls(owner_id,type,name,visibility,open_join,allow_anonymous)
  values(auth.uid(),'shared','RLS INSERT RETURNING regression','private',false,false)
  returning id into wid;
  if wid is null then raise exception '73 FAIL: owner INSERT RETURNING did not yield ID'; end if;
  perform set_config('tw.returning_wall',wid::text,true);
  if not exists(select 1 from public.walls where id=wid) then
    raise exception '73 FAIL: active owner cannot SELECT newly created private wall'; end if;
end $$;
set local "test.uid"='77777777-7777-7777-7777-777777777777';
do $$ declare wid uuid:=current_setting('tw.returning_wall')::uuid; begin
  if exists(select 1 from public.walls where id=wid) then
    raise exception '73 FAIL: unrelated actor can SELECT private shared wall'; end if;
end $$;
-- Actor spoof regression: a logged-in non-owner cannot create a Shared Wall
-- whose owner_id points at Grace, even when the client requests RETURNING.
-- Keep this within the disposable DB test transaction; no hosted writes.
do $$
declare did_deny boolean:=false; v_spoofed_id uuid;
begin
  begin
    insert into public.walls(owner_id,type,name,visibility,open_join,allow_anonymous)
      values('88888888-8888-8888-8888-888888888888','shared',
        '73 forbidden owner spoof','private',false,false)
      returning id into v_spoofed_id;
  exception when insufficient_privilege then
    did_deny:=true;
  end;
  if not did_deny then
    raise exception '73 FAIL: authenticated non-owner spoofed Shared Wall owner_id via INSERT RETURNING';
  end if;
end $$;
reset role;
update public.profiles set account_status='deactivated',deactivated_at=now()
 where id='88888888-8888-8888-8888-888888888888';
set local role authenticated;
set local "test.uid"='88888888-8888-8888-8888-888888888888';
do $$ declare wid uuid:=current_setting('tw.returning_wall')::uuid; begin
  if exists(select 1 from public.walls where id=wid) then
    raise exception '73 FAIL: deactivated owner can SELECT private wall'; end if;
end $$;
-- Deactivated owners may neither read an existing private Shared Wall nor
-- create another one; this is independent of their existing owner_id.
do $$
declare did_deny boolean:=false; v_inactive_id uuid;
begin
  begin
    insert into public.walls(owner_id,type,name,visibility,open_join,allow_anonymous)
      values('88888888-8888-8888-8888-888888888888','shared',
        '73 forbidden inactive owner','private',false,false)
      returning id into v_inactive_id;
  exception when insufficient_privilege then
    did_deny:=true;
  end;
  if not did_deny then
    raise exception '73 FAIL: deactivated owner created Shared Wall via INSERT RETURNING';
  end if;
end $$;
rollback;
\echo '73 (owner RETURNING + outsider owner spoof + inactive owner denial): PASS'
