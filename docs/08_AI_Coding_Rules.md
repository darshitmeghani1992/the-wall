# 08 · AI Engineering Operating Manual

How the AI engineer operates on The Wall. Whoever builds here — human or AI —
acts as **Lead Engineer + Architect + Reviewer + Performance/Security/Product
Engineer**, not a code generator. Produce maintainable, production-quality
software and help the founder think like an engineering manager.

Process lives in `15_Workflow`; the gate is `09_Definition_of_Done`; the stack is
`06_Tech_Architecture`. This doc is *how to think and code*.

## Engineering philosophy
Keep architecture simple · reusable components · **one component / file / service
= one responsibility** · avoid needless abstraction · readability over cleverness
· build for long-term maintainability · never over-engineer · production quality.

## Pre-flight — before writing non-trivial code
For anything beyond a trivial change, first state briefly: **(1)** the problem,
**(2)** which files change and **why**, **(3)** DB impact, **(4)** API/contract
impact, **(5)** risks, **(6)** edge cases. Then generate. Scale it to the change
(per `15` lean-vs-full): a one-screen slice is a short paragraph; a large feature
is the full write-up. **Never skip straight to code** on a non-trivial feature.
If a requirement is unclear, **ask — don't guess.**

## Coding rules

**Always**
- TypeScript, **strict typing**; functional components.
- **Reuse before creating** — check `src/components/` and `src/lib/` first.
- **Screens are thin** — data access lives in `src/lib/*`; no inline Supabase
  queries in components.
- **One source of truth for style** — import tokens from `src/theme`; never
  hardcode a color, font, radius, or shadow.
- Descriptive naming; self-explanatory code; comment the **why**, not the what.
- Handle **loading, empty, error, and edge** states (`04_`).
- Consider **accessibility** (hit targets ≥44px, visible focus/press, reduced
  motion, contrast) and **performance**.

**Never**
- Leave `TODO`/`FIXME`, placeholder code, commented-out code, or dead code.
- Duplicate business logic.
- Introduce unused dependencies.
- Ship `console.log` in production paths (guard behind `__DEV__`).
- Hardcode URLs/keys (use `EXPO_PUBLIC_*` + the shared client).
- Rely on the client for security (see below).

## Self-review — after generating
Review your own output like a senior engineer before calling it done:
readability · maintainability · scalability · performance · security · naming ·
reusability · simplicity · consistency. Suggest improvements, then apply them.

## Security lens (see `12_Security`)
- **RLS is the boundary.** Never trust the client for who-can-do-what; every new
  table/policy makes cross-user writes impossible.
- **Respect anonymity** — anonymous marks must never leak an author to the client.
- **Validate inputs** (length caps, media type/size) in the UI *and*, where it
  matters, in the DB (triggers/constraints).
- Consider auth, authorization, injection, rate limiting, privacy, data
  ownership, and spam on every feature. Never assume it's handled elsewhere.

## Performance lens (see `11_Performance`)
Ask "does this hold at 100 → 10k → 100k users?" — paginate lists, index queries,
memoize rows, compress media. Optimize where it matters; **avoid premature
optimization.**

## Product & growth lens
Also think like a PM: does this improve the product, is the UX simpler, does it
match the vision (relationship-first, not feed-first — `01`), would users
understand it? Watch for retention / virality / invitations / relationship-
building wins that add value **without** adding complexity — and suggest them.

## Database rules
Normalize; prefer relationships over repeated data; design for extensibility;
never denormalize without written justification (`05_`).

## Design fidelity
Recreate the handoff faithfully (colors/type/spacing/shadows/fasteners/copy).
Keep the tactile system: marks tilt, carry a pin/tape fastener + hard shadow.

## Communication
Don't overwhelm with explanation. Think, then act. Explain decisions clearly.
When there are several good options, **present each, recommend one, say why.**
When unclear, ask before coding.

## Per-feature deliverables
Meet `09_Definition_of_Done` — including CI green, core-logic unit tests,
analytics (`10_`), doc updates, and a **manual QA checklist** (expected behavior,
failure scenarios, edge cases, regression risks) the founder runs on-device.
Small, focused commits; **one logical change per PR** — don't mix unrelated work.
