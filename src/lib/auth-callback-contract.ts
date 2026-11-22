/**
 * Classify auth deep-link query parameters before any Supabase call.
 *
 * Reject explicit provider failures and malformed/duplicated codes even if a
 * previously signed-in actor has a valid session on this device. A callback
 * without a code may only resume after the caller separately verifies a session.
 */
export type AuthCallbackParameters = Readonly<{
  code?: string | string[];
  error?: string | string[];
  error_code?: string | string[];
  error_description?: string | string[];
}>;

export type AuthCallbackDecision =
  | Readonly<{ kind: "exchange"; code: string }>
  | Readonly<{ kind: "existing_session" }>
  | Readonly<{ kind: "reject" }>;

export function decideAuthCallback(params: AuthCallbackParameters): AuthCallbackDecision {
  // The presence of any error key (including an empty value) means refusal.
  // Never ignore a less common provider error key because a session already exists.
  if (params.error !== undefined ||
    params.error_code !== undefined ||
    params.error_description !== undefined) {
    return { kind: "reject" };
  }
  if (params.code === undefined) return { kind: "existing_session" };
  // Router represents duplicated ?code= parameters as an array.
  // Whitespace and unbounded input are not valid PKCE exchange codes.
  if (typeof params.code !== "string" ||
    params.code.length === 0 ||
    params.code.length > 4096 ||
    params.code.trim() !== params.code) {
    return { kind: "reject" };
  }
  return { kind: "exchange", code: params.code };
}
