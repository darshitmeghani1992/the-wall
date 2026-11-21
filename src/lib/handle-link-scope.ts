/** A resolved handle destination belongs to one exact viewer, handle and deferred reference. */
export function handleLinkSubjectKey(
  actorId: string | null | undefined,
  handle: string,
  reference: string | null,
  accountReady: boolean,
): string | null {
  return actorId && accountReady ? JSON.stringify([actorId, handle, reference]) : null;
}

/** A prior viewer/route result must never render or navigate under another subject. */
export function sameHandleLinkSubject(
  captured: string | null | undefined,
  current: string | null,
): boolean {
  return typeof captured === "string" && current !== null && captured === current;
}
