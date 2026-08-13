/** Domain types for "The Wall". Mirrors supabase/migrations/0001_init.sql. */

export type WallType = "personal" | "shared";
export type Visibility = "public" | "private" | "invite_only";
export type ContributionPolicy = "everyone" | "friends" | "selected" | "nobody";

export type MarkType =
  | "sticky"
  | "roast"
  | "secret"
  | "memory"
  | "photo"
  | "award"
  | "poll"
  | "doodle"
  | "prediction";

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
  media_url: string | null;
  payload: MarkPayload | null;
  rotation: number; // persisted tilt in degrees
  pinned: boolean;
  status: MarkStatus;
  created_at: string;
}

/** Type-specific extras stored on `marks.payload`. */
export type MarkPayload =
  | { kind: "poll"; question: string; options: string[] }
  | { kind: "award"; award: string }
  | { kind: "prediction"; unlock_at: string }
  | { kind: "doodle"; width: number; height: number }
  | Record<string, unknown>;

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
