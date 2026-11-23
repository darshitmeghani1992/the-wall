-- 0039 · Removed Secret Marks can never be revealed (issue #66 / #57).
-- DRAFT ONLY. No hosted schema/ACL/flag changes are authorized by this file.
-- Replaces the original 0010 reveal routine without a new client error code.
-- Invariant: removal wins before a reveal -> no content. A reveal that commits
-- before removal is permitted. Lock the parent Mark BEFORE consuming the secret
-- payload, matching owner/moderator removal's parent-row lock ordering.

create or replace function public.reveal_secret(p_mark_id uuid)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public as $$
declare
  v_status text;
  v_content text;
  v_opened timestamptz;
begin
  -- Lock the Mark row to serialize against owner, moderator and expiry
  -- transitions. A plain SELECT followed by UPDATE mark_secrets can use a stale
  -- "active" snapshot when an independent removal commits in between.
  select m.status into v_status
    from public.marks m
    join public.walls w on w.id = m.wall_id
   where m.id = p_mark_id and w.owner_id = auth.uid()
     for update of m;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_authorized');
  end if;
  -- Keep the established missing/consumed/expired/not_authorized vocabulary.
  -- A removed Mark cannot reveal even if its side-table payload still exists
  -- from a historical soft-removal. No content or opened_at mutation leaks.
  if v_status is distinct from 'active' then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;

  update public.mark_secrets
     set opened_at = now()
   where mark_id = p_mark_id
     and opened_at is null
     and now() < expires_at
  returning content into v_content;
  if found then
    return jsonb_build_object('ok', true, 'reason', 'ok', 'content', v_content);
  end if;

  select opened_at into v_opened
    from public.mark_secrets where mark_id = p_mark_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  elsif v_opened is not null then
    return jsonb_build_object('ok', false, 'reason', 'consumed');
  else
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
end $$;

revoke all on function public.reveal_secret(uuid) from public, anon;
grant execute on function public.reveal_secret(uuid) to authenticated;

-- Remove the side-table content in the SAME transaction when a Secret Mark
-- crosses the removed boundary, including a later restoration of a legacy
-- removed row. This makes removal permanent, not merely hidden in UI.
-- Trigger privileges run under its trusted owner; no app role can invoke this
-- function directly. The parent lock in reveal prevents removal/reveal races.
create or replace function public.scrub_removed_secret_payload()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public as $$
begin
  if old.type = 'secret'
     and old.status is distinct from new.status
     and (old.status = 'removed' or new.status = 'removed') then
    delete from public.mark_secrets where mark_id = new.id;
  end if;
  return new;
end $$;
revoke all on function public.scrub_removed_secret_payload() from public, anon, authenticated;

drop trigger if exists zzz_scrub_removed_secret_payload on public.marks;
create trigger zzz_scrub_removed_secret_payload
  after update of status on public.marks
  for each row execute function public.scrub_removed_secret_payload();

-- Keep the existing expire_secret_marks() integer return contract after the
-- removal trigger scrubs expired payloads during the parent UPDATE.
-- Count active expired shells (each trigger-deleted secret) plus any expired
-- legacy orphaned side-table rows which are deleted by the final statement.
create or replace function public.expire_secret_marks()
returns integer language plpgsql security definer
set search_path = pg_catalog, public as $$
declare
  v_marked integer;
  v_purged integer;
begin
  update public.marks m
     set status = 'removed'
   where m.type = 'secret'
     and m.status = 'active'
     and exists (select 1 from public.mark_secrets s
                  where s.mark_id = m.id and now() >= s.expires_at);
  get diagnostics v_marked = row_count;

  with del as (
    delete from public.mark_secrets
     where now() >= expires_at returning 1
  )
  select count(*) into v_purged from del;
  return v_marked + v_purged;
end $$;
revoke all on function public.expire_secret_marks() from public, anon, authenticated;
grant execute on function public.expire_secret_marks() to service_role;
