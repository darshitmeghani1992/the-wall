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
reset role;
update public.profiles set account_status='deactivated',deactivated_at=now()
 where id='88888888-8888-8888-8888-888888888888';
set local role authenticated;
set local "test.uid"='88888888-8888-8888-8888-888888888888';
do $$ declare wid uuid:=current_setting('tw.returning_wall')::uuid; begin
  if exists(select 1 from public.walls where id=wid) then
    raise exception '73 FAIL: deactivated owner can SELECT private wall'; end if;
end $$;
rollback;
\echo '73 (owner INSERT RETURNING + outsider/inactive exclusion): PASS'
