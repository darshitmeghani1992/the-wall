# 02 · User Flows

Step-by-step flows for every screen. Diagrams are Mermaid (render on GitHub).
Routes reference the Expo app under `app/`.

## Legend
- `[Screen]` = a route the user sees
- `{Decision}` = a branch
- `(( ))` = a background/system action (DB write, realtime, push)

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

## 2. Onboarding (signed-out → on your wall)

```mermaid
flowchart TD
  D[Welcome] --> W[What is a Wall?]
  W --> I[Choose interests]
  I --> S[Sign in: email code OR Apple/Google]
  S --> V((Verify / OAuth exchange))
  V --> F[Profile setup: handle, name, bio, avatar]
  F --> X((Create profile → DB trigger auto-creates Personal Wall))
  X --> G[Home]
```
Routes: `(onboarding)/welcome`, `about`, `interests`, `sign-in`, `profile-setup`.

## 3. Leave a Mark (the core loop)

```mermaid
flowchart TD
  G[Any screen] --> P[Tap ✚ dock button]
  P --> C[Create: choose Mark type]
  C --> T{Type}
  T -- Sticky/Roast/Secret --> WR[Writer: text + color + anonymous + live preview]
  T -- Memory/Photo --> PH[Photo writer: pick/capture + caption]
  T -- Poll --> PB[Poll builder: question + options]
  T -- Award --> AW[Award picker + note]
  T -- Prediction --> PR[Prediction: text + unlock date]
  T -- Doodle --> DO[Doodle canvas]
  WR --> SUB((Submit → insert Mark))
  PH --> SUB
  PB --> SUB
  AW --> SUB
  PR --> SUB
  DO --> UP((Upload image)) --> SUB
  SUB --> RT((Realtime → drops onto wall))
  RT --> PU((Notify wall owner → push))
  RT --> WALL[My Wall / target wall shows the new Mark]
```
`✚` and Create exist; writers are the current build focus (`write/[type]`).

## 4. Secret reveal

```mermaid
flowchart TD
  M[Secret mark: blurred + '🤫 tap to reveal'] --> Tap{Tap}
  Tap --> R[Text revealed]
  R --> Tap2{Tap again} --> M
```
Implemented in `MarkView` (`SecretMark`).

## 5. Prediction lifecycle

```mermaid
flowchart TD
  C[Author writes prediction + unlock date] --> L[🔒 Locked: shows 'unlocks {date}']
  L --> D{Now ≥ unlock date?}
  D -- No --> L
  D -- Yes --> U[🔮 Revealed: text shown]
```

## 6. Friend request

```mermaid
flowchart TD
  A[Find/Discover a person] --> B[Friend Wall / profile]
  B --> C[Tap Add friend]
  C --> D((Insert friendship: pending))
  D --> E((Notify addressee → push))
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

## 8. Notifications → push

```mermaid
flowchart TD
  E((Someone reacts/comments/marks/requests)) --> N((Insert notification row))
  N --> RT((Realtime → in-app badge))
  N --> PUSH((Expo push to recipient's device))
  PUSH --> O[Tap push] --> DEEP[Deep-link to the relevant mark/wall/request]
```

## 9. Games (plugin entry)

```mermaid
flowchart TD
  H[Home / Games] --> R[Game registry lists available games]
  R --> S{Select game}
  S --> E[Game EntryScreen (plugin)]
  E --> PLAY[Play → scoring] --> REW((Reward hooks + analytics))
  REW --> BACK[Back to Home]
```
See games-as-plugins in `06_Tech_Architecture.md`.
