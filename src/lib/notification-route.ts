export type NotificationRouteInput = {
  user_id: string;
  kind: string;
  actor_id: string | null;
  mark_id: string | null;
  wall_id: string | null;
  wall_type: "personal" | "shared" | null;
  wall_owner_id: string | null;
};

// Alerts contain DB-origin UUID references, but route builders must not trust
// stale, malformed or externally rehydrated notification metadata.
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID.test(value);
}

function withFocusedMark(path: string, markId: string | null): string {
  return isCanonicalUuid(markId) ? `${path}?focusMark=${encodeURIComponent(markId)}` : path;
}

/** Pure destination contract for every currently shipped Alert kind. */
export function notificationRoute(notification: NotificationRouteInput): string {
  switch (notification.kind) {
    case "friend_request":
      return "/(tabs)/discover?section=friends";
    case "friend_accept":
    case "friend_accepted":
      return isCanonicalUuid(notification.actor_id) ? `/person/${notification.actor_id}` : "/(tabs)/discover";
    case "shared_wall_invite":
      return isCanonicalUuid(notification.wall_id)
        ? `/shared/invite/${notification.wall_id}`
        : "/(tabs)/alerts";
    case "shared_wall_invite_accepted":
    case "shared_wall_ownership_transferred":
      return isCanonicalUuid(notification.wall_id)
        ? `/shared/${notification.wall_id}`
        : "/(tabs)/alerts";
    case "shared_wall_mark":
      return isCanonicalUuid(notification.wall_id)
        ? withFocusedMark(`/shared/${notification.wall_id}`, notification.mark_id)
        : "/(tabs)/alerts";
    case "reaction":
    case "mark_left":
    case "comment":
      if (notification.wall_type === "shared" && isCanonicalUuid(notification.wall_id)) {
        return withFocusedMark(`/shared/${notification.wall_id}`, notification.mark_id);
      }
      if (notification.wall_type !== "personal" || !isCanonicalUuid(notification.wall_owner_id)) {
        return "/(tabs)/alerts";
      }
      if (isCanonicalUuid(notification.user_id) && notification.wall_owner_id === notification.user_id) {
        return withFocusedMark("/(tabs)/home", notification.mark_id);
      }
      return withFocusedMark(`/person/${notification.wall_owner_id}`, notification.mark_id);
    default:
      return "/(tabs)/alerts";
  }
}
