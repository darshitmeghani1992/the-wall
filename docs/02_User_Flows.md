# 02 · User Flows

Step-by-step flows for every screen. Diagrams are Mermaid (render on GitHub).
Routes reference the Expo app under `app/`.

## Legend
- `[Screen]` = a route the user sees
- `{Decision}` = a branch
- `(( ))` = a background/system action (DB write, realtime, notification)

---

## 1. App entry & auth gate

```mermaid
flowchart TD
  A[Open app] --> B[Splash]
  B --> C{Signed in?}
  C -- No --> D[Welcome]
  C -- Yes --> E{Profile exists?}
  E -- No --> F[Profile setup]
  E -- Yes --> G[Home]
```
Implemented in `app/index.tsx` (`useAuth` gate).

## 2. Onboarding (signed-out → ready account)

```mermaid
flowchart TD
  D[Welcome] --> S[Sign in: email code OR Apple/Google]
  S --> V((Verify / OAuth exchange))
  V --> F[Profile setup: handle, name, bio, avatar]
  F --> X((Create profile → DB trigger auto-creates Personal Wall))
  X --> P[Choose whether to find or invite people]
  P --> W[Short walkthrough]
  W --> G[Original deep-link destination, Discover, or My Wall]
```
Legacy `about` and `interests` routes redirect into the approved activation flow.

## 3. Leave a Mark (the core loop — on SOMEONE ELSE'S wall)

The primary action targets another person's wall (see `01 · Core interaction
model`). Two entry points converge on the integrated composer; the target wall is always
chosen *before* writing, never defaulted to self.

```mermaid
flowchart TD
  A[On a friend's wall] --> LM[Leave a Mark button — pre-aimed at THIS wall]
  B[Any screen] --> P[Tap ✚ dock button]
  P --> WHO[Whose wall? pick a friend / search]
  WHO --> C
  LM --> C[Integrated composer]
  C --> WR[Text plus optional Photo, Voice, or Video]
  WR --> MODE[Optional Anonymous and Secret modes]
  MODE --> SUB((Authorize, upload if needed, then create Mark))
  SUB --> RT((Realtime → drops onto the TARGET wall))
  RT --> PU((Create in-app Alert for recipient))
  RT --> WALL[My Wall / target wall shows the new Mark]
```
The dock action opens the people picker; Wall actions open the same composer pre-aimed.

## 4. Secret reveal

```mermaid
flowchart TD
  M[Locked Secret Mark without payload] --> Tap{Recipient chooses reveal}
  Tap --> R((Server authorizes one-time reveal before expiry))
  R --> V[Content visible for the current reveal session]
  R --> C((Secret becomes consumed))
```

## 6. Friend request

```mermaid
flowchart TD
  A[Find/Discover a person] --> B[Friend Wall / profile]
  B --> C[Tap Add friend]
  C --> D((Insert friendship: pending))
  D --> E((Create in-app Alert for addressee))
  E --> F[Addressee: Notifications / Requests]
  F --> G{Accept?}
  G -- Yes --> H((status=accepted)) --> I[Now friends: private walls + friends-only marks unlock]
  G -- No --> J((Delete / ignore))
```

## 7. Moderation (approval + report)

```mermaid
flowchart TD
  subgraph Approval (wall requires approval)
    M1[Non-owner leaves mark] --> P1((status=pending))
    P1 --> Q[Owner: moderation queue]
    Q --> A1{Approve?}
    A1 -- Yes --> V1((status=active → appears))
    A1 -- No --> H1((status=hidden))
  end
  subgraph Report
    M2[Viewer opens a mark] --> R2[Report]
    R2 --> I2((Insert report))
    M2 --> H2[Owner/author: Hide]
  end
```

## 8. In-app Alerts

```mermaid
flowchart TD
  E((Someone reacts, leaves a Mark, or sends a request/invite)) --> N((Insert notification row))
  N --> RT((In-app Alert list and unread state))
  RT --> O[Open Alert] --> DEEP[Route to target or safe fallback]
```

Native push may be added later, but it is not a first-implementation MVP requirement.

## 9. Explicit flow exclusions

Comments, games, and doodles have no MVP flow. Do not create placeholder navigation or dead-end
entries for them.
