# 10 · Analytics *(living)*

PostHog (`posthog-react-native`). Add each feature's events here **when it ships**
(part of the Definition of Done). Naming: `Object Verb` in Title Case; snake_case
properties.

## Conventions
- Identify users by `profile.id` after sign-in; never send PII beyond handle.
- Every event includes: `wall_id?`, `mark_type?`, `is_anonymous?` where relevant.
- Screen views auto-captured; custom events below capture intent/outcomes.

## Event catalog

| Event | When | Key properties | Status |
|---|---|---|---|
| `App Opened` | cold/warm start | `cold` | ⬜ |
| `Signup Started` | welcome → sign-in | `method` | ⬜ |
| `Signup Completed` | profile created | `interests_count` | ⬜ |
| `Wall Viewed` | wall screen open | `wall_id`, `is_own` | ⬜ |
| `Mark Created` | mark inserted | `mark_type`, `is_anonymous`, `wall_id` | ⬜ (A1+) |
| `Mark Deleted` | author/owner removes | `mark_type` | ⬜ |
| `Mark Reacted` | reaction added | `emoji`, `mark_type` | ⬜ |
| `Comment Added` | comment posted | `mark_type` | ⬜ |
| `Secret Revealed` | tap-to-reveal | — | ⬜ |
| `Invite Sent` | share sheet from InviteCrew | — | ⬜ |
| `Friend Requested` | request sent | — | ⬜ |
| `Friend Added` | request accepted | — | ⬜ |
| `Profile Viewed` | profile/friend wall | `is_own` | ⬜ |
| `Game Started` | plugin entry | `game_id` | ⬜ |
| `Game Finished` | plugin result | `game_id`, `score`, `won` | ⬜ |
| `Push Opened` | notification tap | `kind` | ⬜ |
| `Mark Reported` | report filed | `reason` | ⬜ |

## Funnels & retention (to watch)
- Activation: `App Opened → Signup Completed → Mark Created / Invite Sent`
- Core loop: `Wall Viewed → Mark Created`
- Retention: D1 / D7 / D30 (returning users)

> Update the Status column to ✅ as each event is wired.
