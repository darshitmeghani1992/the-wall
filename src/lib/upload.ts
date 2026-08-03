import { supabase } from "./supabase";

const MAX_PROFILE_IMAGE = 6 * 1024 * 1024; // 6 MB — avatars & mark photos

/**
 * Uploads a local image (from expo-image-picker / camera) to the shared public
 * `attachments` bucket — the same bucket the web app uses — and returns its
 * public URL. React Native has no `File`, so we read the local URI into an
 * ArrayBuffer before handing it to Supabase Storage.
 */
export async function uploadImage(
  localUri: string,
  prefix: string,
  contentType = "image/jpeg",
): Promise<string> {
  const arraybuffer = await fetch(localUri).then((r) => r.arrayBuffer());
  if (arraybuffer.byteLength > MAX_PROFILE_IMAGE) {
    throw new Error("Image too large — max 6MB.");
  }
  const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const path = `${prefix}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("attachments")
    .upload(path, arraybuffer, { contentType, cacheControl: "3600", upsert: false });
  if (error) throw error;

  return supabase.storage.from("attachments").getPublicUrl(path).data.publicUrl;
}
