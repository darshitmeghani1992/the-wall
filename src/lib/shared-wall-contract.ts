export const SHARED_WALL_SEARCH_MAX_LENGTH = 60;

export type SharedWallJoinState =
  | "owner"
  | "member"
  | "invited"
  | "owner_approval_required"
  | "joinable"
  | "invite_required";

export type SharedWallCapabilitiesContract = Readonly<{
  status: "available";
  wallType: "shared";
  isOwner: boolean;
  canView: true;
  canContribute: boolean;
  canJoin: boolean;
  joinState: SharedWallJoinState;
}>;

export type SharedWallActionStatus =
  | "joined"
  | "already_member"
  | "invited"
  | "already_invited"
  | "accepted"
  | "declined"
  | "removed"
  | "revoked"
  | "left"
  | "owner_action_required"
  | "deleted"
  | "confirmation_mismatch"
  | "unavailable";

export type SharedWallActionResult = Readonly<{
  status: SharedWallActionStatus;
  wallId?: string;
}>;

export type SharedWallSettingsResult =
  | Readonly<{
      status: "updated";
      wallId: string;
      name: string;
      visibility: "public" | "private";
      openJoin: boolean;
      allowAnonymous: boolean;
    }>
  | Readonly<{ status: "invalid_input" | "unavailable" }>;

export type PendingSharedWallInvite =
  | Readonly<{
      status: "available";
      wallId: string;
      wallName: string;
      visibility: "public" | "private";
      ownerDisplayName: string;
    }>
  | Readonly<{ status: "unavailable" }>;

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function parseSharedWallCapabilities(value: unknown): SharedWallCapabilitiesContract | null {
  const row = object(value);
  if (!row) return null;
  if (row.status === "unavailable") {
    if (!exactKeys(row, ["status"])) throw new Error("The Shared Wall capability response wasn't valid.");
    return null;
  }
  const states: readonly SharedWallJoinState[] = [
    "owner", "member", "invited", "owner_approval_required", "joinable", "invite_required",
  ];
  if (
    row.status !== "available"
    || row.wall_type !== "shared"
    || typeof row.is_owner !== "boolean"
    || row.can_view !== true
    || typeof row.can_contribute !== "boolean"
    || typeof row.can_join !== "boolean"
    || !states.includes(row.join_state as SharedWallJoinState)
    || row.can_join !== (row.join_state === "joinable")
    || !exactKeys(row, ["status", "wall_type", "is_owner", "can_view", "can_contribute", "join_state", "can_join"])
  ) {
    throw new Error("The Shared Wall capability response wasn't valid.");
  }
  return {
    status: "available",
    wallType: "shared",
    isOwner: row.is_owner,
    canView: true,
    canContribute: row.can_contribute,
    canJoin: row.can_join,
    joinState: row.join_state as SharedWallJoinState,
  };
}

const ACTION_STATUSES: readonly SharedWallActionStatus[] = [
  "joined", "already_member", "invited", "already_invited", "accepted", "declined",
  "removed", "revoked", "left", "owner_action_required", "deleted",
  "confirmation_mismatch", "unavailable",
];

export function parseSharedWallAction(value: unknown, requestedWallId: string): SharedWallActionResult {
  const row = object(value);
  if (!row || !ACTION_STATUSES.includes(row.status as SharedWallActionStatus)) {
    throw new Error("The Shared Wall action response wasn't valid.");
  }
  const status = row.status as SharedWallActionStatus;
  if (status === "unavailable") {
    if (!exactKeys(row, ["status"])) throw new Error("The Shared Wall action response wasn't valid.");
    return { status };
  }
  const wallId = text(row.wall_id);
  if (!wallId || !exactKeys(row, ["status", "wall_id"])) {
    throw new Error("The Shared Wall action response wasn't valid.");
  }
  if (wallId !== requestedWallId) throw new Error("The Shared Wall action response didn't match the requested Wall.");
  return { status, wallId };
}

export function parseSharedWallSettings(value: unknown, requestedWallId: string): SharedWallSettingsResult {
  const row = object(value);
  if (!row) throw new Error("The Shared Wall settings response wasn't valid.");
  if (row.status === "invalid_input" || row.status === "unavailable") {
    if (!exactKeys(row, ["status"])) throw new Error("The Shared Wall settings response wasn't valid.");
    return { status: row.status };
  }
  if (
    row.status !== "updated"
    || !text(row.wall_id)
    || !text(row.name)
    || (row.visibility !== "public" && row.visibility !== "private")
    || typeof row.open_join !== "boolean"
    || typeof row.allow_anonymous !== "boolean"
    || !exactKeys(row, ["status", "wall_id", "name", "visibility", "open_join", "allow_anonymous"])
  ) throw new Error("The Shared Wall settings response wasn't valid.");
  if (row.wall_id !== requestedWallId) throw new Error("The Shared Wall settings response didn't match the requested Wall.");
  return {
    status: "updated",
    wallId: row.wall_id as string,
    name: row.name as string,
    visibility: row.visibility,
    openJoin: row.open_join,
    allowAnonymous: row.allow_anonymous,
  };
}

export function parsePendingSharedWallInvite(value: unknown, requestedWallId: string): PendingSharedWallInvite {
  const row = object(value);
  if (!row) throw new Error("The Shared Wall invitation response wasn't valid.");
  if (row.status === "unavailable") {
    if (!exactKeys(row, ["status"])) throw new Error("The Shared Wall invitation response wasn't valid.");
    return { status: "unavailable" };
  }
  if (
    row.status !== "available"
    || !text(row.wall_id)
    || !text(row.wall_name)
    || (row.visibility !== "public" && row.visibility !== "private")
    || !text(row.owner_display_name)
    || !exactKeys(row, ["status", "wall_id", "wall_name", "visibility", "owner_display_name"])
  ) throw new Error("The Shared Wall invitation response wasn't valid.");
  if (row.wall_id !== requestedWallId) throw new Error("The Shared Wall invitation response didn't match the requested Wall.");
  return {
    status: "available",
    wallId: row.wall_id as string,
    wallName: row.wall_name as string,
    visibility: row.visibility,
    ownerDisplayName: row.owner_display_name as string,
  };
}

export function normalizeSharedWallSearch(input: string): string {
  return Array.from(input.trim()).slice(0, SHARED_WALL_SEARCH_MAX_LENGTH).join("");
}

export function toSharedWallIlikePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}
