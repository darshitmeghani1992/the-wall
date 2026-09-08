import { supabase } from "./supabase";
import type { Notification } from "./types";
export { notificationRoute } from "./notification-route";

/**
 * In-app notifications — the HONEST read surface over the EXISTING
 * `notifications` table + RLS from 0001_init.sql ("notifications view own" /
 * "notifications update own"). No schema change.
 *
 * There is no client insert policy on this table. Backend triggers populate the
 * supported event kinds; this module never seeds, inserts, or fakes an Alert.
 */

/** A notification joined with its actor's public profile (for the row's avatar/name). */
export type NotificationWithActor = Notification & {
  actor: { id: string; display_name: string; handle: string; avatar_url: string | null } | null;
  wall_type: "personal" | "shared" | null;
  wall_owner_id: string | null;
};

/**
 * List the signed-in user's notifications, newest first, with actor profiles
 * hydrated in one query. RLS already restricts rows to `user_id = auth.uid()`;
 * the explicit `.eq` mirrors that and lets the index do the work.
 */
export async function listNotifications(userId: string): Promise<NotificationWithActor[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const rows = (data ?? []) as Notification[];
  const actorIds = Array.from(
    new Set(rows.map((n) => n.actor_id).filter((id): id is string => Boolean(id))),
  );

  const actors: Record<
    string,
    { id: string; display_name: string; handle: string; avatar_url: string | null }
  > = {};
  if (actorIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, handle, avatar_url")
      .in("id", actorIds);
    for (const p of (profiles ?? []) as (typeof actors)[string][]) actors[p.id] = p;
  }

  const wallIds = Array.from(new Set(rows.map((row) => row.wall_id).filter((id): id is string => Boolean(id))));
  const wallMetadata: Record<string, { type: "personal" | "shared"; ownerId: string }> = {};
  if (wallIds.length) {
    const { data: walls, error: wallsError } = await supabase
      .from("walls")
      .select("id, type, owner_id")
      .in("id", wallIds);
    if (wallsError) throw wallsError;
    for (const wall of (walls ?? []) as { id: string; type: "personal" | "shared"; owner_id: string }[]) {
      wallMetadata[wall.id] = { type: wall.type, ownerId: wall.owner_id };
    }
  }

  return rows.map((notification) => ({
    ...notification,
    actor: notification.actor_id ? actors[notification.actor_id] ?? null : null,
    wall_type: notification.wall_id ? wallMetadata[notification.wall_id]?.type ?? null : null,
    wall_owner_id: notification.wall_id ? wallMetadata[notification.wall_id]?.ownerId ?? null : null,
  }));
}

/** Mark one notification read (RLS: only the recipient can update their own). */
export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

/** Mark every unread notification read (used when the screen opens). */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw error;
}

/**
 * Human-readable summary for a notification row, derived from its `kind` + actor.
 *
 * The cases mirror the currently shipped 0006/0018 trigger vocabulary. Unknown
 * or historical rows degrade without inventing a destination or leaking content.
 */
export function notificationMessage(n: NotificationWithActor): string {
  const who = n.actor?.display_name ?? "Someone";
  switch (n.kind) {
    case "reaction":
      return `${who} reacted to your Mark`;
    case "mark_left":
      return `${who} left a Mark on your Wall`;
    case "friend_request":
      return `${who} sent you a friend request`;
    case "friend_accept":
    case "friend_accepted":
      return `${who} accepted your friend request`;
    case "shared_wall_invite":
      return `${who} invited you to a Shared Wall`;
    case "shared_wall_mark":
      return `${who} left a Mark on a Shared Wall`;
    case "comment":
      return `${who} added activity to a Mark`;
    default:
      return `${who} added new activity`;
  }
}
