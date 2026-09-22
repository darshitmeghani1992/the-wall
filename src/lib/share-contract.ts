import type { MarkType } from "./types";

const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_UUID.test(value);
}

export type MarkShareDestination =
  | { kind: "personal"; ownerId: string }
  | { kind: "shared"; wallId: string };

type ShareableMark = {
  type: MarkType;
  text: string | null;
  secret: boolean;
};

/** Build only focused-Mark routes accepted by the strict deferred-destination parser. */
export function markDeepLink(
  markId: string,
  destination: MarkShareDestination,
): string | null {
  if (!isCanonicalUuid(markId)) return null;
  if (destination.kind === "personal") {
    return isCanonicalUuid(destination.ownerId)
      ? `thewall://person/${destination.ownerId.toLowerCase()}?focusMark=${markId.toLowerCase()}`
      : null;
  }
  return isCanonicalUuid(destination.wallId)
    ? `thewall://shared/${destination.wallId.toLowerCase()}?focusMark=${markId.toLowerCase()}`
    : null;
}

/** Share only non-Secret content; protected media is referenced by Mark ID, never copied as a URL. */
export function isMarkShareable(mark: ShareableMark): boolean {
  if (mark.secret) return false;
  if (mark.type === "text") return Boolean(mark.text?.trim());
  return mark.type === "photo" || mark.type === "voice" || mark.type === "video";
}

/** Human-readable fallback when a protected-media Mark has no shareable text body. */
export function markSharePreview(type: MarkType): string {
  if (type === "voice") return "🎙️ A voice Mark on my Wall";
  if (type === "video") return "🎥 A video Mark on my Wall";
  return "📷 A photo Mark on my Wall";
}
