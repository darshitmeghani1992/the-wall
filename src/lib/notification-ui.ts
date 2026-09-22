export function relativeNotificationTime(iso: string, nowMs = Date.now()): string {
  const createdMs = new Date(iso).getTime();
  if (!Number.isFinite(createdMs)) return "recently";
  const minutes = Math.floor(Math.max(0, nowMs - createdMs) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(createdMs).toLocaleDateString();
}

export function applyNotificationReadReceipts<T extends { id: string; read: boolean }>(
  notifications: readonly T[],
  readIds: readonly string[],
): T[] {
  if (readIds.length === 0) return notifications.slice();
  const ids = new Set(readIds);
  return notifications.map((notification) => (
    ids.has(notification.id) && !notification.read
      ? { ...notification, read: true }
      : notification
  ));
}

export function appendUniqueNotifications<T extends { id: string }>(
  current: readonly T[],
  older: readonly T[],
): T[] {
  const knownIds = new Set(current.map((notification) => notification.id));
  return [...current, ...older.filter((notification) => !knownIds.has(notification.id))];
}
