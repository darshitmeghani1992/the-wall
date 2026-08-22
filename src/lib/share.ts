import { Share } from "react-native";
import { track } from "./analytics";
import type { MarkWithAuthor } from "./marks";

/**
 * Sharing helpers. Shared links use the IMPLEMENTED in-app deep link
 * (`thewall://u/<handle>`), which resolves to the person's Wall for installed
 * users (see `app/u/[handle].tsx`). Universal / HTTPS App Links are DEFERRED in
 * Batch B — the `thewall.app` web destination is NOT verified to serve anything,
 * so we do not put it in front of users. The copy also names the handle so the
 * message still reads meaningfully for anyone without the app installed.
 *
 * IMPORTANT: Secret Marks are never reproduced in a share sheet — their content
 * is meant only for the recipient. `isMarkShareable` gates that, and callers
 * must respect it. (True server-side privacy for Secrets is still a backend
 * dependency — see the Batch B report — this only avoids leaking the text the
 * client happens to hold.)
 */

/**
 * FUTURE destination — the handle-based HTTPS web link. NOT used as a live
 * shared link today: universal App Links (associatedDomains / assetlinks) and a
 * web product that serves `thewall.app/@{handle}` have not shipped. Kept here so
 * the eventual contract is documented in one place; wire it into the share copy
 * only once those land and the URL is verified to resolve.
 */
const FUTURE_WEB_BASE = "https://thewall.app";
export function futureWallWebLink(handle?: string | null): string {
  return handle ? `${FUTURE_WEB_BASE}/@${handle}` : FUTURE_WEB_BASE;
}

/** Custom-scheme deep link for a wall, by handle — resolves in-app when installed. */
export function wallDeepLink(handle?: string | null): string | null {
  return handle ? `thewall://u/${handle}` : null;
}

/** Curiosity-driven "come write on my Wall" share (own Wall / profile). */
export async function shareMyWall(handle?: string | null): Promise<void> {
  const link = wallDeepLink(handle);
  // Name the identity so the message means something even without the app; only
  // append the deep link when we actually have a handle to resolve.
  const message = handle
    ? `Leave something on my Wall 👀 — I'm @${handle} on The Wall\n${link}`
    : "Leave something on my Wall 👀 — find me on The Wall";
  await Share.share({ message });
  track("Wall Shared", { has_handle: Boolean(handle) });
}

/**
 * "Invite friends" to your own Wall. Same deep-link contract as `shareMyWall`
 * (curiosity-first), but tracked as an invite for the growth funnel. Uses the
 * IMPLEMENTED custom-scheme link only — never the deferred HTTPS form.
 */
export async function inviteFriends(handle?: string | null): Promise<void> {
  const link = wallDeepLink(handle);
  const message = handle
    ? `Come leave a Mark on my Wall ✦ I'm @${handle} on The Wall\n${link}`
    : "Come leave a Mark on my Wall ✦ find me on The Wall";
  await Share.share({ message });
  track("Invite Sent", { has_handle: Boolean(handle) });
}

/** Share someone else's Wall (from their Wall screen), by handle. */
export async function sharePersonWall(
  handle?: string | null,
  displayName?: string | null,
): Promise<void> {
  const link = wallDeepLink(handle);
  const name = displayName?.trim() || (handle ? `@${handle}` : "someone");
  const message = handle
    ? `Check out ${name}'s Wall on The Wall 👀\n${link}`
    : `Check out ${name}'s Wall on The Wall 👀`;
  await Share.share({ message });
  track("Wall Shared", { has_handle: Boolean(handle), context: "person" });
}

/**
 * Custom-scheme deep link for a Shared Wall — resolves in-app to
 * `app/shared/[id].tsx` when installed, exactly like the handle link resolves to
 * `app/u/[handle].tsx`. Universal/HTTPS links remain the deferred infra
 * dependency (unverified domain).
 */
export function sharedWallDeepLink(wallId: string): string {
  return `thewall://shared/${wallId}`;
}

/** Share a Shared Wall (curiosity "come see"), tracked as a Wall share. */
export async function shareSharedWall(wallId: string, name: string): Promise<void> {
  const link = sharedWallDeepLink(wallId);
  await Share.share({ message: `Come see "${name}" on The Wall ✦\n${link}` });
  track("Wall Shared", { context: "shared" });
}

/** Invite people to a Shared Wall (growth intent), tracked distinctly. */
export async function inviteToSharedWall(wallId: string, name: string): Promise<void> {
  const link = sharedWallDeepLink(wallId);
  await Share.share({ message: `Join our Shared Wall "${name}" on The Wall ✦ leave your Mark\n${link}` });
  track("Shared Wall Invite Sent", { wall_id: wallId });
}

/** Can this Mark's content be reproduced in a share sheet? Secrets never can. */
export function isMarkShareable(mark: MarkWithAuthor): boolean {
  if (mark.secret) return false; // recipient-only by intent
  return Boolean(mark.text?.trim()) || Boolean(mark.media_url);
}

/**
 * Share a single received Mark as text. Honest fallback for image export
 * (react-native-view-shot is absent — see report). Never includes Secret text.
 */
export async function shareMark(
  mark: MarkWithAuthor,
  wallHandle?: string | null,
): Promise<void> {
  if (!isMarkShareable(mark)) return;
  const author = mark.anonymous ? "Anonymous" : mark.author?.display_name ?? "Someone";
  const body = mark.text?.trim();
  const deepLink = wallDeepLink(wallHandle);
  const lines = [
    body ? `“${body}”` : "📷 A memory on my Wall",
    `— ${author}, via The Wall${wallHandle ? ` (@${wallHandle})` : ""}`,
    // Deep link only when we have a handle; no broken web URL otherwise.
    ...(deepLink ? [deepLink] : []),
  ];
  await Share.share({ message: lines.join("\n") });
  track("Mark Shared", { mark_type: mark.type, is_anonymous: mark.anonymous });
}
