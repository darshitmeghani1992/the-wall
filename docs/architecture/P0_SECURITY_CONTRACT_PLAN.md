# P0 Security Contract Correction Plan

**Status:** Revised after independent REQUEST CHANGES; awaiting design re-review  
**Risk:** High — authorization, RLS, storage and public client contracts  
**Authority:** `THE_WALL_MASTER_BUILD_SPEC_v1.1.md` §§3, 4, 27, 31, 36–39, 51, 69, 72, 81  
**Prepared:** 2026-08-25 from independent Product, Architect and QA audits

## Outcome

Correct six verified gaps before further frontend expansion:

1. Blocking must be a bilateral boundary for Personal Walls and direct interactions.
2. Reactions must require current access to the active Mark.
3. Public Shared Walls may be viewed publicly, but only owners and accepted members may post.
4. Personal-Wall owners may use Status, but may not create ordinary Marks on their own Wall.
5. Media attached to private content must not use permanently public URLs.
6. Comments, polls and other retired Mark types must be inaccessible to MVP clients.

## Binding design revision — 2026-08-25

The first independent design review found three BLOCKER and four HIGH issues. The corrections
below are mandatory and supersede any less-specific language later in this document.

### All new Marks use one server-controlled creation path

- Revoke client direct `INSERT` on `marks` and all client writes to `mark_media`.
- Every new Mark is created through a narrowly granted `create_mark(...)` RPC that derives
  the actor from `auth.uid()` and atomically creates the Mark, ordered media rows and Alert.
- Canonical rows must keep legacy `marks.media_url` and `marks.payload` null. A DB guard must
  reject URLs/media metadata placed in either field; legacy migration uses a separately named,
  app-inaccessible maintenance operation.
- Media is staged through server-created `media_uploads` records and server-generated paths.
  Finalization locks the uploads, checks caller/Wall ownership, inspects the real storage row,
  validates type/size/cardinality and prevents reuse. Partial failure creates no Mark or Alert.
- Direct arbitrary-path upload and new `attachments/marks/*` writes are denied.

### Blocking inside Shared Walls

Accepted membership and Shared-Wall content remain intact, but a blocked pair receives no
direct identity or interaction surface:

| Surface | Required behavior |
|---|---|
| Shared Wall/content | Remains accessible according to membership/visibility. |
| Personal profile/Wall and People search | Hidden in both directions. |
| Ordinary member roster | Blocked co-member row/profile hidden. |
| Owner management | Neutral “Blocked member” row only when removal management is required; no profile link. |
| Reactions | Pair cannot react to each other's named or Anonymous Marks. |
| Invitations and Alerts | Direct invitation denied; pending invite and actor-attributed Alerts removed/suppressed. |

Anonymous true authorship is resolved only inside protected boolean helpers and is never
returned through errors, rosters, capabilities, Alerts, logs or timing-dependent payloads.

### Immutable identity and type boundaries

- Client updates may never change `walls.id`, `walls.owner_id` or `walls.type`.
- A Shared-Wall ownership transfer is allowed only through a dedicated atomic RPC: current
  owner caller, accepted active target member and no ownerless intermediate state.
- After Mark creation, `wall_id`, `author_id`, `type`, `anonymous` and `secret` are immutable.
- Owners may update only approved Wall settings; senders may edit only permitted text inside
  the existing time window; moderation changes only lifecycle fields through protected paths.
- No broad service-role/current-user bypass may reassign runtime identity or type.

### Retired types and reaction integrity

- Ordinary Mark reads and client realtime handling admit only `text`, `photo`, `voice`,
  `video`; legacy rows stay hidden and service-role-readable for protected moderation.
- The creation RPC rejects every retired enum value, and type is immutable.
- Reactions enforce exactly `❤️`, `😂`, `🥹`, `🔥`, `👏` at the DB boundary.
- Reaction `mark_id` and `user_id` are immutable; only the emoji may change. Self-delete
  remains possible after access loss, while insert/update require current Mark access and an
  author-aware bilateral block check.

### Public-media cutover and launch truth

- Inventory and copy legacy Mark objects to private storage, verify checksums/access, deploy
  dual-read, null old DB URLs, delete public originals, purge/wait for CDN cache expiry, and
  prove the old URL fails unauthenticated before claiming protection.
- Rollback never republishes private media.
- PostgreSQL can validate object MIME/size but not trustworthy duration. Photo can be enabled
  after private-media verification; Voice/Video remain feature-flagged off for public launch
  until a trusted server-side inspector verifies ≤60s/≤30s duration.

### RPC security and non-enumeration

- Capability responses for missing, private-inaccessible, blocked, deleted and deactivated
  Walls are identical `unavailable` responses; they never reveal target existence or block state.
- Every SECURITY DEFINER function uses `auth.uid()`, null/active checks, qualified objects,
  fixed safe `search_path`, no dynamic SQL, authorization before protected reads, generic
  failure output, revoked PUBLIC execution and the narrowest required grant.
- New tests must include direct-write/media bypass, Wall-type flip, identity reassignment,
  blocked roster/search/Anonymous reaction, invalid emoji, legacy reads/realtime, concurrent
  finalization, upload reuse, partial rollback, orphan cleanup, old public URL invalidation and
  SECURITY DEFINER search-path/invocation attacks.

### Trusted photo sanitization

- Client MIME, filename, extension and Storage metadata are never treated as proof of content.
- A trusted server-side worker reads each staged private object, verifies magic bytes, fully
  decodes it, rejects malformed/truncated/polyglot/animated/decompression-bomb content, enforces
  ≤6 MB input, ≤8,192 px per edge and ≤25 megapixels, normalizes orientation/color, strips
  EXIF/GPS/comments/thumbnails/private metadata and writes a server-controlled JPEG/WebP derivative.
- Only the sanitized derivative receives trusted dimensions, format, byte size and checksum and
  a `validated` state. `create_mark` accepts only validated upload IDs and never serves/reuses
  the original; the original is deleted after successful validation.
- Unsupported formats such as HEIC fail closed unless the trusted decoder supports them.
- Photo Marks, like Voice/Video, remain feature-flagged off for public launch until their trusted
  processor and adversarial/device QA pass.
- Tests cover false MIME/extension, corrupt/polyglot/animated images, pixel bombs, metadata
  removal, orientation, pre-validation finalization, original-path reuse and unauthorized reads.

### Atomic block cleanup and non-restoration

- Block creation and all cleanup occur in one transaction with no swallowed errors. Any cleanup
  failure rolls back the block and every partial deletion.
- Symmetric cleanup removes accepted/pending friendships, follows both directions, approved-writer
  grants across the pair's Personal Walls, pending direct Shared invitations, prohibited pairwise
  reactions and direct/protected-origin Alerts. Accepted Shared membership remains intact.
- This consolidates/replaces the existing follow-only cleanup rather than adding competing triggers.
- Unblocking deletes only the block row and never restores any relationship, request, permission,
  invitation, reaction or Alert; every future relationship requires a fresh normal action.
- Tests cover both block directions, complete same-transaction cleanup, forced rollback,
  unblock non-restoration and concurrent block/relationship creation.

### Anonymous Alert provenance without identity leakage

- Add a private `notification_origins(notification_id, true_actor_id, created_at)` side table with
  RLS, no app policies/grants and no Realtime publication.
- Public Anonymous Alerts keep `actor_id = NULL`. Their true origin is written atomically only by
  the protected Mark/notification path after Anonymous authorship is durably recorded.
- The protected writer resolves the true author, checks the bilateral block before insert, and
  creates neither notification nor origin when blocked. No identifier enters public payloads,
  metadata, analytics, logs or timing-dependent results.
- Later block cleanup resolves Anonymous origins inside the protected function and deletes the
  corresponding Alerts; cascade removes origin rows. Unblocking never recreates them.
- Tests cover block-before and block-after in both directions, Anonymous + Secret non-leakage,
  atomic failure rollback, app-role denial on the side table and identical external no-Alert behavior.

### Safe Mark-creation cutover sequence

The protected-media replacement must exist before direct Mark creation is revoked:

1. `0018_p0_authorization_core.sql` implements view/block/reaction/contribution/immutability/
   canonical-read hardening and immediately closes the legacy public-media path. During the
   compatibility phase it permits direct inserts only for canonical text Marks with both
   `media_url` and `payload` null; it rejects direct photo/voice/video inserts and any media
   field/payload, and denies new `attachments/marks/*` uploads.
2. `0019_disable_excluded_surfaces.sql` independently disables comments/polls.
3. `0020_mark_media_foundation.sql` additively creates private staging, `media_uploads`,
   `mark_media`, validation state and canonical `create_mark`, without revocation.
4. A migrated client sends every text/photo/voice/video Mark through `create_mark`; media uses
   the private staged path and no client writes legacy media fields.
5. After staging verification, `0021_mark_creation_cutover.sql` revokes direct Mark insert and
   `mark_media` writes, disables `attachments/marks/*`, enforces null legacy fields and makes
   the RPC the sole runtime creation path.

A1/B/C1 are source-review units, not standalone public-feature releases. From A1 onward, old
clients fail closed for media while text remains usable. Media is re-enabled only through the
verified private RPC client after C1, and direct Mark insertion is fully revoked at C2. No
production window may continue creating private-Wall media through public URLs. Adversarial
tests replay the exact old-client upload plus `marks.media_url` insert shape at A1, C1 and C2;
every phase must reject it without creating an object, Mark or Alert.

### Race-free bilateral blocking

- Add a protected `lock_user_pair(a,b)` using a deterministic sorted-UUID transaction advisory
  lock. It has fixed safe search path, qualified objects and no app-role execution.
- Block insert/delete, friendship create/accept, follow, approved-writer grant, Shared invite/
  accept, reaction insert/update and Alert creation acquire the same pair lock and recheck the
  bilateral block after acquiring it.
- Block cleanup occurs in the same transaction after the block row is inserted and removes every
  prohibited relationship listed above; any cleanup failure rolls back the block.
- All notification triggers use one protected `write_notification(...)` function that locks the
  true actor/recipient pair, rechecks block, then atomically writes public notification and private
  origin where needed. Direct app notification insert remains revoked.
- If a relationship locks first, the later block deletes it; if block locks first, the later
  relationship recheck fails. Accepted Shared membership committed before block is preserved,
  while a still-pending invitation is removed.
- Two-session tests run both lock orderings for friendship, acceptance, follow, approved writer,
  Shared invite/acceptance, named/Anonymous reactions and named/Anonymous Alerts, plus reverse
  blocks, cleanup rollback and post-unblock non-restoration.

## Product acceptance contract

### Blocking

- A block in either direction denies Personal-Wall viewing, Mark creation, reactions, follows,
  friend requests, approved-writer grants, direct Shared-Wall invitations and direct Alerts.
- Public visibility, cached state and old links never bypass a block.
- Blocking removes friendship, pending requests and follows; unblocking never restores them.
- Accepted Shared-Wall membership is preserved pending the Founder decision below, while
  direct pair actions remain suppressed.

### Reactions

- A signed-in active user may keep one approved reaction on an active Mark only while they
  may view and interact with that Mark.
- Private, blocked, removed, hidden, pending and otherwise inaccessible Marks reject writes.
- Anonymous authorship and Secret content never leak through reactions or Alerts.

### Contribution

- Personal Walls: the owner is always denied ordinary self-posting; eligible non-owners
  follow the Wall's `everyone`, `friends`, `selected` or `nobody` policy and privacy rules.
- Shared Walls: only the owner and accepted members may post. Pending invitees, open-join
  visitors and unrelated public viewers may not post until membership exists.

### Protected media

- Private Personal/Shared Wall media is readable only by a current authorized viewer.
- Access revocation prevents new media access; paths and old public URLs cannot bypass it.
- Upload permission derives from current contribution permission, not mere authentication.
- Secret media remains rejected until a separate one-time media-access design is approved.
- A failed multi-file finalization creates no visible partial Mark or notification.

### Excluded surfaces

- No client may read or mutate comments or poll votes.
- No client may create legacy poll/game/doodle Mark types.
- Historical rows are preserved but hidden unless a later approved retention action changes them.

## Architecture packages

### Package A — Canonical authorization

Proposed additive migration: `0018_p0_authorization_contract.sql`.

- Make `can_view_wall` the single Personal-Wall visibility boundary, including bilateral block.
- Rebuild Wall/Mark read policies against that helper to prevent policy drift.
- Add `can_react_to_mark(mark_id, uid)` and use it for reaction insert/update.
- Keep self-owned reaction delete available after access loss; prohibit identity reassignment.
- Rewrite `can_contribute` by Wall type:
  - Personal: active non-owner plus approved policy/privacy/block conditions.
  - Shared: active owner or accepted member only.
- Add a server-derived `get_wall_capabilities(wall_id)` contract so Frontend does not
  duplicate permission logic.
- Extend block cleanup for pending invitations, relevant reactions and direct Alerts.

### Package B — Disable excluded surfaces

Proposed additive migration: `0019_disable_excluded_surfaces.sql`.

- Revoke client privileges and remove client policies for comments and poll votes.
- Remove comments from Realtime publication.
- Add a server guard permitting only `text`, `photo`, `voice` and `video` Mark types.
- Preserve tables and historical rows for rollback/moderation; do not destructively drop data.

### Package C — Protected Mark media

Separate ADR and proposed additive migration: `0020_mark_media_foundation.sql`.

- Create private `mark-media` storage; stop new `attachments/marks/*` writes.
- Add ordered `mark_media` rows: maximum five photos or one voice/video object.
- Use current Wall/Mark authorization for upload and read access.
- Use short-lived signed URLs; document the revocation window.
- Finalize a Mark and its media metadata in one transaction-backed RPC.
- Validate object existence, path ownership, MIME and byte size server-side.
- Keep `marks.media_url` temporarily for dual-read legacy compatibility.
- Inventory and migrate legacy public media before removing any public original.
- Voice/video container-duration validation requires a separately approved protected worker.

## Required adversarial tests

| Surface | Required suite change |
|---|---|
| Personal contribution | Add `56_personal_contribution_contract.sql`; reverse the obsolete owner-allow assertion in `55_approved_writers.sql`. |
| Shared contribution | Update `70_wall_members.sql` so public non-members may view but never post; add pending/removed/open-join cases. |
| Blocking | Expand `20_blocking.sql` or add `21_blocking_full_boundary.sql` for public/private reads, Marks, reactions, invitations, search and Alerts. |
| Reactions | Add `26_reaction_access.sql` for underlying visibility, status, block and account-state checks. |
| Excluded features | Add `05_excluded_surfaces.sql`; verify comment/poll APIs and retired Mark types fail closed. |
| Notifications | Replace the invalid Personal-owner self-post fixture in `80_notifications.sql`; add blocked suppression/non-leakage. |
| Storage | Rewrite `50_storage.sql`; add `51_private_mark_media.sql` plus hosted signed-URL, expiry, MIME, size and revocation tests. |

The full existing security suite must remain green. High-risk approvals bind to the exact
commit/migration version and are invalidated by relevant changes.

## Compatibility and rollback

- Use additive forward migrations only; do not drop current tables/columns in P0.
- Feature-flag the new media writer; readers dual-read new rows then legacy `media_url`.
- Old clients fail closed on tightened authorization. A minimum-version gate may be required
  before hosted enforcement.
- Authorization rollback uses a new forward migration restoring prior functions/policies.
- Media UI rollback disables the flag; private objects remain private.
- No historical content is hidden, moved or deleted without a production inventory and
  explicit Founder disposition.

## Entry gates

Before implementation:

1. Founder approves the protected P0 authorization/schema/storage package.
2. Founder chooses the blocked-co-member behavior below.
3. Independent architecture/design review approves this plan.

Before hosted deployment:

1. Read-only production inventory of legacy/invalid rows and public media.
2. Independent Reviewer approval and QA/Security Pass on the exact commit.
3. Local clean apply/upgrade plus full adversarial suite.
4. Hosted staging RLS, Storage, Realtime and signed-URL verification.
5. Separate Founder approval for migrations, bucket changes, jobs and public-media cleanup.

## Founder decision required now

**Blocked users who remain members of the same Shared Wall.**

Recommended policy: preserve accepted membership and existing group content, but hide direct
profiles and prohibit pair-specific reactions, invitations and direct Alerts. This protects
the bilateral block without damaging the Shared Wall for everyone else.

Historical invalid content, if any, should be quarantined/archived reversibly first; no
destructive cleanup is included in this plan.

## Confidence

- **Verified:** The six gaps and stale test assertions were inspected in the current tree.
- **Believed-likely:** The additive package corrects the approved contracts without a broad rewrite.
- **Inferred:** Production legacy-content counts are zero until a hosted inventory proves it.
