-- ════════════════════════════════════════════════════════════════════════
-- 0019 · Disable excluded MVP surfaces (Package B)
--
-- Comments, polls and prototype/game/doodle Mark types are retained for
-- reversible moderation/history purposes but are unreachable to app roles.
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists "comments view" on comments;
drop policy if exists "comments insert self" on comments;
drop policy if exists "comments delete author or owner" on comments;
revoke all on comments from anon, authenticated;

drop policy if exists "votes view" on poll_votes;
drop policy if exists "votes write self" on poll_votes;
drop policy if exists "votes update self" on poll_votes;
revoke all on poll_votes from anon, authenticated;

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
  ) then
    alter publication supabase_realtime drop table comments;
  end if;
end $$;

-- Defense in depth for any future policy/grant drift. Historical inserts by the
-- database owner remain possible for migration/moderation, but runtime roles
-- can never create a retired type.
create or replace function marks_reject_retired_type()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if current_user in ('anon','authenticated','service_role')
     and new.type not in ('text'::mark_type, 'photo'::mark_type,
                          'voice'::mark_type, 'video'::mark_type) then
    raise exception 'MARK_TYPE_RETIRED' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists ab_marks_reject_retired_type on marks;
create trigger ab_marks_reject_retired_type before insert on marks
  for each row execute function marks_reject_retired_type();
