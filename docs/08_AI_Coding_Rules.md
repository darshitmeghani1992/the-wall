# 08 · AI Coding Rules

Rules every contributor — human or AI — follows on this codebase. They exist to
keep the app consistent and reviewable.

## Reuse & structure
1. **Reuse before you create.** Check `src/components/` and `src/lib/` first; do
   not duplicate a component or query that already exists.
2. **Screens are thin.** Data access lives in `src/lib/*` modules; components/
   screens call those functions — no inline Supabase queries in screens.
3. **One source of truth for style.** Import design tokens from `src/theme`.
   **Never hardcode a color, font family, radius, or shadow** in a screen.
4. **No hardcoded URLs or keys.** Use env (`EXPO_PUBLIC_*`) and the shared client.

## Quality
5. **No `TODO`/`FIXME` left in shipped code** — file it in `07_` backlog instead.
6. **No `console.log` in production paths** — remove or guard behind `__DEV__`.
7. **No type or lint errors** (`npm run typecheck`, `expo lint`).
8. **Keep CI green** — the app must type-check, lint, and build cleanly on the
   branch before it merges.
9. **Comment the *why*, not the *what*.** Match the surrounding style/density.

## Security & data
10. **RLS is the boundary.** Never rely on the client to enforce who-can-do-what;
    every new table/policy is written so cross-user writes are impossible.
11. **Respect anonymity.** Anonymous marks must never leak an author to the client.
12. **Validate inputs** (length caps, media type/size) both in UI and, where it
    matters, in the DB (triggers/constraints).

## Process (per feature = per slice)
13. **Meet the Definition of Done** (`09_`) and the feature's **Acceptance
    Criteria** (`03_`) before calling it done.
14. **Handle the edge/error states** listed in `04_`.
15. **Emit analytics** for the feature (add to `10_`).
16. **Update docs**: acceptance status, `14_Changelog`, and any schema note in `05_`.
17. **Small, reviewable commits** on feature branches with clear messages; open a
    PR per screen/slice per the repo's PR conventions.

## Design fidelity
18. Recreate the handoff faithfully (colors/type/spacing/shadows/fasteners/copy).
19. Keep the tactile system: marks tilt, carry a pin/tape fastener + hard shadow.
20. Accessibility: hit targets ≥44px, visible focus/press states, respect reduced
    motion, sufficient contrast.
