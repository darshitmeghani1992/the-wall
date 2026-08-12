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

/** Can this Mark's content be reproduced in a share sheet? Secrets never can. */
export function isMarkShareable(mark: MarkWithAuthor): boolean {
  if (mark.type === "secret") return false; // recipient-only by intent
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
