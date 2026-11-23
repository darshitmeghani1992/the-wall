import type { DeferredAttemptToken } from "./deferred-destination-contract";

/** Bind a private Shared Wall invitation preview and consent to one viewer and route. */
export function sharedInviteSubjectKey(
  userId: string | null | undefined,
  wallId: string,
  reference: string | null,
  ready: boolean,
): string | null {
  return ready && userId && wallId ? JSON.stringify([userId, wallId, reference]) : null;
}

export function sameSharedInviteSubject(
  captured: string | null | undefined,
  current: string | null,
): boolean {
  return typeof captured === "string" && current !== null && captured === current;
}

/** The startup lease protects arrival. An already reached invitation refreshes with normal authorization. */
export function pendingSharedInviteArrivalToken(
  claimed: DeferredAttemptToken | null,
  arrived: DeferredAttemptToken | null,
): DeferredAttemptToken | null {
  return claimed === arrived ? null : claimed;
}
