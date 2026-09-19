import { captureDeferredDestinationUrl, deferredSubjectForUserId } from "@/lib/deferred-destination";
import { isAuthCallbackIntent } from "@/lib/deferred-destination-contract";
import { supabase } from "@/lib/supabase";

function authCallbackPath(raw: string): string {
  try {
    const url = new URL(raw);
    return `/auth/callback${url.search}`;
  } catch {
    return "/";
  }
}

/** Expo Router's sole native initial/runtime URL interception boundary. */
export async function redirectSystemPath({ path }: { path: string; initial: boolean }): Promise<string> {
  if (isAuthCallbackIntent(path)) return authCallbackPath(path);
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return "/";
    await captureDeferredDestinationUrl(path, deferredSubjectForUserId(data.session?.user.id));
  } catch {
    // Parsing/session/storage uncertainty is fail-closed; no raw route is exposed.
  }
  return "/";
}
