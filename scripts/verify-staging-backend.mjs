import { verifyStagingBackend } from './staging-preflight.mjs';

try {
  const outcome = await verifyStagingBackend({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
  for (const check of outcome.checks) {
    console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}: ${check.reason}${check.status ? ` (HTTP ${check.status})` : ''}`);
  }
  console.log(outcome.ready ? 'Staging preflight passed (read-only probes only).' : 'Staging preflight blocked: investigate backend contracts.');
  if (!outcome.ready) process.exitCode = 1;
} catch (error) {
  // Intentionally avoid printing arbitrary errors/URLs that might contain credentials.
  console.error(error instanceof Error ? error.message : 'Staging preflight configuration invalid');
  process.exitCode = 1;
}
