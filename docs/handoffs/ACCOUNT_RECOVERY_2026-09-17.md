# Account Recovery Handoff

**Date:** 2026-09-17  
**Slice:** ACL-001  
**State:** Author-side verified; draft-PR CI pending

## Delivered

- Migration `0029` retires API access to parameterless reactivation and adds an authenticated-only, expected-actor RPC.
- The server checks actor mismatch before profile access, locks the profile, restores only self-deactivated accounts, preserves suspension, and makes successful retries safe.
- The client preflights and propagates the initiating actor and maps the exact server mismatch to a session-changed error.
- Account recovery now fences RPC completion, route refresh, navigation, errors, and busy-state cleanup against account switches and unmounts.
- User-lifecycle invalidation is separate from route-state redirects, allowing a legitimate recovery refresh to finish without weakening stale-session protection.

## Evidence

- TypeScript: pass
- ESLint: pass with zero errors and nine pre-existing warnings
- Client/contract tests: 55/55 pass
- Expo public config: pass
- iOS and Android production exports: pass
- `git diff --check`: pass
- Local PostgreSQL suite: unavailable because `psql` is not installed; draft-PR CI is the required database evidence

## Release boundary

Migration `0029` is source only and has not been applied to hosted Supabase. Draft PR #22 remains unmerged and undeployed. Hosted migration, merge, and deployment require separate authorization.
