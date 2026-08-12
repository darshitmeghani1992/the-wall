/**
 * A tiny in-memory holder for a deep-link target that arrived before the user
 * was authenticated. When someone opens a `thewall://` link to a person's Wall
 * while signed out, the resolver stashes the intended route here, sends them
 * through sign-in / onboarding, and the auth gate (`app/index.tsx`) consumes it
 * afterwards — so the intended Wall isn't lost.
 *
 * Deliberately in-memory (mirrors `onboarding.ts`): it only needs to survive the
 * single app session between "link opened" and "auth finished". It is NOT
 * persisted, so a cold kill mid-sign-in drops it — acceptable for MVP.
 */
let pendingHref: string | null = null;

/** Stash a route href (e.g. "/u/maya") to navigate to once auth completes. */
export function setPendingLink(href: string): void {
  pendingHref = href;
}

/** Read and clear the pending href (single-use). */
export function consumePendingLink(): string | null {
  const href = pendingHref;
  pendingHref = null;
  return href;
}
