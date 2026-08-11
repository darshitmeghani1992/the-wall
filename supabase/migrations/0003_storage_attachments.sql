-- ════════════════════════════════════════════════════════════════════════════
-- 0003 · SEC-001 Storage Foundation (F6)
--
-- Reproducibly creates the public `attachments` bucket and storage.objects RLS,
-- per FP-SEC-001 (Rev 2) / ADR-006. Matches upload.ts:
--   read   → public (media_url / avatar_url are world-readable public URLs)
--   write  → authenticated, path-scoped: avatars/{uid}/… and marks/…
--   modify → object owner only (owner set by Storage to auth.uid())
--
-- Additive and idempotent. Independent of 0002.
-- ════════════════════════════════════════════════════════════════════════════

-- Public bucket (matches upload.ts public-URL usage).
insert into storage.buckets (id, name, public)
  values ('attachments','attachments', true)
  on conflict (id) do update set public = true;

-- storage.objects already has RLS in real Supabase; ensure it here too.
alter table storage.objects enable row level security;

-- Public read (bucket is public; media_url/avatar_url are world-readable URLs).
drop policy if exists "attachments read" on storage.objects;
create policy "attachments read" on storage.objects for select
  using (bucket_id = 'attachments');

-- Authenticated write, path-scoped: avatars must live under the caller's own uid
-- folder; marks under marks/. (marks/{wallId}/… cannot be uid-scoped — the object
-- is uploaded before the mark row exists; contribution auth is enforced at the
-- marks INSERT policy and the bucket is public-read regardless — ADR-006.)
drop policy if exists "attachments insert" on storage.objects;
create policy "attachments insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (
      ((storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text)
      or (storage.foldername(name))[1] = 'marks'
    )
  );

-- Users manage only their own objects (owner set by Storage to auth.uid()).
drop policy if exists "attachments modify own" on storage.objects;
create policy "attachments modify own" on storage.objects for update to authenticated using (owner = auth.uid());
drop policy if exists "attachments delete own" on storage.objects;
create policy "attachments delete own" on storage.objects for delete to authenticated using (owner = auth.uid());
