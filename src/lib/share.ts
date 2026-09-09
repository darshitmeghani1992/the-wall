import { Share } from "react-native";
import { track } from "./analytics";
import type { MarkWithAuthor } from "./marks";

const FUTURE_WEB_BASE = "https://thewall.app";
export function futureWallWebLink(handle?: string | null): string {
  return handle ? `${FUTURE_WEB_BASE}/@${handle}` : FUTURE_WEB_BASE;
}

/** Custom-scheme deep link for a Personal Wall, by handle. */
export function wallDeepLink(handle?: string | null): string | null {
  return handle ? `thewall://u/${handle}` : null;
}

export async function shareMyWall(handle?: string | null): Promise<void> {
  const link = wallDeepLink(handle);
  const message = handle
    ? `Leave something on my Wall 👀 — I'm @${handle} on The Wall\n${link}`
    : "Leave something on my Wall 👀 — find me on The Wall";
  await Share.share({ message });
  track("Wall Shared", { has_handle: Boolean(handle) });
}

export async function inviteFriends(handle?: string | null): Promise<void> {
  const link = wallDeepLink(handle);
  const message = handle
    ? `Come leave a Mark on my Wall ✦ I'm @${handle} on The Wall\n${link}`
    : "Come leave a Mark on my Wall ✦ find me on The Wall";
  await Share.share({ message });
  track("Invite Sent", { has_handle: Boolean(handle) });
}

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

/** Shared links enter through an auth-safe resolver so sign-in never loses the target. */
export function sharedWallDeepLink(wallId: string): string {
  return `thewall://s/${wallId}`;
}

export async function shareSharedWall(wallId: string, name: string): Promise<void> {
  const link = sharedWallDeepLink(wallId);
  await Share.share({ message: `Come see "${name}" on The Wall ✦\n${link}` });
  track("Wall Shared", { context: "shared" });
}

export async function inviteToSharedWall(wallId: string, name: string): Promise<void> {
  const link = sharedWallDeepLink(wallId);
  await Share.share({ message: `Join our Shared Wall "${name}" on The Wall ✦ leave your Mark\n${link}` });
  track("Shared Wall Invite Sent", { wall_id: wallId });
}

export function isMarkShareable(mark: MarkWithAuthor): boolean {
  if (mark.secret) return false;
  return Boolean(mark.text?.trim()) || Boolean(mark.media_url);
}

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
    ...(deepLink ? [deepLink] : []),
  ];
  await Share.share({ message: lines.join("\n") });
  track("Mark Shared", { mark_type: mark.type, is_anonymous: mark.anonymous });
}
