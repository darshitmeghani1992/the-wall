-- ════════════════════════════════════════════════════════════════════════════
-- 00_bootstrap.sql · Supabase-compat SHIM for the SEC-001 local test harness.
--
-- Stands up the minimum of Supabase's platform surface so 0001/0002/0003 load
-- and behave as they do in production, and so tests can act AS the real end-user
-- roles under RLS. Every item here is load-bearing per FP-SEC-001 (Rev 2)
-- Test-Harness Architecture; several were discovered empirically.
--
-- Idempotent: schemas dropped/recreated; roles created if-not-exists; grants and
-- default privileges re-applied each run. run_tests.sh drops/recreates the whole
-- database first, so this always starts clean.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Schemas (public reset so a bare re-run is clean too) ─────────────────────
drop schema if exists auth    cascade;
drop schema if exists storage cascade;
drop schema if exists public  cascade;
create schema public;
create schema auth;
create schema storage;

-- ── Roles (cluster-level; survive DB drop, so create if-not-exists) ──────────
do $$ begin create role anon          nologin noinherit;            exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin noinherit;            exception when duplicate_object then null; end $$;
do $$ begin create role service_role  nologin noinherit bypassrls;  exception when duplicate_object then null; end $$;
-- Ensure attributes even if the roles pre-existed from an earlier run.
alter role service_role bypassrls;
alter role authenticated nobypassrls;
alter role anon          nobypassrls;

-- ── Schema usage ─────────────────────────────────────────────────────────────
grant usage on schema public  to anon, authenticated, service_role;
grant usage on schema auth     to anon, authenticated, service_role;
grant usage on schema storage  to anon, authenticated, service_role;

-- ── auth.users + auth.uid() (reads a per-session/txn GUC) ────────────────────
create table auth.users (
  id         uuid primary key,
  email      text,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- ── Default table privileges — the grants real Supabase applies by default ───
-- Applied BEFORE 0001/0002/0003 load, so every table those migrations create is
-- automatically granted (this is why we use ALTER DEFAULT PRIVILEGES rather than
-- a blanket grant on a schema whose tables do not exist yet). anon/authenticated
-- are the RLS-subject roles; service_role deliberately gets NO blanket table
-- grant here — it relies on BYPASSRLS plus the EXPLICIT grants inside 0002 (this
-- keeps the "BYPASSRLS is not a table GRANT" moderation assertion meaningful).
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant select on tables to anon;

-- ── storage schema: buckets, objects, foldername() ──────────────────────────
create table storage.buckets (
  id         text primary key,
  name       text,
  public     boolean not null default false,
  created_at timestamptz not null default now()
);

create table storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text not null,
  owner      uuid default auth.uid(),      -- Storage sets owner = auth.uid() on insert
  created_at timestamptz not null default now()
);

-- Match Supabase semantics: path segments EXCLUDING the filename.
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:cardinality(string_to_array(name, '/')) - 1];
$$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;

-- Storage base grants (Supabase grants these; RLS still governs row access).
grant select on storage.buckets to anon, authenticated, service_role;
grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;

-- ── Realtime publication (so 0001's `alter publication … add table` succeeds) ─
drop publication if exists supabase_realtime;
create publication supabase_realtime;

-- ── Side-table exposure trap (mandated FINAL step) ───────────────────────────
-- The moderator-only side table must never be reachable by anon/authenticated.
-- 0002 revokes it after creation; this guarded re-revoke ensures no blanket
-- grant (here or later) can re-expose it. At bootstrap time the table does not
-- exist yet (created by 0002), so this is a safe no-op now and a hard backstop
-- on any re-run where it does exist.
do $$
begin
  if to_regclass('public.anonymous_mark_authors') is not null then
    execute 'revoke all on anonymous_mark_authors from anon, authenticated';
  end if;
end $$;
