/**
 * Read-only, non-PII staging smoke probe. Not a substitute for hosted RLS QA.
 * Must not log API keys, response payloads, auth sessions or user records.
 */
export const requiredChecks = Object.freeze([
  { name: 'auth_health', path: '/auth/v1/health', acceptedStatuses: [200] },
  { name: 'profiles_api', path: '/rest/v1/profiles?select=id&limit=0', acceptedStatuses: [200] },
  { name: 'marks_api', path: '/rest/v1/marks?select=id&limit=0', acceptedStatuses: [200] },
  { name: 'follows_api', path: '/rest/v1/follows?select=followed_id&limit=0', acceptedStatuses: [200] },
]);

export function validatePublicClientConfig(url, key) {
  if (typeof key !== 'string' || !key.trim()) throw new Error('Preview publishable/anon key missing');
  if (typeof url !== 'string' || !url.trim()) throw new Error('Preview Supabase URL missing');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Preview Supabase URL invalid'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Preview Supabase URL must be a plain HTTPS origin');
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error('Preview Supabase URL must not contain an API path');
  }
  return parsed.origin;
}

/**
 * Catch a project/key mix-up before the APK is built. Legacy anon JWTs embed
 * their Supabase project ref and role. This is a consistency check, NOT JWT
 * signature verification; the server still validates every request.
 * Modern sb_publishable_* keys do not embed the project ref and are handled by
 * the live API preflight instead.
 */
export function assertLegacyAnonKeyMatchesOrigin(origin, key) {
  if (!key.startsWith('eyJ')) return;
  const parts = key.split('.');
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) {
    throw new Error('Malformed legacy public key');
  }
  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid legacy public key claims');
  }
  const hostname = new URL(origin).hostname;
  const expectedRef = hostname.endsWith('.supabase.co') ? hostname.slice(0, -'.supabase.co'.length) : null;
  if (!expectedRef || claims?.ref !== expectedRef || claims?.role !== 'anon') {
    throw new Error('Public key belongs to another Supabase project or role');
  }
}

export function classifyResult(check, status, errorCode = '') {
  const ok = check.acceptedStatuses.includes(status);
  let reason = ok ? 'reachable' : 'unexpected_http_status';
  if (!ok && status === 404 && /^PGRST20[0-9]$/.test(errorCode)) reason = 'schema_or_rpc_missing';
  else if (!ok && (status === 401 || status === 403)) reason = 'client_access_denied';
  return { name: check.name, ok, status, reason };
}

export async function verifyStagingBackend({ url, key, fetchImpl = fetch }) {
  const origin = validatePublicClientConfig(url, key);
  const result = [];
  for (const check of requiredChecks) {
    try {
      // Limit=0 on every table request: do not fetch any row contents.
      const response = await fetchImpl(origin + check.path, {
        method: 'GET',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      let errorCode = '';
      if (!check.acceptedStatuses.includes(response.status)) {
        // Read ONLY standardized error codes; never log response bodies.
        try {
          const payload = await response.json();
          if (typeof payload?.code === 'string') errorCode = payload.code;
        } catch { /* Ignore bodies with unexpected encoding. */ }
      }
      result.push(classifyResult(check, response.status, errorCode));
    } catch {
      result.push({ name: check.name, ok: false, status: null, reason: 'network_unreachable' });
    }
  }
  return { ready: result.every((entry) => entry.ok), checks: result };
}
