/** Domain types for "The Wall". Mirrors supabase/migrations/0001_init.sql. */

export type WallType = "personal" | "shared";
export type Visibility = "public" | "private" | "invite_only";
export type ContributionPolicy = "everyone" | "friends" | "selected" | "nobody";

/**
 * Canonical Mark content types (Master Spec §22–§25). Secret and Anonymous are
 * orthogonal MODES (booleans on the Mark), never content types — any content type
 * may be Secret and/or Anonymous. The prototype's sticky/roast/award/poll/doodle/
 * prediction types are retired (§4 excludes games/doodles); the DB enum keeps the
 * legacy values (Postgres can't drop them) but the app only ever uses these four.
 */
export type MarkType = "text" | "photo" | "voice" | "video";

/** Lifecycle for moderation: pending marks await approval when a wall requires it. */
export type MarkStatus = "active" | "pending" | "hidden" | "removed";

export type FriendshipStatus = "pending" | "accepted" | "blocked";

export interface Profile {
  id: string; // = auth.uid()
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  interests: string[] | null;
  // Optional social links (0007). Stored as raw trimmed strings the user entered
  // (a handle or a full URL); null when not provided. World-readable, self-write.
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  x: string | null;
  website: string | null;
  // Account lifecycle (0013). 'deactivated' = recoverable (§82); world-readable so
  // existing Marks still show their author, but discovery/interaction is gated.
  account_status: "active" | "deactivated" | "suspended";
  deactivated_at: string | null;
  /** Protected moderation capability (§53). Never settable by the client. */
  is_admin: boolean;
  created_at: string;
}

export interface Wall {
  id: string;
  owner_id: string;
  type: WallType;
  name: string;
  visibility: Visibility;
  contribution_policy: ContributionPolicy;
  allow_anonymous: boolean;
  require_approval: boolean;
  created_at: string;
}

/**
 * A Mark — the atomic unit of a wall. Heterogeneous by `type`; the shape-varying
 * bits (poll options/votes, award kind, prediction unlock date, doodle strokes)
 * live in `payload` (jsonb).
 */
export interface Mark {
  id: string;
  wall_id: string;
  author_id: string | null; // null when anonymous is surfaced to viewers
  type: MarkType;
  text: string | null;
  color: string | null;
  anonymous: boolean;
  /** Secret MODE: content lives in the RLS-gated `mark_secrets` side table and
   * base `text` is NULL; viewers see a locked shell (Master Spec §27). */
  secret: boolean;
  media_url: string | null;
  payload: MarkPayload | null;
  rotation: number; // persisted tilt in degrees
  pinned: boolean;
  status: MarkStatus;
  created_at: string;
  // Owner-removal accounting (migration 0012 / §33). Optional: only set on removed
  // Marks and absent from client-built literals (e.g. the composer preview).
  removed_by?: string | null;
  removed_at?: string | null;
  removal_reason?: "normal" | "safety" | "moderation" | null;
}

/**
 * Optional content-type-specific metadata stored on `marks.payload` (jsonb).
 * Media Marks use it for things like voice/video duration and photo ordering;
 * kept as an open bag so new metadata never needs a schema change.
 */
export type MarkPayload = Record<string, unknown>;

export interface MarkReaction {
  mark_id: string;
  user_id: string;
  emoji: string;
}

export interface Comment {
  id: string;
  mark_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface Friendship {
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string; // recipient
  actor_id: string | null;
  kind: string; // mark_left | reaction | comment | friend_request | ...
  mark_id: string | null;
  wall_id: string | null;
  read: boolean;
  created_at: string;
}
