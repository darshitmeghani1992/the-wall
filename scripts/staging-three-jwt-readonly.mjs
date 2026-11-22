#!/usr/bin/env node
/**
 * Read-only, explicitly opted-in staging test with three genuine JWTs.
 * ROLE: BACKEND. This never signs up testers, writes rows, or logs credentials.
 * Requires pre-existing authorized identities, memberships, and private Wall.
 *
 * This is an independent HTTP-boundary test preparation, NOT permission to
 * create identities, disable RLS, change staging, or certify behavioral QA.
 */
const STAGING = 'https://ewintxgdxdvschiqodkq.supabase.co';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const STAGING_ISSUER = STAGING + '/auth/v1';

// Decoding claims is only a local fail-closed sanity check, NOT signature
// verification. /auth/v1/user still verifies each token on the staging server.
function jwtClaims(token) {
  if (typeof token !== 'string' || !TOKEN.test(token)) return null;
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return claims && typeof claims === 'object' && !Array.isArray(claims) ? claims : null;
  } catch {
    return null;
  }
}

function isPublicApiKey(key) {
  if (typeof key !== 'string' || !key || /\s/.test(key)) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  // Legacy Supabase anon keys are JWTs. Never accept a service_role token
  // or a secret key in this RLS audit, even if the network calls look healthy.
  return jwtClaims(key)?.role === 'anon';
}

function isStagingUserJwt(jwt, userId) {
  const claims = jwtClaims(jwt);
  return claims?.role === 'authenticated' &&
    claims.sub === userId &&
    claims.iss === STAGING_ISSUER &&
    (claims.aud === 'authenticated' ||
      (Array.isArray(claims.aud) && claims.aud.includes('authenticated'))) &&
    Number.isSafeInteger(claims.exp) &&
    claims.exp > Math.floor(Date.now() / 1000);
}

function checkedConfig(env) {
  if (env.TW_STAGING_JWT_AUDIT_APPROVED !== 'true') {
    throw new Error('Explicit staging-only read permission not asserted');
  }
  let base;
  try {
    base = new URL(env.TW_STAGING_URL || '');
  } catch {
    throw new Error('Staging Supabase URL missing or invalid');
  }
  if (base.origin !== STAGING || base.pathname !== '/' ||
      base.search || base.hash || base.username || base.password) {
    throw new Error('Refusing non-staging Supabase URL');
  }
  if (!isPublicApiKey(env.TW_STAGING_ANON_KEY)) {
    throw new Error('Staging publishable/anon key required');
  }
  const actors = [
    { role: 'owner', id: env.TW_OWNER_ID, jwt: env.TW_OWNER_JWT, expect: 1 },
    { role: 'member', id: env.TW_MEMBER_ID, jwt: env.TW_MEMBER_JWT, expect: 1 },
    { role: 'outsider', id: env.TW_OUTSIDER_ID, jwt: env.TW_OUTSIDER_JWT, expect: 0 },
  ];
  if (!UUID.test(env.TW_PRIVATE_WALL_ID || '')) {
    throw new Error('Existing private Shared Wall fixture ID required');
  }
  if (new Set(actors.map(a => a.id)).size !== 3 ||
      new Set(actors.map(a => a.jwt)).size !== 3 ||
      actors.some(a => !UUID.test(a.id || '') || !isStagingUserJwt(a.jwt, a.id))) {
    throw new Error('Three distinct authenticated actor IDs/JWTs required');
  }
  return { apiKey: env.TW_STAGING_ANON_KEY, wallId: env.TW_PRIVATE_WALL_ID, actors };
}

async function getJson(fetchImpl, url, apiKey, token) {
  const response = await fetchImpl(url, {
    method: 'GET',
    redirect: 'error',
    headers: { apikey: apiKey, Authorization: 'Bearer ' + token, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  // Never log response body or request headers. 401 is a bad actor credential,
  // not a successful negative access-control test.
  if (response.status !== 200) {
    throw new Error('Authenticated staging GET failed with HTTP ' + response.status);
  }
  try {
    return await response.json();
  } catch {
    throw new Error('Malformed staging HTTP JSON response');
  }
}

export async function runStagingJwtAudit(env, fetchImpl = fetch) {
  const { actors, wallId, apiKey } = checkedConfig(env);
  for (const actor of actors) {
    const user = await getJson(fetchImpl, STAGING + '/auth/v1/user', apiKey, actor.jwt);
    if (!user || user.id !== actor.id) {
      throw new Error('Authenticated actor identity mismatch: ' + actor.role);
    }
    const wallUrl = new URL('/rest/v1/walls', STAGING);
    wallUrl.searchParams.set('select', 'id,type,visibility,owner_id');
    wallUrl.searchParams.set('id', 'eq.' + wallId);
    const rows = await getJson(fetchImpl, wallUrl.toString(), apiKey, actor.jwt);
    if (!Array.isArray(rows) || rows.length !== actor.expect ||
        (actor.expect === 1 && (rows[0]?.id !== wallId ||
          rows[0]?.type !== 'shared' || rows[0]?.visibility !== 'private' ||
          // A permitted friend can see a private Wall too. The owner fixture
          // must actually be the authoritative owner in the returned row.
          rows[0]?.owner_id !== actors[0].id))) {
      throw new Error('Private Shared Wall RLS visibility mismatch: ' + actor.role);
    }
  }
  return { status: 'PASS', httpRequests: 6, actorCount: 3, readOnly: true };
}

if (process.argv[1]?.endsWith('staging-three-jwt-readonly.mjs')) {
  if (process.argv.length !== 4 ||
      process.argv[2] !== '--staging' || process.argv[3] !== '--read-only') {
    console.error('Requires explicit --staging --read-only arguments');
    process.exitCode = 2;
  } else {
    try {
      const result = await runStagingJwtAudit(process.env);
      console.log('PASS: ' + result.actorCount + ' distinct real JWT identities; private Shared Wall GET visibility');
    } catch (error) {
      // Only predefined error strings from this script are printed. Credentials,
      // response bodies, and fetch's arbitrary error cause are never printed.
      const message = error instanceof Error && (
        error.message.startsWith('Authenticated actor identity mismatch:') ||
        error.message.startsWith('Private Shared Wall RLS visibility mismatch:') ||
        error.message.startsWith('Authenticated staging GET failed with HTTP ') ||
        error.message.startsWith('Three distinct authenticated') ||
        error.message.startsWith('Existing private Shared') ||
        error.message.startsWith('Staging Supabase URL') ||
        error.message.startsWith('Refusing non-staging') ||
        error.message.startsWith('Staging publishable') ||
        error.message.startsWith('Explicit staging-only') ||
        error.message.startsWith('Malformed staging HTTP'))
        ? error.message : 'Staging network/runtime error';
      console.error('NO-GO: ' + message);
      process.exitCode = 1;
    }
  }
}
