# 05 · Database

Postgres on Supabase. The Wall's schema is created by
`supabase/migrations/0001_init.sql` (idempotent) in **The Wall's own Supabase
project**.

## Enums
`wall_type(personal|shared)` · `wall_visibility(public|private|invite_only)` ·
`contribution_policy(everyone|friends|selected|nobody)` ·
`mark_type(sticky|roast|secret|memory|photo|award|poll|doodle|prediction)` ·
`mark_status(active|pending|hidden|removed)` ·
`friendship_status(pending|accepted|blocked)`

## Tables

### `profiles`
`id (=auth.users.id, PK)`, `handle (unique)`, `display_name`, `avatar_url`,
`bio`, `interests text[]`, `created_at`.

### `walls`
`id`, `owner_id`, `type`, `name`, `visibility`, `contribution_policy`,
`allow_anonymous`, `require_approval`, `created_at`.
Unique partial index: **one `personal` wall per owner**.

### `marks`
`id`, `wall_id`, `author_id`, `type`, `text`, `color`, `anonymous`, `media_url`,
`payload jsonb`, `rotation`, `pinned`, `status`, `created_at`.
`payload` holds type-specifics: poll `{question, options}`, award `{award}`,
prediction `{unlock_at}`, doodle `{width,height}`.
Indexes: `(wall_id, created_at desc)`, `(author_id)`.

### `mark_reactions`
PK `(mark_id, user_id, emoji)`.

### `comments`
`id`, `mark_id`, `author_id`, `body`, `created_at`.

### `poll_votes`
PK `(mark_id, user_id)`, `option_index`.

### `friendships`
PK `(requester_id, addressee_id)`, `status`, `created_at`, check `requester ≠ addressee`.

### `notifications`
`id`, `user_id (recipient)`, `actor_id`, `kind`, `mark_id`, `wall_id`, `read`, `created_at`.

### `reports`
`id`, `reporter_id`, `mark_id`, `reason`, `created_at`.

## Helper functions (SECURITY DEFINER)
- `are_friends(a,b)` → accepted friendship either direction.
- `can_view_wall(wid,uid)` → public OR owner OR (private AND friends).
- `can_contribute(wid,uid)` → owner OR everyone OR (friends AND are_friends).

## Triggers
- `profiles_personal_wall` — after insert on `profiles`, auto-create the Personal Wall.
- `marks_set_defaults` — before insert on `marks`: reject anonymous when the wall
  forbids it; set `status` (`active` for owner, `pending` when the wall requires
  approval, else `active`).

## RLS (summary — see migration for exact policies)
- **profiles:** world-readable; write only your own row.
- **walls:** visible per visibility rules; only owner writes.
- **marks:** viewable if you can view the wall AND (`active` OR you're the author
  OR you own the wall); insert requires `author = you` AND `can_contribute`;
  update/delete by author or wall owner.
- **reactions/comments/poll_votes:** readable with the mark; write as yourself;
  owner can also delete comments.
- **friendships:** either party reads; requester inserts; either updates/deletes.
- **notifications:** recipient reads/updates own; inserts via trigger/service role.
- **reports:** insert as yourself; reads are service-role only.

## Realtime
Publication includes `marks`, `mark_reactions`, `comments`, `notifications`.

## Storage
Public bucket **`attachments`** holds avatars, mark photos,
and doodle PNGs. Path convention: `avatars/{userId}/…`, `marks/{wallId}/…`.

## Pending schema (add as features land)
- Notification inserts: add DB triggers on marks/reactions/comments/friendships
  (or a service-role writer) — currently the table & RLS exist, the producers do not.
- Rate-limit / audit tables (see `12_Security.md`).
- Editable-window + `edited_at` on marks (acceptance criteria for Sticky editing).
