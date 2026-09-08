-- ════════════════════════════════════════════════════════════════════════════
-- 58_activation_foundation.sql · Unit A activation persistence, actor-bound
-- account routing, safe Personal-Wall defaults, and Status RLS.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- Re-running 0025 after new profiles exist must not misclassify them as
-- established accounts. This also verifies the migration's additive rerun path.
\ir ../migrations/0025_activation_foundation.sql

-- ── Established-account backfill and new-account defaults ──────────────────
do $$
declare
  v_existing_wall public.walls%rowtype;
  v_new_wall public.walls%rowtype;
begin
  if not exists (
    select 1 from public.profiles
     where id = '99999999-9999-9999-9999-999999999999'
       and onboarding_completed
       and walkthrough_completed_at is not null
  ) then
    raise exception '58 FAIL: established profile was not backfilled complete';
  end if;

  select * into strict v_existing_wall from public.walls
   where owner_id = '99999999-9999-9999-9999-999999999999' and type = 'personal';
  if v_existing_wall.visibility <> 'public'
     or v_existing_wall.contribution_policy <> 'friends'
     or not v_existing_wall.allow_anonymous then
    raise exception '58 FAIL: existing Personal Wall settings were rewritten';
  end if;

  if not exists (
    select 1 from public.profiles
     where id = '11111111-1111-1111-1111-111111111111'
       and onboarding_completed = false
       and walkthrough_completed_at is null
  ) then
    raise exception '58 FAIL: post-0025 profile did not receive incomplete defaults';
  end if;

  select * into strict v_new_wall from public.walls
   where owner_id = '11111111-1111-1111-1111-111111111111' and type = 'personal';
  if v_new_wall.visibility <> 'private'
     or v_new_wall.contribution_policy <> 'friends'
     or v_new_wall.allow_anonymous then
    raise exception '58 FAIL: new Personal Wall defaults are not private/friends/anonymous-off';
  end if;

  if coalesce((select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles'
         and column_name = 'onboarding_completed'),'') not like '%false%' then
    raise exception '58 FAIL: onboarding default is not false';
  end if;
end $$;
\echo '58 (activation defaults)            : PASS  (established backfill; safe new defaults)'

-- ── Bootstrap signature, ACL, fixed outcomes, and identity binding ──────────
do $$
declare
  v_count integer;
  v_sig oid;
begin
  select count(*) into v_count
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_current_account_route';
  select p.oid into v_sig
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_current_account_route';
  if v_count <> 1
     or (select pronargs from pg_catalog.pg_proc where oid = v_sig) <> 0
     or (select prorettype from pg_catalog.pg_proc where oid = v_sig) <> 'text'::regtype
     or not (select prosecdef from pg_catalog.pg_proc where oid = v_sig)
     or not ('search_path=pg_catalog, public' = any(
       select unnest(proconfig) from pg_catalog.pg_proc where oid = v_sig
     )) then
    raise exception '58 FAIL: bootstrap signature/DEFINER/search_path contract drifted';
  end if;
  if has_function_privilege('anon','public.get_current_account_route()','execute')
     or not has_function_privilege('authenticated','public.get_current_account_route()','execute') then
    raise exception '58 FAIL: bootstrap ACL is not authenticated-only';
  end if;
end $$;

begin;
set local role authenticated;
set local "test.uid" = '';
do $$ begin
  if public.get_current_account_route() <> 'unavailable' then
    raise exception '58 FAIL: null actor was not unavailable';
  end if;
end $$;
rollback;

begin;
set local role authenticated;
set local "test.uid" = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  if public.get_current_account_route() <> 'missing_profile' then
    raise exception '58 FAIL: absent own profile did not route missing_profile';
  end if;
end $$;
rollback;

begin;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';
do $$ begin
  if public.get_current_account_route() <> 'onboarding' then
    raise exception '58 FAIL: active incomplete account did not route onboarding';
  end if;
end $$;
rollback;

-- Progress fields remain self-write only through the existing profile policy.
begin;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';
update public.profiles
   set onboarding_completed = true, walkthrough_completed_at = null
 where id = auth.uid();
update public.profiles set onboarding_completed = true
 where id = '22222222-2222-2222-2222-222222222222';
do $$ begin
  if public.get_current_account_route() <> 'walkthrough' then
    raise exception '58 FAIL: actor could not persist own onboarding progress';
  end if;
end $$;
reset role;
do $$ begin
  if (select onboarding_completed from public.profiles
       where id='22222222-2222-2222-2222-222222222222') then
    raise exception '58 FAIL: actor updated another profile progress state';
  end if;
end $$;
rollback;

begin;
update public.profiles set onboarding_completed = true, walkthrough_completed_at = null
 where id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';
do $$ begin
  if public.get_current_account_route() <> 'walkthrough' then
    raise exception '58 FAIL: completed onboarding without walkthrough did not route walkthrough';
  end if;
end $$;
rollback;

begin;
update public.profiles set onboarding_completed = true, walkthrough_completed_at = now()
 where id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';
do $$ begin
  if public.get_current_account_route() <> 'ready' then
    raise exception '58 FAIL: completed active account did not route ready';
  end if;
end $$;
rollback;

begin;
alter table public.profiles drop constraint profiles_account_status_chk;
update public.profiles set account_status = 'unexpected'
 where id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';
do $$ begin
  if public.get_current_account_route() <> 'unavailable' then
    raise exception '58 FAIL: unexpected account status did not fail closed';
  end if;
end $$;
rollback;

begin;
update public.profiles set account_status = 'deactivated'
 where id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';
do $$ declare v_rows integer; begin
  if public.get_current_account_route() <> 'deactivated' then
    raise exception '58 FAIL: deactivated own account route was wrong';
  end if;
  select count(*) into v_rows from public.profiles where id = auth.uid();
  if v_rows <> 0 then raise exception '58 FAIL: deactivated actor read hidden profile'; end if;
  perform public.reactivate_account();
  if public.get_current_account_route() <> 'onboarding' then
    raise exception '58 FAIL: reactivated account did not return to onboarding';
  end if;
end $$;
rollback;

begin;
update public.profiles set account_status = 'suspended'
 where id = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';
do $$ declare v_rows integer; begin
  if public.get_current_account_route() <> 'suspended' then
    raise exception '58 FAIL: suspended own account route was wrong';
  end if;
  select count(*) into v_rows from public.profiles where id = auth.uid();
  if v_rows <> 0 then raise exception '58 FAIL: suspended actor read hidden profile'; end if;
  perform public.reactivate_account();
  if public.get_current_account_route() <> 'suspended' then
    raise exception '58 FAIL: suspended account self-reactivated';
  end if;
end $$;
rollback;

-- Two sessions receive only their own fixed outcome; no UUID argument exists.
begin;
update public.profiles set onboarding_completed = true, walkthrough_completed_at = now()
 where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set account_status = 'suspended'
 where id = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';
do $$ begin
  if public.get_current_account_route() <> 'ready' then
    raise exception '58 FAIL: first actor did not receive its own route';
  end if;
end $$;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';
do $$ begin
  if public.get_current_account_route() <> 'suspended' then
    raise exception '58 FAIL: second actor did not receive its own route';
  end if;
end $$;
rollback;
\echo '58 (actor-bound bootstrap)          : PASS  (seven outcomes; no identity substitution)'

-- ── Owner Status lifecycle and row invariants ───────────────────────────────
begin;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';
do $$
declare
  v_wall uuid;
  v_shared uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_other_wall uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_invalid_body text;
  v_rejected boolean;
begin
  select id into strict v_wall from public.walls
   where owner_id = auth.uid() and type = 'personal';
  insert into public.wall_statuses (wall_id, body, updated_at)
    values (v_wall, 'First status', '2000-01-01 00:00:00+00');
  insert into public.wall_statuses (wall_id, body) values (v_wall, 'Replacement')
    on conflict (wall_id) do update set body = excluded.body;
  if (select count(*) from public.wall_statuses where wall_id = v_wall) <> 1
     or (select body from public.wall_statuses where wall_id = v_wall) <> 'Replacement'
     or (select updated_at from public.wall_statuses where wall_id = v_wall)
        <= '2000-01-01 00:00:00+00'::timestamptz then
    raise exception '58 FAIL: owner upsert did not replace exactly one Status/stamp update';
  end if;

  v_rejected := false;
  begin insert into public.wall_statuses (wall_id, body) values (v_shared, 'Shared');
  exception when others then v_rejected := true; end;
  if not v_rejected then raise exception '58 FAIL: Shared-Wall Status was accepted'; end if;

  foreach v_invalid_body in array array['', ' padded ', repeat('x',151)] loop
    v_rejected := false;
    begin update public.wall_statuses set body = v_invalid_body where wall_id = v_wall;
    exception when check_violation then v_rejected := true; end;
    if not v_rejected then raise exception '58 FAIL: invalid Status body accepted'; end if;
  end loop;

  v_rejected := false;
  begin update public.wall_statuses set wall_id = v_other_wall where wall_id = v_wall;
  exception when check_violation then v_rejected := true; end;
  if not v_rejected then raise exception '58 FAIL: Status identity relocation succeeded'; end if;

  delete from public.wall_statuses where wall_id = v_wall;
  if exists (select 1 from public.wall_statuses where wall_id = v_wall) then
    raise exception '58 FAIL: owner could not remove Status';
  end if;
end $$;
rollback;
\echo '58 (owner Status lifecycle)         : PASS  (set/replace/remove; body + identity guarded)'

-- Shared-Wall owners cannot create a Status on their Shared Wall.
begin;
set local role authenticated;
set local "test.uid" = '44444444-4444-4444-4444-444444444444';
do $$ declare v_rejected boolean := false; begin
  begin
    insert into public.wall_statuses(wall_id,body)
    values('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','Shared owner status');
  exception when others then v_rejected := true; end;
  if not v_rejected then raise exception '58 FAIL: Shared-Wall owner created Status'; end if;
end $$;
rollback;

-- ── Non-owner writes, inactive-owner writes, and anon access fail closed ────
begin;
do $$ declare v_wall uuid; begin
  select id into strict v_wall from public.walls
   where owner_id = '11111111-1111-1111-1111-111111111111' and type = 'personal';
  insert into public.wall_statuses (wall_id,body) values (v_wall,'Owner context');
end $$;
set local role authenticated;
set local "test.uid" = '88888888-8888-8888-8888-888888888888'; -- friend
do $$ declare v_wall uuid; v_rejected boolean := false; begin
  select id into strict v_wall from public.walls
   where owner_id='11111111-1111-1111-1111-111111111111' and type='personal';
  begin update public.wall_statuses set body='Friend write' where wall_id=v_wall;
  exception when others then v_rejected := true; end;
  if not v_rejected and exists(select 1 from public.wall_statuses where wall_id=v_wall and body='Friend write') then
    raise exception '58 FAIL: friend wrote Status';
  end if;
end $$;
rollback;

-- Unrelated, follower, approved writer, and Shared-Wall member are all still
-- non-owners for the Personal-Wall Status resource.
begin;
do $$ declare v_wall uuid; begin
  select id into strict v_wall from public.walls
   where owner_id='44444444-4444-4444-4444-444444444444' and type='personal';
  update public.walls set visibility='public' where id=v_wall;
  insert into public.wall_statuses(wall_id,body) values(v_wall,'Olivia context');
  insert into public.follows(follower_id,followed_id)
    values('22222222-2222-2222-2222-222222222222','44444444-4444-4444-4444-444444444444');
  insert into public.approved_writers(wall_id,user_id)
    values(v_wall,'77777777-7777-7777-7777-777777777777');
end $$;

set local role authenticated;
set local "test.uid"='22222222-2222-2222-2222-222222222222'; -- follower
do $$ declare v_wall uuid; begin
  select id into strict v_wall from public.walls
   where owner_id='44444444-4444-4444-4444-444444444444' and type='personal';
  update public.wall_statuses set body='Follower write' where wall_id=v_wall;
end $$;
set local "test.uid"='77777777-7777-7777-7777-777777777777'; -- approved writer
do $$ declare v_wall uuid; begin
  select id into strict v_wall from public.walls
   where owner_id='44444444-4444-4444-4444-444444444444' and type='personal';
  update public.wall_statuses set body='Approved write' where wall_id=v_wall;
end $$;
set local "test.uid"='11111111-1111-1111-1111-111111111111'; -- accepted Shared-Wall member
do $$ declare v_wall uuid; begin
  select id into strict v_wall from public.walls
   where owner_id='44444444-4444-4444-4444-444444444444' and type='personal';
  update public.wall_statuses set body='Member write' where wall_id=v_wall;
end $$;
set local "test.uid"='66666666-6666-6666-6666-666666666666'; -- unrelated
do $$ declare v_wall uuid; begin
  select id into strict v_wall from public.walls
   where owner_id='44444444-4444-4444-4444-444444444444' and type='personal';
  update public.wall_statuses set body='Unrelated write' where wall_id=v_wall;
end $$;
reset role;
do $$ declare v_wall uuid; begin
  select id into strict v_wall from public.walls
   where owner_id='44444444-4444-4444-4444-444444444444' and type='personal';
  if (select body from public.wall_statuses where wall_id=v_wall) <> 'Olivia context' then
    raise exception '58 FAIL: non-owner relationship capability changed Status';
  end if;
end $$;
rollback;

-- An already-blocked user cannot write even when the Personal Wall is public.
begin;
do $$ declare v_wall uuid; begin
  select id into strict v_wall from public.walls
   where owner_id='44444444-4444-4444-4444-444444444444' and type='personal';
  update public.walls set visibility='public' where id=v_wall;
  insert into public.wall_statuses(wall_id,body) values(v_wall,'Blocked context');
  perform set_config('test.wall_id',v_wall::text,true);
end $$;
set local role authenticated;
set local "test.uid"='33333333-3333-3333-3333-333333333333';
do $$ declare v_rejected boolean := false; begin
  begin
    insert into public.wall_statuses(wall_id,body)
    select id,'Blocked write' from public.walls
     where owner_id='44444444-4444-4444-4444-444444444444' and type='personal'
    on conflict(wall_id) do update set body=excluded.body;
  exception when others then v_rejected := true; end;
end $$;
reset role;
do $$ declare v_wall uuid := current_setting('test.wall_id')::uuid; begin
  if (select body from public.wall_statuses where wall_id=v_wall) <> 'Blocked context' then
    raise exception '58 FAIL: blocked user wrote Status';
  end if;
end $$;
rollback;

begin;
do $$ declare v_wall uuid; begin
  select id into strict v_wall from public.walls
   where owner_id='11111111-1111-1111-1111-111111111111' and type='personal';
  insert into public.wall_statuses(wall_id,body) values(v_wall,'Owner context');
  perform set_config('test.wall_id',v_wall::text,true);
  update public.profiles set account_status='deactivated'
   where id='11111111-1111-1111-1111-111111111111';
end $$;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';
do $$ declare v_wall uuid := current_setting('test.wall_id')::uuid; v_rejected boolean := false; begin
  begin insert into public.wall_statuses(wall_id,body) values(v_wall,'Inactive write')
    on conflict(wall_id) do update set body=excluded.body;
  exception when others then v_rejected := true; end;
  if not v_rejected then raise exception '58 FAIL: deactivated owner wrote Status'; end if;
end $$;
rollback;

begin;
do $$ declare v_wall uuid; begin
  select id into strict v_wall from public.walls
   where owner_id='22222222-2222-2222-2222-222222222222' and type='personal';
  perform set_config('test.wall_id',v_wall::text,true);
  insert into public.wall_statuses(wall_id,body) values(v_wall,'Suspended context');
  update public.profiles set account_status='suspended'
   where id='22222222-2222-2222-2222-222222222222';
end $$;
set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';
do $$ declare v_wall uuid := current_setting('test.wall_id')::uuid; v_rejected boolean := false; begin
  begin insert into public.wall_statuses(wall_id,body) values(v_wall,'Suspended write')
    on conflict(wall_id) do update set body=excluded.body;
  exception when others then v_rejected := true; end;
  if not v_rejected then raise exception '58 FAIL: suspended owner wrote Status'; end if;
end $$;
rollback;

begin;
set local role anon;
do $$ declare v_rejected boolean := false; begin
  begin perform 1 from public.wall_statuses;
  exception when insufficient_privilege then v_rejected := true; end;
  if not v_rejected then raise exception '58 FAIL: anon retained Status table access'; end if;
  if has_function_privilege('anon','public.get_current_account_route()','execute')
     or has_function_privilege('anon','public.wall_statuses_guard_update()','execute')
     or has_function_privilege('authenticated','public.wall_statuses_guard_update()','execute')
     or has_function_privilege('anon','public.ensure_personal_wall()','execute')
     or has_function_privilege('authenticated','public.ensure_personal_wall()','execute') then
    raise exception '58 FAIL: protected activation function ACL drifted';
  end if;
end $$;
rollback;
\echo '58 (Status write boundary)          : PASS  (owner-only; inactive and anon denied)'

-- ── Status visibility follows Wall visibility and bilateral blocks ─────────
begin;
do $$ declare v_wall uuid; begin
  select id into strict v_wall from public.walls
   where owner_id='11111111-1111-1111-1111-111111111111' and type='personal';
  insert into public.wall_statuses(wall_id,body) values(v_wall,'Private context');
end $$;
set local role authenticated;
set local "test.uid"='88888888-8888-8888-8888-888888888888'; -- accepted friend
do $$ begin
  if (select count(*) from public.wall_statuses where body='Private context') <> 1 then
    raise exception '58 FAIL: accepted private viewer cannot read Status';
  end if;
end $$;
set local "test.uid"='22222222-2222-2222-2222-222222222222'; -- unrelated
do $$ begin
  if exists(select 1 from public.wall_statuses where body='Private context') then
    raise exception '58 FAIL: unrelated private viewer read Status';
  end if;
end $$;
rollback;

begin;
do $$ declare v_wall uuid; begin
  select id into strict v_wall from public.walls
   where owner_id='11111111-1111-1111-1111-111111111111' and type='personal';
  update public.walls set visibility='public' where id=v_wall;
  insert into public.wall_statuses(wall_id,body) values(v_wall,'Public context');
end $$;
set local role authenticated;
set local "test.uid"='22222222-2222-2222-2222-222222222222';
do $$ begin
  if (select count(*) from public.wall_statuses where body='Public context') <> 1 then
    raise exception '58 FAIL: public non-blocked viewer cannot read Status';
  end if;
end $$;
reset role;
insert into public.blocks(blocker_id,blocked_id)
values('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
set local role authenticated;
set local "test.uid"='22222222-2222-2222-2222-222222222222';
do $$ begin
  if exists(select 1 from public.wall_statuses where body='Public context') then
    raise exception '58 FAIL: blocked public viewer read Status';
  end if;
end $$;
rollback;
\echo '58 (Status read boundary)           : PASS  (private/public/block visibility inherited)'

-- A Personal Wall owner becoming inactive hides their Status through the same
-- current_user_can_view_wall boundary; no Status-specific exception exists.
begin;
do $$ declare v_wall uuid; begin
  select id into strict v_wall from public.walls
   where owner_id='11111111-1111-1111-1111-111111111111' and type='personal';
  update public.walls set visibility='public' where id=v_wall;
  insert into public.wall_statuses(wall_id,body) values(v_wall,'Inactive context');
  update public.profiles set account_status='deactivated'
   where id='11111111-1111-1111-1111-111111111111';
end $$;
set local role authenticated;
set local "test.uid"='22222222-2222-2222-2222-222222222222';
do $$ begin
  if exists(select 1 from public.wall_statuses where body='Inactive context') then
    raise exception '58 FAIL: viewer read deactivated owner Status';
  end if;
end $$;
rollback;

begin;
do $$ declare v_wall uuid; begin
  select id into strict v_wall from public.walls
   where owner_id='22222222-2222-2222-2222-222222222222' and type='personal';
  update public.walls set visibility='public' where id=v_wall;
  insert into public.wall_statuses(wall_id,body) values(v_wall,'Suspended context');
  update public.profiles set account_status='suspended'
   where id='22222222-2222-2222-2222-222222222222';
end $$;
set local role authenticated;
set local "test.uid"='11111111-1111-1111-1111-111111111111';
do $$ begin
  if exists(select 1 from public.wall_statuses where body='Suspended context') then
    raise exception '58 FAIL: viewer read suspended owner Status';
  end if;
end $$;
rollback;
\echo '58 (inactive Status visibility)     : PASS  (deactivated and suspended owners hidden)'

-- ── P0 arbitrary-actor helper revocations remain intact ────────────────────
do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    'is_blocked(uuid,uuid)', 'are_friends(uuid,uuid)', 'is_wall_member(uuid,uuid)',
    'is_approved_writer(uuid,uuid)', 'is_active_account(uuid)',
    'can_view_wall(uuid,uuid)', 'can_contribute(uuid,uuid)',
    'can_view_profile(uuid,uuid)', 'is_mark_true_author(uuid,uuid)',
    'can_react_to_mark(uuid,uuid)'
  ] loop
    if has_function_privilege('authenticated',v_sig,'execute')
       or has_function_privilege('anon',v_sig,'execute')
       or exists (
         select 1 from pg_catalog.pg_proc p,
              lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
          where p.oid = to_regprocedure(v_sig)
            and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
       ) then
      raise exception '58 FAIL: arbitrary-actor helper % was re-exposed', v_sig;
    end if;
  end loop;
end $$;
\echo '58 (P0 helper invariant)            : PASS  (no arbitrary-actor helper re-exposed)'

\echo '── 58_activation_foundation: ALL PASS ──'
