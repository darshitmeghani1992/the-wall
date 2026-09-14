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
  if (actualActorId !== expectedActorId) throw new Error("Your session changed. Please try again.");
  return actualActorId;
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
