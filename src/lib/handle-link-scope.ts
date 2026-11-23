/** Match only the literal handle, including for older rows with mixed casing. */
export function profileHandleLookupPattern(handle: string): string | null {
  const clean = handle.trim().replace(/^@/, "");
  return /^[a-z0-9_]{3,}$/i.test(clean) ? clean.replace(/_/g, "\\_") : null;
}

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
