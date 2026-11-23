import { Share } from "react-native";
import { track } from "./analytics";
import type { MarkWithAuthor } from "./marks";
import {
  isMarkShareable,
  personalWallDeepLink,
  markDeepLink,
  markSharePreview,
  sharedWallDeepLink,
  type MarkShareDestination,
} from "./share-contract";

export { isMarkShareable, markDeepLink, sharedWallDeepLink, type MarkShareDestination } from "./share-contract";

/**
 * Sharing helpers use only installed-app custom-scheme routes. Universal HTTPS
 * links and store fallback are still unverified, so the future web URL is never
 * placed in live share copy. Secret Mark content is never reproduced here.
 */
const FUTURE_WEB_BASE = "https://thewall.app";
export function futureWallWebLink(handle?: string | null): string {
  return handle ? `${FUTURE_WEB_BASE}/@${handle}` : FUTURE_WEB_BASE;
}

/** Custom-scheme deep link for a Personal Wall, by handle. */
export function wallDeepLink(handle?: string | null): string | null {
  return personalWallDeepLink(handle);
}

export async function shareMyWall(handle?: string | null): Promise<void> {
  const link = wallDeepLink(handle);
  const safeHandle = link?.slice("thewall://u/".length);
  const message = safeHandle
    ? `Leave something on my Wall 👀 — I'm @${safeHandle} on The Wall\n${link}`
    : "Leave something on my Wall 👀 — find me on The Wall";
  await Share.share({ message });
  track("Wall Shared", { has_handle: Boolean(safeHandle) });
}

export async function inviteFriends(handle?: string | null): Promise<void> {
  const link = wallDeepLink(handle);
  const safeHandle = link?.slice("thewall://u/".length);
  const message = safeHandle
    ? `Come leave a Mark on my Wall ✦ I'm @${safeHandle} on The Wall\n${link}`
    : "Come leave a Mark on my Wall ✦ find me on The Wall";
  await Share.share({ message });
  track("Invite Sent", { has_handle: Boolean(safeHandle) });
}

export async function sharePersonWall(
  handle?: string | null,
  displayName?: string | null,
): Promise<void> {
  const link = wallDeepLink(handle);
  const safeHandle = link?.slice("thewall://u/".length);
  const name = displayName?.trim() || (safeHandle ? `@${safeHandle}` : "someone");
  const message = safeHandle
    ? `Check out ${name}'s Wall on The Wall 👀\n${link}`
    : `Check out ${name}'s Wall on The Wall 👀`;
  await Share.share({ message });
  track("Wall Shared", { has_handle: Boolean(safeHandle), context: "person" });
}

export async function shareSharedWall(wallId: string, name: string): Promise<void> {
  const link = sharedWallDeepLink(wallId);
  if (!link) throw new Error("Cannot share an invalid Shared Wall link.");
  await Share.share({ message: `Come see "${name}" on The Wall ✦\n${link}` });
  track("Wall Shared", { context: "shared" });
}

/**
 * Compatibility entry point for the older client. A share-sheet link is
 * view-only; actual membership invitations remain registered-user RPC actions.
 */
export async function inviteToSharedWall(wallId: string, name: string): Promise<void> {
  await shareSharedWall(wallId, name);
}

export async function shareMark(
  mark: MarkWithAuthor,
  wallHandle?: string | null,
  destination?: MarkShareDestination,
): Promise<void> {
  if (!isMarkShareable(mark) || !destination) return;
  const deepLink = markDeepLink(mark.id, destination);
  if (!deepLink) return;
  const author = mark.anonymous ? "Anonymous" : mark.author?.display_name ?? "Someone";
  const body = mark.text?.trim();
  const lines = [
    body ? `“${body}”` : markSharePreview(mark.type),
    `— ${author}, via The Wall${wallHandle ? ` (@${wallHandle})` : ""}`,
    deepLink,
  ];
  await Share.share({ message: lines.join("\n") });
  track("Mark Shared", { mark_type: mark.type, is_anonymous: mark.anonymous });
}
