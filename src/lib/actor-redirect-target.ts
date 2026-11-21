/** A deferred root destination is only reusable for the exact authenticated account. */
export type ActorRedirectTarget = Readonly<{ actorId: string; href: string }>;

export function visibleRedirectForActor(
  target: ActorRedirectTarget | null,
  currentActorId: string | null | undefined,
): string | null {
  return currentActorId && target?.actorId === currentActorId ? target.href : null;
}
