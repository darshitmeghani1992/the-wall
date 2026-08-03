# 12 · Security *(living)*

Security is specified here, not left to implementation. Items are marked
`[in place]` when built.

## Access control
- **RLS is the boundary** — every table denies by default; policies grant the
  minimum. `[in place]` for the 0010 schema.
- **Anonymity** — anonymous marks never expose an author to any client. `[in place]`
- **Blocked users** — cannot view, contribute, or notify (either direction). ⬜
- **Deleted content/accounts** — cascade deletes; no orphaned references. `[in place]`

## Abuse prevention
| Control | Intent | Status |
|---|---|---|
| Rate limiting | Cap marks/comments/requests per user per window | ⬜ |
| Spam detection | Flag repeated/near-duplicate content | ⬜ |
| Profanity/slur filter | Block or flag per policy (configurable) | ⬜ |
| Report flow | Users flag marks; owner/mods review | ⬜ (table exists) |
| Moderation queue | Owner approves pending marks | ⬜ |

## Media
- **Type validation** — images only for photo/avatar/doodle. ⬜ enforce server-side
- **Size limits** — ≤6 MB profile/mark images. `[partial]` client-checked in `upload.ts`
- **Content scanning** — consider on-upload checks for disallowed content. ⬜

## Platform / transport
- HTTPS everywhere via the agent/Supabase; never disable TLS verification.
- Secrets only in env (`EXPO_PUBLIC_*` for the anon key; service-role key never
  ships in the app).
- API throttling at the edge (Supabase / gateway) for hot endpoints. ⬜

## Auditing
- **Audit log** for sensitive actions (block, report resolution, mark removal). ⬜
- Retain minimal PII; document data-retention in the privacy policy.

## Implementation approach for rate limits (proposed)
Add a `rate_events` table + a Postgres function that counts recent actions per
`(user, action)` and rejects over-threshold inserts, or enforce at an edge
function. Decide during feature `F`/`G`.

> Move items to `[in place]` as they land; note in `14_Changelog`.
