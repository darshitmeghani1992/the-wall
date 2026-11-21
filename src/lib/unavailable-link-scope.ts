/** Bind an unavailable-link acknowledgement to the current viewer and opaque reference. */
export function unavailableLinkSubjectKey(
  actorId: string | null | undefined,
  reference: string | null,
  ready: boolean,
): string | null {
  return actorId && reference && ready ? JSON.stringify([actorId, reference]) : null;
}
