import { supabase } from "./supabase";
import type { Notification } from "./types";

/**
 * In-app notifications — the HONEST read surface over the EXISTING
 * `notifications` table + RLS from 0001_init.sql ("notifications view own" /
 * "notifications update own"). No schema change.
 *
 * IMPORTANT (C2 dependency): there is NO client insert policy on this table —
 * rows are meant to be POPULATED BY BACKEND TRIGGERS that do not exist yet
 * (reaction→author, mark-left, comment, friend-request, shared-wall-invite …).
 * Until those ship this list is legitimately EMPTY for everyone. That is correct
 * behaviour, not a bug: this module never seeds, inserts, or fakes a
 * notification, so the empty state is truthful.
 */

/** A notification joined with its actor's public profile (for the row's avatar/name). */
export type NotificationWithActor = Notification & {
  actor: { id: string; display_name: string; handle: string; avatar_url: string | null } | null;
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

  return rows.map((n) => ({ ...n, actor: n.actor_id ? actors[n.actor_id] ?? null : null }));
}

/** How many of the user's notifications are unread — powers the entry-point badge. */
export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw error;
  return count ?? 0;
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
 * NOTE: the exact `kind` vocabulary is owned by the C2 backend triggers that will
 * populate this table and is NOT yet finalized in the schema (the column is plain
 * `text`). The mapping below is a FORWARD CONTRACT keyed on the kinds we expect;
 * it degrades to a generic line for anything unrecognized rather than guessing
 * wrongly. Confirm/adjust these keys when the C2 triggers land.
 */
export function notificationMessage(n: NotificationWithActor): string {
  const who = n.actor?.display_name ?? "Someone";
  switch (n.kind) {
    case "reaction":
      return `${who} reacted to your Mark`;
    case "mark":
    case "mark_left":
      return `${who} left a Mark on your Wall`;
    case "comment":
      return `${who} commented on your Mark`;
    case "friend_request":
      return `${who} sent you a friend request`;
    case "friend_accept":
    case "friend_accepted":
      return `${who} accepted your friend request`;
    case "shared_wall_invite":
      return `${who} invited you to a Shared Wall`;
    case "shared_wall_mark":
      return `${who} left a Mark on a Shared Wall`;
    default:
      return `${who} did something on The Wall`;
  }
}

/**
 * Where tapping a notification should route. Uses the row's kind + mark_id /
 * wall_id / actor_id. Same forward-contract caveat as `notificationMessage`:
 * routes fall back to the user's own Wall when a kind is unrecognized, never to a
 * broken or invented destination.
 */
export function notificationRoute(n: NotificationWithActor): string {
  switch (n.kind) {
    case "friend_request":
      return "/(tabs)/discover";
    case "friend_accept":
    case "friend_accepted":
      return n.actor_id ? `/person/${n.actor_id}` : "/(tabs)/discover";
    case "shared_wall_invite":
    case "shared_wall_mark":
      return n.wall_id ? `/shared/${n.wall_id}` : "/(tabs)/walls";
    case "reaction":
    case "mark":
    case "mark_left":
    case "comment":
    default:
      // These are about activity on the user's OWN Wall → open it.
      return "/wall";
  }
}
