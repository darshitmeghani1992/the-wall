-- ════════════════════════════════════════════════════════════════════════════
-- 50_storage.sql · F6 storage authorization + reproducibility
--
-- Verifies 0003's storage.objects RLS against the acting end-user roles:
--   • bucket reproducible from source (exists + public)
--   • public read (anon)
--   • authenticated write scoped to avatars/{own uid}/… and marks/…
--   • other-uid avatar write denied; neither-prefix write denied; anon write denied
--   • delete own only
-- Seed objects are inserted as superuser (persist across the per-test txns).
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- Seed (autocommit, as postgres): one A-owned marks object, one B-owned avatar.
insert into storage.objects (id, bucket_id, name, owner) values
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1','attachments',
     'marks/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/x.png',
     '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2','attachments',
     'avatars/22222222-2222-2222-2222-222222222222/pic.png',
     '22222222-2222-2222-2222-222222222222');

-- ── Reproducibility (F6): the bucket is defined in source and public ─────────
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'attachments' and public) then
    raise exception 'STORAGE FAIL: attachments bucket missing or not public';
  end if;
end $$;
\echo 'STORAGE (bucket reproducible)      : PASS  (attachments exists + public)'

-- ── RLS enabled on storage.objects (F6): the platform pre-enables and manages
-- RLS on storage.objects on hosted Supabase; 0003 deliberately does NOT toggle
-- it (non-owner migration role → 42501). Here the shim (00_bootstrap.sql)
-- enables it, mirroring the platform. Prove RLS is actually ON, else every
-- write/own-management assertion below would be vacuous. ─────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass) then
    raise exception 'STORAGE FAIL: RLS is NOT enabled on storage.objects';
  end if;
end $$;
\echo 'STORAGE (RLS enabled)              : PASS  (relrowsecurity = true)'

-- ── Public read: anon can SELECT objects in the public bucket ────────────────
BEGIN;
set local role anon;
set local "test.uid" = '';
do $$
begin
  if (select count(*) from storage.objects where bucket_id = 'attachments') < 2 then
    raise exception 'STORAGE FAIL: public read did not return objects';
  end if;
end $$;
ROLLBACK;
\echo 'STORAGE (public read)              : PASS  (anon reads public bucket)'

-- ── Authenticated write to own avatar folder → ALLOWED ───────────────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('attachments','avatars/11111111-1111-1111-1111-111111111111/new.png');
  if not exists (select 1 from storage.objects
                 where name = 'avatars/11111111-1111-1111-1111-111111111111/new.png') then
    raise exception 'STORAGE FAIL: authenticated could not write own avatar';
  end if;
end $$;
ROLLBACK;
\echo 'STORAGE (write own avatar)         : PASS  (avatars/{own uid}/… allowed)'

-- ── Authenticated write under marks/ → ALLOWED ───────────────────────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('attachments','marks/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/y.png');
  if not exists (select 1 from storage.objects
                 where name = 'marks/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/y.png') then
    raise exception 'STORAGE FAIL: authenticated could not write under marks/';
  end if;
end $$;
ROLLBACK;
\echo 'STORAGE (write marks/ prefix)      : PASS  (marks/… allowed)'

-- ── Authenticated write to ANOTHER user's avatar folder → DENIED ─────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
do $$
declare denied boolean := false;
begin
  begin
    insert into storage.objects (bucket_id, name)
    values ('attachments','avatars/22222222-2222-2222-2222-222222222222/evil.png');
  exception when others then denied := true;  -- foldername[2] <> auth.uid() → RLS fails
  end;
  if not denied then raise exception 'STORAGE FAIL: wrote into another user''s avatar folder'; end if;
end $$;
ROLLBACK;
\echo 'STORAGE (other-uid avatar write)   : PASS  (denied)'

-- ── Authenticated write under a NON-scoped prefix → DENIED ───────────────────
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
do $$
declare denied boolean := false;
begin
  begin
    insert into storage.objects (bucket_id, name)
    values ('attachments','other/whatever.png');
  exception when others then denied := true;  -- neither avatars/{uid} nor marks/ → RLS fails
  end;
  if not denied then raise exception 'STORAGE FAIL: wrote under a non-scoped prefix'; end if;
end $$;
ROLLBACK;
\echo 'STORAGE (non-scoped prefix write)  : PASS  (denied)'

-- ── Anonymous (unauthenticated) write → DENIED ───────────────────────────────
BEGIN;
set local role anon;
set local "test.uid" = '';
do $$
declare denied boolean := false;
begin
  begin
    insert into storage.objects (bucket_id, name)
    values ('attachments','marks/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/anon.png');
  exception when others then denied := true;  -- no insert grant / policy for anon
  end;
  if not denied then raise exception 'STORAGE FAIL: anonymous user wrote an object'; end if;
end $$;
ROLLBACK;
\echo 'STORAGE (anon write)               : PASS  (denied)'

-- ── Delete-own-only: A cannot delete B's object; A can delete its own ────────
BEGIN;
set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';   -- A
do $$
begin
  -- B's avatar object: RLS USING owner=auth.uid() filters it out → 0 rows
  delete from storage.objects where id = 'dddddddd-dddd-dddd-dddd-ddddddddddd2';
  if not exists (select 1 from storage.objects where id = 'dddddddd-dddd-dddd-dddd-ddddddddddd2') then
    raise exception 'STORAGE FAIL: deleted another user''s object';
  end if;
  -- A's own object: deletes
  delete from storage.objects where id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1';
  if exists (select 1 from storage.objects where id = 'dddddddd-dddd-dddd-dddd-ddddddddddd1') then
    raise exception 'STORAGE FAIL: could not delete own object';
  end if;
end $$;
ROLLBACK;
\echo 'STORAGE (delete own only)          : PASS  (own deleted; other''s protected)'

\echo '── 50_storage: ALL PASS (F6 storage + reproducibility) ──'
