import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { identify, track } from '../src/lib/analytics.ts';

const source = readFileSync(new URL('../src/lib/analytics.ts', import.meta.url), 'utf8');

test('optional private-beta analytics cannot instantiate or import a tracking client', () => {
  // An EAS environment can contain a stale public analytics key. No key or
  // runtime override may cause collection before Founder privacy approval.
  assert.doesNotMatch(source, /posthog-react-native|new\s+PostHog\s*\(/i);
  assert.doesNotMatch(source, /EXPO_PUBLIC_POSTHOG_KEY|process\.env\./);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|\.capture\s*\(|\.identify\s*\(/);
});

test('existing Mark, sharing and session callers retain safe no-op signatures', () => {
  assert.equal(track('Invite Sent', { has_handle: true }), undefined);
  assert.equal(track('Mark Created', { is_anonymous: true, mark_type: 'text' }), undefined);
  assert.equal(identify('local-test-actor', { has_handle: false }), undefined);
  assert.equal(track('Empty', undefined), undefined);
  assert.equal(identify(''), undefined);
});
