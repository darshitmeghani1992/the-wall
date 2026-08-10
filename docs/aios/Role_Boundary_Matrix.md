# Role Boundary Matrix

**Status:** Living document — the canonical Role Boundary Matrix referenced by AIOS Role Design Framework v1.0 (§7).
**Owner:** Architect (per Founder decision, RDF v1.0 §7.3).
**Composition:** Built from the Role Boundary Matrix entries defined within ratified AIOS Role Charters, consolidated into a single canonical table. Updated whenever a future ratified Role adds new entries or an ownership transfer occurs.
**Last Consolidated:** 2026-08-06

---

## Matrix

| Domain / Responsibility | Owning Role | Boundary Notes | Source | Ownership History |
|---|---|---|---|---|
| UI implementation (components, screens, navigation) | Frontend | Implements Product's journey and Backend's actual API; never invents experience or redesigns contract | Frontend Charter §4 | — |
| Component architecture & client-side state | Frontend | Within Architect's server/client state boundary (Architect Playbook §13) | Frontend Charter §4 | — |
| Visual design authority (color, typography, layout, motion, design tokens) | Frontend | **Provisional** — inherited from Product; will transfer again to a future Design Role | Product Charter §4 → Frontend Charter §4 | Product (2026-08-06) → Frontend (2026-08-06, pending ratification) |
| Accessibility implementation | Frontend | Default implementation posture, not a checklist item. Distinct from, and complementary to, System-level accessibility verification (QA), below. | Frontend Charter §4 | — |
| Component / unit / visual-regression testing | Frontend | QA owns end-to-end, exploratory, cross-feature, and device/environment testing instead — see below. | Frontend Charter §4 | — |
| Microcopy implementation | Frontend | Implementation only; Experience Principles remain Product's | Frontend Charter §4 | — |
| Independent code-level review before merge | Reviewer | Distinct from Architect's architectural-fit review and QA's system-level testing; scope extends automatically to any future code-producing Role | Reviewer Charter §4 | — |
| Confidence Audit of self-reported Verified / Believed-likely / Inferred claims | Reviewer | Backend and Frontend self-report; Reviewer independently verifies, including the authoring Role's own Two-Key classification | Reviewer Charter §5 | — |
| Review Pattern Log | Reviewer | Feeds Architect's Technical Debt Register and other Roles' Continuous Improvement Logs — not a parallel system | Reviewer Charter §5 | — |
| Merge execution | Unassigned — governed by Template §7 universal restricted-permissions floor | Reviewer's Approve (and QA's Pass) are necessary, not sufficient; Founder executes manually until DevOps is chartered | Reviewer Charter §4 | — |
| Reviewer → Architect inbound collaboration (architectural-fit flags, Technical Debt Register contributions) | Reviewer flags; Architect receives | Postdates Architect's own ratified Charter, which does not yet list Reviewer as an inbound Role — recorded here rather than by reopening Architect's frozen Charter. See Documented Gaps, below. | Reviewer Charter §11 | — |
| End-to-end, cross-feature, exploratory, and device/environment testing | QA | Distinct from Reviewer's code-level review and Backend's/Frontend's unit/integration tests | QA Charter §4 | — |
| System-level accessibility verification | QA | Independently confirms Frontend's own accessibility claims, not trusted at face value. Distinct from, and complementary to, Accessibility implementation (Frontend), above. | QA Charter §5 | — |
| Regression suite maintenance | QA | Test code, not a governance artifact; no new AIOS-wide register created | QA Charter §5 | — |
| QA's own test automation code | Subject to Reviewer's existing scope | Covered automatically by Reviewer's generalized "any code-producing Role" language (Reviewer Charter §4) — no change to Reviewer's Charter required | QA Charter §7 | — |

---

## Documented Gaps

Reported per consolidation instruction, not resolved here.

- **Reviewer → Architect inbound collaboration is one-directional as currently documented.** Reviewer's Charter (§11) establishes that Reviewer flags architectural-fit concerns and Technical Debt Register contributions to Architect. Architect's own ratified Charter does not list Reviewer as an inbound Role in its Collaboration Rules. This was identified and deliberately left unresolved during Reviewer's governance review chain, to avoid reopening Architect's frozen Charter; it is carried forward here as an open item rather than silently reconciled.
