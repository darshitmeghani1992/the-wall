# 09 · Definition of Done

The **single** Definition of Done for The Wall. A feature/screen is done only
when all of the following are true. (Workflow context: `15_Workflow.md`.)

## Hard gates — done by the AI agent, enforced every slice
- [ ] **Product requirements met** — matches `01_Product_Spec` intent
- [ ] **Acceptance criteria pass** — every ✓ in `03_` for this feature
- [ ] **Edge & error states handled** — the relevant rows in `04_`
      (loading, empty, offline, permission-denied, failed, retry)
- [ ] **RLS enforced** — no cross-user read/write possible; anonymity preserved
- [ ] **Analytics emitted** — events added to `10_Analytics` and firing
- [ ] **CI green** — type-check + lint pass on the PR (`.github/workflows/ci.yml`)
- [ ] **Unit tests for core logic** — where the change touches `src/lib/*`
      (mark building, permissions, validation), per the testing policy in `15_`
- [ ] **Docs updated** — acceptance status, `14_Changelog`, schema notes in `05_`
- [ ] **Linked into navigation** — reachable, with working back/close
- [ ] **Committed** on a feature branch with a clear message + PR
- [ ] **Visual preview + plain-language note sent to the founder**

## Founder gate — cleared before merge (needs a running app)
The agent can't run these; the founder does, using what the agent hands over:
- [ ] **Runs on device / Expo Go** (iOS + Android as available)
- [ ] **Manual QA passes** against the feature's `03_` criteria
- [ ] **Database verified** in Supabase (correct rows, relationships, permissions)
- [ ] **Founder sign-off** before the next slice starts

## Deferred to the ship phase (documented now, validated later)
- [ ] **Broader automated tests** (component / Maestro E2E for core loops)
- [ ] **Performance budgets** met (`11_Performance`)
- [ ] **Security hardening** in place (`12_Security`: rate limits, filters,
      media validation)

## Release-level DoD (before store submission)
- [ ] All V1 acceptance criteria pass on a physical device (iOS + Android)
- [ ] Crash-free target met; performance budgets met
- [ ] Security review passed; privacy policy + store metadata ready
- [ ] `13_Release_Checklist` fully checked
