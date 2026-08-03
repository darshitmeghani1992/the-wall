# 04 · Edge Cases & Errors

The non-happy paths. Each feature must handle these before it's "done". Grouped
by area; "Intended behavior" is the contract.

## Global states (every screen)
| Case | Intended behavior |
|---|---|
| Loading | Skeleton/spinner in the paper style; never a blank white screen |
| Empty | A friendly empty state with a next action (e.g. "invite your crew") |
| Offline | Show cached data if any; a retry banner; writes queue or fail with a clear message |
| Request failed | Inline error + Retry; never a silent failure |
| Session expired | Re-route to sign-in without losing draft where possible |
| Supabase not configured | Setup notice (dev) rather than a crash |

## Auth & onboarding
| Case | Intended behavior |
|---|---|
| Invalid email | Inline "enter a valid email"; don't send code |
| Wrong/expired OTP | "That code didn't work" + resend option |
| OAuth cancelled | Return to sign-in unchanged; no error toast spam |
| Handle taken (race at submit) | Rejected on insert; surface "that handle is taken" |
| Avatar upload fails | Continue without avatar (letter tile); offer retry later |
| Deleted account re-signup | New profile flow; old data already cascade-deleted |

## Marks (create & render)
| Case | Intended behavior |
|---|---|
| Empty text | Submit disabled/blocked |
| Over max length | Block + counter turns red |
| Not a permitted contributor | Insert blocked by RLS; UI shows "you can't post here" |
| Anonymous on a wall that forbids it | DB trigger raises; UI explains anonymity is off here |
| Require-approval wall | Mark saved as `pending`; author told "sent for approval" |
| Realtime drop misses (flaky net) | Pull-to-refresh reconciles; no duplicates (dedupe by id) |
| Image too large / wrong type | Rejected with size/type message |
| Camera/gallery permission denied | Explain why + link to Settings; allow text-only fallback |
| Upload interrupted | Retry; partial upload discarded |
| Doodle empty | Cannot submit |
| Prediction unlock date in the past | Block; require a future time |
| Poll <2 options or blank option | Block submit |

## Reactions & comments
| Case | Intended behavior |
|---|---|
| Double-tap react | Idempotent (PK on mark+user+emoji); toggles, never duplicates |
| Comment on a mark you can't view | Blocked by RLS |
| Author deletes mark with comments | Comments cascade-delete |

## Friends
| Case | Intended behavior |
|---|---|
| Friend yourself | Blocked (DB check `requester ≠ addressee`) |
| Duplicate request | Idempotent on PK; no second row |
| Request a blocked user (either direction) | Blocked; no notification |
| Accept an already-removed request | No-op with a gentle notice |

## Walls & visibility
| Case | Intended behavior |
|---|---|
| Open a private wall as non-friend | "This wall is private" state, no marks leaked |
| Wall owner blocks a viewer | Viewer loses view/contribute immediately |
| Wall archived (future) | Read-only; no new marks |

## Notifications & push
| Case | Intended behavior |
|---|---|
| Push permission denied | In-app notifications still work; prompt is not nagging |
| Stale deep link (target deleted) | Land on a safe screen with "this is no longer available" |
| Notify self | Never happens (guarded) |

## Abuse / safety (see also `12_Security.md`)
| Case | Intended behavior |
|---|---|
| Rapid-fire mark spam | Rate limited; friendly cooldown message |
| Profanity/slurs | Filtered/flagged per policy |
| Reported content | Surfaced to owner; repeat offenders escalated |
| Storage full / quota | Upload fails gracefully; app stays usable |
