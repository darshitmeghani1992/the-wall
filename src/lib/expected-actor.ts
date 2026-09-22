const ACTOR_CHANGED_MESSAGE = "Your session changed. Please try again.";

/**
 * Binds a delayed client mutation to the account that initiated it. RLS remains
 * the authorization boundary; this guard prevents an account switch from
 * redirecting an otherwise valid mutation to the newly active account.
 */
export function requireExpectedActor(
  expectedActorId: string,
  actualActorId: string | null | undefined,
  signedOutMessage: string,
): string {
  if (!actualActorId) throw new Error(signedOutMessage);
  if (actualActorId !== expectedActorId) throw new Error(ACTOR_CHANGED_MESSAGE);
  return actualActorId;
}

/** Keep the server's actor-binding failure on the same user-facing contract as the client preflight. */
export function mapActorBoundMutationError(cause: unknown): unknown {
  if (
    cause
    && typeof cause === "object"
    && "code" in cause
    && cause.code === "42501"
    && "message" in cause
    && cause.message === "ACTOR_MISMATCH"
  ) {
    return new Error(ACTOR_CHANGED_MESSAGE);
  }
  if (
    cause
    && typeof cause === "object"
    && "code" in cause
    && cause.code === "42501"
    && "message" in cause
    && cause.message === "ACCOUNT_DELETION_EXPIRED"
  ) {
    return new Error("The 30-day recovery window has ended. This account can no longer be restored.");
  }
  return cause;
}

/** Resolve the current actor at the last async boundary before a mutation. */
export async function runExpectedActorMutation<Result>(
  expectedActorId: string,
  signedOutMessage: string,
  getActualActorId: () => Promise<string | null | undefined>,
  mutate: (actorId: string) => Promise<Result>,
): Promise<Result> {
  const actualActorId = await getActualActorId();
  const actorId = requireExpectedActor(expectedActorId, actualActorId, signedOutMessage);
  return mutate(actorId);
}
