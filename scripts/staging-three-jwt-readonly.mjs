#!/usr/bin/env node
/**
 * Read-only, explicitly opted-in staging test with three genuine JWTs.
 * ROLE: BACKEND. This never signs up testers, writes rows, or logs credentials.
 * Requires pre-existing authorized identities, memberships, and private Wall.
 *
 * This is an independent HTTP-boundary test preparation, NOT permission to
 * create identities, disable RLS, change staging, or certify behavioral QA.
 */
import { assertLegacyAnonKeyMatchesOrigin } from './staging-preflight.mjs';

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
  if (jwtClaims(key)?.role !== 'anon') return false;
  // A different project's public anon JWT must never be used for the staging
  // HTTP audit. Apply the same ref/role validation as the EAS/preflight gate.
  try {
    assertLegacyAnonKeyMatchesOrigin(STAGING, key);
    return true;
  } catch {
    return false;
  }
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
  if (!UUID.test(env.TW_PRIVATE_TEXT_MARK_ID || '')) {
    throw new Error('Existing active private text Mark fixture ID required');
  }
  return {
    apiKey: env.TW_STAGING_ANON_KEY,
    wallId: env.TW_PRIVATE_WALL_ID,
    textMarkId: env.TW_PRIVATE_TEXT_MARK_ID,
    actors,
  };
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
  const { actors, wallId, textMarkId, apiKey } = checkedConfig(env);
  const wallUrl = new URL('/rest/v1/walls', STAGING);
  wallUrl.searchParams.set('select', 'id,type,visibility');
  wallUrl.searchParams.set('id', 'eq.' + wallId);
  // Read metadata only, never private Mark text, author identity, or media.
  // Require a genuine active, non-Secret text fixture to prevent an empty
  // database from producing a meaningless privacy PASS.
  const markUrl = new URL('/rest/v1/marks', STAGING);
  markUrl.searchParams.set('select', 'id,wall_id,type,status,secret');
  markUrl.searchParams.set('id', 'eq.' + textMarkId);
  markUrl.searchParams.set('wall_id', 'eq.' + wallId);
  for (const actor of actors) {
    const user = await getJson(fetchImpl, STAGING + '/auth/v1/user', apiKey, actor.jwt);
    if (!user || user.id !== actor.id) {
      throw new Error('Authenticated actor identity mismatch: ' + actor.role);
    }
    const rows = await getJson(fetchImpl, wallUrl.toString(), apiKey, actor.jwt);
    if (!Array.isArray(rows) || rows.length !== actor.expect ||
        (actor.expect === 1 && (rows[0]?.id !== wallId ||
          rows[0]?.type !== 'shared' || rows[0]?.visibility !== 'private'))) {
      throw new Error('Private Shared Wall RLS visibility mismatch: ' + actor.role);
    }
    const marks = await getJson(fetchImpl, markUrl.toString(), apiKey, actor.jwt);
    if (!Array.isArray(marks) || marks.length !== actor.expect ||
        (actor.expect === 1 && (marks[0]?.id !== textMarkId ||
          marks[0]?.wall_id !== wallId || marks[0]?.type !== 'text' ||
          marks[0]?.status !== 'active' || marks[0]?.secret !== false))) {
      throw new Error('Private text Mark RLS visibility mismatch: ' + actor.role);
    }
  }
  // This is an *RLS* verification, not just proof that an HTTP request failed.
  // With the public walls read grant in this beta, an authenticated application
  // key acting as anon must reach PostgREST and receive RLS-filtered [] (200).
  // A 401/403 could come from an invalid/expired API key, gateway, or grant
  // misconfiguration *before* the anon role ever exercises the Wall policy.
  // Treat any such denial as INCONCLUSIVE/NO-GO, not as RLS PASS.
  const anon = await fetchImpl(wallUrl.toString(), {
    method: 'GET',
    redirect: 'error',
    // Modern publishable keys identify the app, not a signed-in user: they
    // are not JWTs and must not be supplied as a Bearer token. Otherwise a
    // gateway's "Invalid JWT" 401 could look like successful private-Wall
    // RLS denial without the anonymous database role ever being exercised.
    // Legacy anon keys are JWTs and retain their original Bearer behavior.
    headers: {
      apikey: apiKey,
      ...(apiKey.startsWith('sb_publishable_') ? {} : { Authorization: 'Bearer ' + apiKey }),
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (anon.status !== 200) {
    throw new Error('Anonymous RLS check inconclusive: expected HTTP 200, got ' + anon.status);
  }
  let rows;
  try {
    rows = await anon.json();
  } catch {
    throw new Error('Malformed anonymous staging HTTP JSON response');
  }
  if (!Array.isArray(rows)) {
    throw new Error('Malformed anonymous staging HTTP JSON response');
  }
  if (rows.length !== 0) {
    throw new Error('Private Shared Wall visible without authentication');
  }
  // The same private text Mark must also be invisible to an anonymous
  // application-key caller. Denial at a gateway is inconclusive here, just
  // as it is for the private Shared Wall above.
  const anonMark = await fetchImpl(markUrl.toString(), {
    method: 'GET',
    redirect: 'error',
    headers: {
      apikey: apiKey,
      ...(apiKey.startsWith('sb_publishable_') ? {} : { Authorization: 'Bearer ' + apiKey }),
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (anonMark.status !== 200) {
    throw new Error('Anonymous text Mark RLS check inconclusive: expected HTTP 200, got ' + anonMark.status);
  }
  let anonymousMarks;
  try {
    anonymousMarks = await anonMark.json();
  } catch {
    throw new Error('Malformed anonymous text Mark HTTP JSON response');
  }
  if (!Array.isArray(anonymousMarks)) {
    throw new Error('Malformed anonymous text Mark HTTP JSON response');
  }
  if (anonymousMarks.length !== 0) {
    throw new Error('Private text Mark visible without authentication');
  }
  return { status: 'PASS', httpRequests: 11, actorCount: 3, readOnly: true };
}

if (process.argv[1]?.endsWith('staging-three-jwt-readonly.mjs')) {
  if (process.argv.length !== 4 ||
      process.argv[2] !== '--staging' || process.argv[3] !== '--read-only') {
    console.error('Requires explicit --staging --read-only arguments');
    process.exitCode = 2;
  } else {
    try {
      const result = await runStagingJwtAudit(process.env);
      console.log('PASS: ' + result.actorCount + ' distinct real JWT identities; private Shared Wall and text Mark RLS GET visibility');
    } catch (error) {
      // Only predefined error strings from this script are printed. Credentials,
      // response bodies, and fetch's arbitrary error cause are never printed.
      const message = error instanceof Error && (
        error.message.startsWith('Authenticated actor identity mismatch:') ||
        error.message.startsWith('Private Shared Wall RLS visibility mismatch:') ||
        error.message.startsWith('Private text Mark RLS visibility mismatch:') ||
        error.message.startsWith('Authenticated staging GET failed with HTTP ') ||
        error.message.startsWith('Three distinct authenticated') ||
        error.message.startsWith('Existing private Shared') ||
        error.message.startsWith('Staging Supabase URL') ||
        error.message.startsWith('Refusing non-staging') ||
        error.message.startsWith('Staging publishable') ||
        error.message.startsWith('Explicit staging-only') ||
        error.message.startsWith('Malformed staging HTTP') ||
        error.message.startsWith('Malformed anonymous staging HTTP') ||
        error.message.startsWith('Private Shared Wall visible without authentication') ||
        error.message.startsWith('Private text Mark visible without authentication') ||
        error.message.startsWith('Existing active private text Mark') ||
        error.message.startsWith('Anonymous text Mark RLS check inconclusive:') ||
        error.message.startsWith('Malformed anonymous text Mark HTTP') ||
        error.message.startsWith('Anonymous RLS check inconclusive:'))
        ? error.message : 'Staging network/runtime error';
      console.error('NO-GO: ' + message);
      process.exitCode = 1;
    }
  }
}
