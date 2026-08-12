import { Share } from "react-native";
import { track } from "./analytics";
import type { MarkWithAuthor } from "./marks";

/**
 * Sharing helpers. All links use the handle-based web URL the invite flow
 * already uses (`https://thewall.app/@{handle}`) so behaviour stays consistent.
 *
 * IMPORTANT: Secret Marks are never reproduced in a share sheet — their content
 * is meant only for the recipient. `isMarkShareable` gates that, and callers
 * must respect it. (True server-side privacy for Secrets is still a backend
 * dependency — see the Batch B report — this only avoids leaking the text the
 * client happens to hold.)
 */
const WEB_BASE = "https://thewall.app";

/** The public web link for a wall, by handle. */
export function wallLink(handle?: string | null): string {
  return handle ? `${WEB_BASE}/@${handle}` : WEB_BASE;
}

/** Curiosity-driven "come write on my Wall" share (own Wall / profile). */
export async function shareMyWall(handle?: string | null): Promise<void> {
  const link = wallLink(handle);
  await Share.share({ message: `Leave something on my Wall 👀\n${link}` });
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
  const lines = [
    body ? `“${body}”` : "📷 A memory on my Wall",
    `— ${author}, via The-Wall`,
    wallLink(wallHandle),
  ];
  await Share.share({ message: lines.join("\n") });
  track("Mark Shared", { mark_type: mark.type, is_anonymous: mark.anonymous });
}
