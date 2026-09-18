export type AccountDeletionSchedule = Readonly<{
  status: "scheduled";
  requestedAt: string;
  purgeAfter: string;
}>;

export type AccountDeletionRequestResult = AccountDeletionSchedule | Readonly<{
  status: "owner_action_required";
  ownedSharedWallCount: number;
}> | Readonly<{
  status: "invalid_confirmation" | "unavailable";
}>;

export type CurrentAccountDeletion = AccountDeletionSchedule | Readonly<{
  status: "none";
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function parseSchedule(value: Record<string, unknown>): AccountDeletionSchedule {
  if (!exactKeys(value, ["status", "requested_at", "purge_after"])
    || value.status !== "scheduled"
    || !validTimestamp(value.requested_at)
    || !validTimestamp(value.purge_after)
    || Date.parse(value.purge_after) <= Date.parse(value.requested_at)) {
    throw new Error("The account-deletion schedule response was invalid.");
  }
  return {
    status: "scheduled",
    requestedAt: value.requested_at,
    purgeAfter: value.purge_after,
  };
}

export function parseAccountDeletionRequest(value: unknown): AccountDeletionRequestResult {
  if (!isRecord(value) || typeof value.status !== "string") {
    throw new Error("The account-deletion response was invalid.");
  }
  if (value.status === "scheduled") return parseSchedule(value);
  if (value.status === "owner_action_required") {
    if (!exactKeys(value, ["status", "owned_shared_wall_count"])
      || !Number.isInteger(value.owned_shared_wall_count)
      || (value.owned_shared_wall_count as number) < 1) {
      throw new Error("The account-deletion ownership response was invalid.");
    }
    return {
      status: "owner_action_required",
      ownedSharedWallCount: value.owned_shared_wall_count as number,
    };
  }
  if (value.status === "invalid_confirmation" || value.status === "unavailable") {
    if (!exactKeys(value, ["status"])) {
      throw new Error("The account-deletion response was invalid.");
    }
    return { status: value.status };
  }
  throw new Error("The account-deletion response was invalid.");
}

export function parseCurrentAccountDeletion(value: unknown): CurrentAccountDeletion {
  if (!isRecord(value) || typeof value.status !== "string") {
    throw new Error("The account-deletion status response was invalid.");
  }
  if (value.status === "scheduled") return parseSchedule(value);
  if (value.status === "none" && exactKeys(value, ["status"])) return { status: "none" };
  throw new Error("The account-deletion status response was invalid.");
}
