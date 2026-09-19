export type AccountDeletionSchedule = Readonly<{
  status: "scheduled";
  requestedAt: string;
  purgeAfter: string;
}>;

export type ExpiredAccountDeletion = Readonly<{
  status: "expired";
  requestedAt: string;
  purgeAfter: string;
}>;

export type AccountDeletionRequestResult = AccountDeletionSchedule | Readonly<{
  status: "owner_action_required";
  ownedSharedWallCount: number;
}> | Readonly<{
  status: "invalid_confirmation" | "unavailable";
}>;

export type CurrentAccountDeletion = AccountDeletionSchedule | ExpiredAccountDeletion | Readonly<{
  status: "none";
}>;

export type AccountDeletionStatusLoadState = "loading" | "ready" | "error";

/** Recovery is fail-closed until the server authoritatively confirms a restorable state. */
export function canOfferAccountRecovery(
  loadState: AccountDeletionStatusLoadState,
  deletion: CurrentAccountDeletion | null,
): boolean {
  return loadState === "ready"
    && (deletion?.status === "none" || deletion?.status === "scheduled");
}

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

function parseSchedule<TStatus extends "scheduled" | "expired">(
  value: Record<string, unknown>,
  status: TStatus,
): Readonly<{ status: TStatus; requestedAt: string; purgeAfter: string }> {
  if (!exactKeys(value, ["status", "requested_at", "purge_after"])
    || value.status !== status
    || !validTimestamp(value.requested_at)
    || !validTimestamp(value.purge_after)
    || Date.parse(value.purge_after) <= Date.parse(value.requested_at)) {
    throw new Error("The account-deletion schedule response was invalid.");
  }
  return {
    status,
    requestedAt: value.requested_at,
    purgeAfter: value.purge_after,
  };
}

export function parseAccountDeletionRequest(value: unknown): AccountDeletionRequestResult {
  if (!isRecord(value) || typeof value.status !== "string") {
    throw new Error("The account-deletion response was invalid.");
  }
  if (value.status === "scheduled") return parseSchedule(value, "scheduled");
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
  if (value.status === "scheduled") return parseSchedule(value, "scheduled");
  if (value.status === "expired") return parseSchedule(value, "expired");
  if (value.status === "none" && exactKeys(value, ["status"])) return { status: "none" };
  throw new Error("The account-deletion status response was invalid.");
}

export type CommittedDeletionReconciliation = Readonly<{
  status: "navigated" | "stale" | "refresh_failed";
  cause?: unknown;
}>;

/**
 * Reconcile routing only after the server has committed deletion scheduling.
 * A refresh failure must never be misreported as a failed deletion request.
 */
export async function reconcileCommittedDeletion(deps: Readonly<{
  isCurrent: () => boolean;
  refreshAccountRoute: () => Promise<unknown>;
  navigateToCanonicalGate: () => void;
}>): Promise<CommittedDeletionReconciliation> {
  try {
    await deps.refreshAccountRoute();
  } catch (cause) {
    return deps.isCurrent() ? { status: "refresh_failed", cause } : { status: "stale" };
  }
  if (!deps.isCurrent()) return { status: "stale" };
  deps.navigateToCanonicalGate();
  return { status: "navigated" };
}
