import { supabase } from "./supabase";

/**
 * Per-kind byte caps (client-side abuse safety, Master Spec §108). Server-side
 * bucket limits (allowed_mime_types / file_size_limit on the `attachments`
 * bucket) are a hosted-config hardening task — see docs/BUILD_STATUS.md.
 */
export const MEDIA_LIMITS = {
  image: 6 * 1024 * 1024, // 6 MB — avatars & photo Marks
  audio: 8 * 1024 * 1024, // 8 MB — voice Marks (≤60s)
  video: 40 * 1024 * 1024, // 40 MB — video Marks (≤30s)
} as const;

/** MIME allowlist per media kind (reject anything else before upload). */
const ALLOWED: Record<keyof typeof MEDIA_LIMITS, RegExp> = {
  image: /^image\/(jpe?g|png|heic|webp)$/i,
  audio: /^audio\/(m4a|x-m4a|mp4|aac|mpeg|wav)$/i,
  video: /^video\/(mp4|quicktime|x-m4v)$/i,
};

function extFor(contentType: string): string {
  const sub = contentType.split("/")[1]?.toLowerCase() ?? "bin";
  return sub
    .replace("jpeg", "jpg")
    .replace("x-m4a", "m4a")
    .replace("quicktime", "mov")
    .replace("x-m4v", "m4v")
    .replace("mpeg", "mp3");
}

/**
 * Upload a local media file (photo / voice / video) from a device URI to the
 * shared public `attachments` bucket under `marks/…` (or `avatars/{uid}/…`) and
 * return its public URL. React Native has no `File`, so we read the local URI
 * into an ArrayBuffer first. Path-scoped write + owner-only modify are enforced
 * by storage RLS (migration 0003, verified in tests/50_storage.sql).
 *
 * The base `attachments` bucket is public-read (ADR-006): media URLs are
 * world-readable but unguessable, and are only ever handed to viewers the marks
 * RLS already lets read the owning row. Secret/protected media (signed URLs) is a
 * later slice — Secret Marks are text-only today, so no protected media exists yet.
 */
export async function uploadMedia(
  localUri: string,
  prefix: string,
  contentType: string,
  kind: keyof typeof MEDIA_LIMITS,
): Promise<string> {
  if (!ALLOWED[kind].test(contentType)) {
    throw new Error(`Unsupported ${kind} format.`);
  }
  const arraybuffer = await fetch(localUri).then((r) => r.arrayBuffer());
  if (arraybuffer.byteLength > MEDIA_LIMITS[kind]) {
    const mb = Math.round(MEDIA_LIMITS[kind] / (1024 * 1024));
    throw new Error(`That ${kind} is too large — max ${mb}MB.`);
  }
  const path = `${prefix}/${Date.now()}.${extFor(contentType)}`;

  const { error } = await supabase.storage
    .from("attachments")
    .upload(path, arraybuffer, { contentType, cacheControl: "3600", upsert: false });
  if (error) throw error;

  return supabase.storage.from("attachments").getPublicUrl(path).data.publicUrl;
}

/** Back-compat convenience for image uploads (avatars & photo Marks). */
export async function uploadImage(
  localUri: string,
  prefix: string,
  contentType = "image/jpeg",
): Promise<string> {
  return uploadMedia(localUri, prefix, contentType, "image");
}
