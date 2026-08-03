# 09 · Definition of Done

A feature/screen is **done** only when all of the following are true.

## Hard gates (enforced every slice)
- [ ] **Product requirements met** — matches `01_Product_Spec` intent
- [ ] **Acceptance criteria pass** — every ✓ in `03_` for this feature
- [ ] **Edge & error states handled** — the relevant rows in `04_`
      (loading, empty, offline, permission-denied, failed, retry)
- [ ] **RLS enforced** — no cross-user read/write possible; anonymity preserved
- [ ] **Analytics emitted** — events added to `10_Analytics` and firing
- [ ] **No lint/type errors** (`npm run typecheck`, `expo lint`); **CI green**
- [ ] **Docs updated** — acceptance status, `14_Changelog`, schema notes in `05_`
- [ ] **Linked into navigation** — reachable, with working back/close
- [ ] **Committed** on a feature branch with a clear message + PR
- [ ] **Visual HTML preview + plain-language note sent to the user**, and the
      user has signed off before starting the next slice

## Verified later on-device (not blocking a slice in the CI-less dev env)
These are **documented now, validated during the ship phase** (`G` in `07_`),
because they need a real device / running app:
- [ ] **Automated tests** pass (unit for `lib/*`, component/e2e where feasible)
- [ ] **Performance budgets** met (`11_Performance`)
- [ ] **Security hardening** in place (`12_Security`: rate limits, filters,
      media validation)

## Release-level DoD (before store submission)
- [ ] All V1 acceptance criteria pass on a physical device (iOS + Android)
- [ ] Crash-free target met; performance budgets met
- [ ] Security review passed; privacy policy + store metadata ready
- [ ] `13_Release_Checklist` fully checked
