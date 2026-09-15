const BLOCKED_USERS_RESPONSE_ERROR = "The blocked-users response wasn't valid.";
// PostgreSQL's uuid type accepts the full canonical 8-4-4-4-12 shape; do not
// reject a legitimate identifier merely because its version bits are unusual.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/;

export type BlockedUser = Readonly<{
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  blockedAt: string;
}>;

export type BlockedUsersCursor = Readonly<{
  blockedAt: string;
  userId: string;
}>;

export type BlockedUsersResult =
  | Readonly<{
      status: "available";
      items: readonly BlockedUser[];
      nextCursor: BlockedUsersCursor | null;
    }>
  | Readonly<{ status: "invalid_input" | "unavailable" }>;

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function uuid(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === undefined ? 0 : Number(match[8]);
  const offsetMinute = match[9] === undefined ? 0 : Number(match[9]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (
    year === 0
    || month < 1
    || month > 12
    || day < 1
    || day > daysInMonth[month - 1]
    || hour > 23
    || minute > 59
    || second > 59
    || offsetHour > 23
    || offsetMinute > 59
  ) return null;

  // Date.parse is retained only as an instant-range check. Calendar semantics
  // are verified above because JavaScript otherwise normalizes dates such as
  // February 30 into March instead of rejecting an invalid server response.
  return Number.isNaN(Date.parse(value)) ? null : value;
}

function parseCursor(value: unknown): BlockedUsersCursor | null {
  const row = object(value);
  if (!row || !exactKeys(row, ["blocked_at", "user_id"])) {
    throw new Error(BLOCKED_USERS_RESPONSE_ERROR);
  }
  const blockedAt = timestamp(row.blocked_at);
  const userId = uuid(row.user_id);
  if (!blockedAt || !userId) throw new Error(BLOCKED_USERS_RESPONSE_ERROR);
  return { blockedAt, userId };
}

function parseItem(value: unknown): BlockedUser {
  const row = object(value);
  if (!row || !exactKeys(row, ["user_id", "display_name", "handle", "avatar_url", "blocked_at"])) {
    throw new Error(BLOCKED_USERS_RESPONSE_ERROR);
  }
  const userId = uuid(row.user_id);
  const blockedAt = timestamp(row.blocked_at);
  if (
    !userId
    || !blockedAt
    || typeof row.display_name !== "string"
    || typeof row.handle !== "string"
    || (row.avatar_url !== null && typeof row.avatar_url !== "string")
  ) throw new Error(BLOCKED_USERS_RESPONSE_ERROR);
  return {
    userId,
    displayName: row.display_name,
    handle: row.handle,
    avatarUrl: row.avatar_url,
    blockedAt,
  };
}

/** Rejects malformed or expanded server envelopes before Settings consumes them. */
export function parseBlockedUsersResult(value: unknown): BlockedUsersResult {
  const row = object(value);
  if (!row) throw new Error(BLOCKED_USERS_RESPONSE_ERROR);
  if (row.status === "unavailable" || row.status === "invalid_input") {
    if (!exactKeys(row, ["status"])) throw new Error(BLOCKED_USERS_RESPONSE_ERROR);
    return { status: row.status };
  }
  if (
    row.status !== "available"
    || !Array.isArray(row.items)
    || row.items.length > 20
    || !exactKeys(row, ["status", "items", "next_cursor"])
  ) throw new Error(BLOCKED_USERS_RESPONSE_ERROR);

  const items = row.items.map(parseItem);
  const nextCursor = row.next_cursor === null ? null : parseCursor(row.next_cursor);
  if (items.length === 0 && nextCursor !== null) throw new Error(BLOCKED_USERS_RESPONSE_ERROR);
  if (nextCursor !== null) {
    const lastItem = items.at(-1);
    if (
      !lastItem
      || lastItem.blockedAt !== nextCursor.blockedAt
      || lastItem.userId !== nextCursor.userId
    ) throw new Error(BLOCKED_USERS_RESPONSE_ERROR);
  }
  return { status: "available", items, nextCursor };
}
