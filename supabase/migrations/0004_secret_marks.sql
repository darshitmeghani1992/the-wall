-- ════════════════════════════════════════════════════════════════════════════
-- 0004 · MVP Batch C — Area A: TRUE Secret Marks (FP-C2 Rev 2 / ADR-008)
--
-- Closes the secret-content leak: today `marks.text` is world-readable via RLS
-- AND streamed over the `supabase_realtime` publication (0001:351), so a "secret"
-- Mark is only client-blurred → its content is fully retrievable over REST and
-- realtime. This mirrors SEC-001's F4 anonymity side-table pattern, but for
-- *content* rather than *authorship*:
--   • content lives ONLY in an RLS-gated side table `mark_secrets`
--   • the base `marks` row carries `text = NULL` for secrets (so REST + the
--     realtime INSERT payload both carry no secret content)
--   • `mark_secrets` is NEVER added to the realtime publication
--   • a plain table CHECK keeps secret content off the base row across the WHOLE
--     row lifecycle (not just at INSERT), so an authorized editor (author OR wall
--     owner) cannot re-populate `marks.text` and broadcast the secret
--
-- Additive and idempotent (if-not-exists / drop-if-exists / do-block guards), in
-- the style of 0001/0002. Does NOT modify 0001/0002/0003. Build on top only.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Side table: secret content lives ONLY here; never on marks; never in the
-- realtime publication. Deliberately NO `author_id` column → an anonymous+secret
-- mark cannot be de-anonymized by the owner reading its content (identity stays
-- in anonymous_mark_authors, service_role only). The FK to marks(id) is
-- DEFERRABLE INITIALLY DEFERRED (ADR-008) so the child insert — which the
-- BEFORE-INSERT trigger performs before the parent row is visible — validates at
-- commit, not mid-statement.
create table if not exists mark_secrets (
  mark_id uuid primary key
    references marks(id) on delete cascade deferrable initially deferred,
  content    text not null,
  created_at timestamptz not null default now()
);
alter table mark_secrets enable row level security;

-- READ = wall owner (the recipient) only, via a join to walls. No author read-back.
drop policy if exists "mark_secrets read owner" on mark_secrets;
create policy "mark_secrets read owner" on mark_secrets for select to authenticated
  using (exists (select 1 from marks m join walls w on w.id = m.wall_id
                 where m.id = mark_secrets.mark_id and w.owner_id = auth.uid()));

-- Grants (explicit, reproducible-from-source — same lesson as 0002 F4):
--   • anon:          no access at all (a secret is never anon-readable).
--   • authenticated: SELECT only, narrowed to the wall owner by the RLS policy
--                    above; NO insert/update/delete — the client must never write
--                    secret content directly, only the SECURITY DEFINER trigger
--                    below does (it runs as the table owner, not the caller, so
--                    the client needs no write privilege here).
--   • service_role:  SELECT for the moderation path (BYPASSRLS is NOT a table
--                    GRANT — service_role needs an explicit grant to read).
revoke all on mark_secrets from anon;
revoke insert, update, delete on mark_secrets from authenticated;
grant  select on mark_secrets to authenticated;   -- RLS narrows rows to the owner
grant  select on mark_secrets to service_role;     -- moderation read path

-- ── Write-boundary move: a SINGLE BEFORE INSERT trigger on marks moves the
-- content into mark_secrets and nulls marks.text (ADR-008 explains why one
-- deferrable-FK trigger here vs SEC-001's two-trigger anonymity split). Runs as
-- SECURITY DEFINER so it can insert into the client-revoked side table.
create or replace function marks_extract_secret()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'secret' and new.text is not null then
    insert into mark_secrets (mark_id, content) values (new.id, new.text)
      on conflict (mark_id) do update set content = excluded.content;  -- deferred FK OK at commit
    new.text := null;   -- base row + realtime INSERT payload carry NO secret content
  end if;
  return new;
end $$;

drop trigger if exists marks_extract_secret on marks;
create trigger marks_extract_secret before insert on marks
  for each row execute function marks_extract_secret();

-- ── F1 lifecycle guard: a plain table CHECK keeps secret content off the base
-- row across the WHOLE row lifecycle, not just at INSERT. Table CHECKs are
-- evaluated AFTER BEFORE-triggers, so the trigger-nulled INSERT passes; any later
-- `update marks set text=…` on a secret (by the author OR the wall owner) is
-- rejected with check_violation. This closes the "authorized party re-populates
-- and broadcasts the secret via realtime" path and prevents a stale duplicate vs
-- mark_secrets. Non-secret marks are unaffected. Idempotent via a duplicate_object
-- guard (add-constraint has no IF NOT EXISTS).
do $$ begin
  alter table marks add constraint marks_secret_text_null
    check (type <> 'secret' or text is null);
exception when duplicate_object then null; end $$;
