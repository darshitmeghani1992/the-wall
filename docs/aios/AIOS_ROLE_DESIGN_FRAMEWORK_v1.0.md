# AIOS Role Design Framework (RDF)

**Document Type:** Process Methodology — not a Role, not a Charter, not a governance layer.
**Version:** v1.0
**Status:** Ratified and Locked
**Governs under:** AIOS Constitution v1.1
**Role Boundary Matrix Owner:** Architect (per Founder decision, 2026-08-06 — may transfer if AIOS later gains a better organizational owner)
**Last Updated:** 2026-08-06

---

## 0. What RDF Is, and Is Not

**RDF is the repeatable methodology used to design every AIOS Role**, before and during the creation of its Charter and Playbook. It is the formalization of the exact process already run — informally, four times — to design Architect, Product, Backend, and this framework's own predecessor discussions.

RDF is **not**:
- A new governance layer. The Constitution remains the single authority every Role inherits (Constitution §3).
- A new artifact structure. The Role Charter Template v2.0 remains the shape every Charter fills.
- A Role itself. It doesn't get a Charter, doesn't get ratified as "Active," and doesn't do work — it's the process a Founder and an AI Principal-level reviewer run together to arrive at a Charter and Playbook worth ratifying.

RDF's only output is: **a completed Charter, a completed Playbook, and an updated Role Boundary Matrix.** If a step in this framework doesn't visibly move toward one of those three things, it doesn't belong in RDF.

---

## 1. When RDF Applies

- **Every new Role proposal**, without exception, before any Charter or Playbook content is written.
- **A Role Boundary Matrix update triggered by a new Role's scope**, even when the affected existing Role is frozen — this is an ownership transfer (§7.2), not a revision, and does not reopen the frozen document.
- **A genuine revision to an existing, ratified Role**, only when real-world usage has exposed an actual shortcoming (per each ratified Charter's own changelog policy) — RDF's Discover and Validate phases still apply, scoped to the specific change.

RDF does **not** apply to routine work performed *by* an already-chartered Role — that's governed by the Role's own Charter and Playbook, not by RDF.

---

## 2. The Three Phases

```
DISCOVER  →  SPECIFY  →  VALIDATE  →  Constitution §15 Ratification
```

**DISCOVER** establishes whether this Role should exist at all, what it's really for, where its edges are, and what open questions need a Founder decision before anything gets drafted. **SPECIFY** fills the existing Role Charter Template and companion Playbook — RDF does not introduce a competing structure here, it just makes sure Discover's findings land in the right sections. **VALIDATE** checks the completed draft against a Universal Validation Checklist and a final Principal-level review before it goes to the Founder for ratification.

Each phase gates the next. A Role does not enter Specify without clearing Discover's Role Necessity Test. A Role does not go to the Founder for ratification without clearing Validate.

---

## 3. Phase 1 — DISCOVER

### 3.1 Role Necessity Test (mandatory gate)

Before any other Discover step runs, the proposed Role must pass all five of the following. Any failure stops the process — the proposal does not proceed to full review, let alone to Specify.

| Test | Question | Fails if |
|---|---|---|
| **Real Problem** | What breaks, or stays permanently unowned, if this Role doesn't exist? | The answer is speculative ("might be useful someday") rather than a concrete, current gap |
| **Cannot Be Absorbed** | Could an existing Role's Scope reasonably extend to cover this? | Yes, and extending it wouldn't overload that Role's existing identity |
| **Clear Ownership** | Can this Role's core responsibility be stated in one sentence a non-engineer would understand? | It takes a paragraph, or the sentence is really two different jobs joined by "and" |
| **No Duplication** | Does the Role Boundary Matrix (§7) already assign this domain to another Role? | Yes, and no genuine gap exists in how that Role currently covers it |
| **Long-Term Value** | Will this Role still make sense in three to five years, or is it solving a problem specific to today's tooling/stack/stage? | It's a today-shaped problem — that likely belongs inside an existing Role's Playbook as a technique, not a new standing Role |

**Output:** a short, written Role Necessity Test result (template in §9.1) — pass or fail, with reasoning per row. A pass is required before §3.2 begins.

### 3.2 Philosophy Discovery

For a Role that's passed §3.1, establish its identity before its structure:

- **Why does it exist?** — the gap it fills that nothing else fills.
- **Why *should* it exist?** — distinct from the above; this is the case for why that gap is worth a standing Role rather than an occasional task.
- **What does excellence look like?** — drawing on real, relevant external practice (the way Architect drew on Stripe/Linear, Product on Airbnb/Linear/OpenAI, Backend on production AI-code discipline), translated for a solo-founder AI-native org rather than copied wholesale.
- **How does this Role differ from its closest human-world equivalent?** — every Role reviewed so far has had at least one load-bearing difference from its traditional counterpart (Architect isn't a traditional architect who also codes; Product isn't a traditional PM optimizing for stakeholder coordination; Backend isn't a traditional backend engineer who also designs schema). Naming this difference explicitly is what keeps the Role from drifting back into its traditional-org shape by default.

### 3.3 Role Boundary Check

Query the Role Boundary Matrix (§7) for every responsibility area under consideration. For each:
- **No conflict** — the domain is unclaimed; proceed.
- **Conflict, resolvable by narrowing** — another Role owns something adjacent; state the precise line between them (mirrors, e.g., Product's journey vs. Frontend's interface, or Architect's build order vs. Product's release order).
- **Conflict, requiring an ownership transfer** — the new Role should own something an existing Role currently holds (e.g., a future Design Role inheriting visual authority from Frontend). This routes to the Ownership Transfer Protocol (§7.2) during Specify, not resolved by silently expanding scope now.

### 3.4 Failure Mode Discovery

A mandatory brainstorm, split explicitly into two categories — this split is the one substantive lesson from four Role reviews that deserves to become a permanent standard:

- **AI-specific failure modes** — ways this Role goes wrong *because* it's an AI agent with no persistent memory or instinct, not because the underlying job is hard. (Precedent: Backend's dependency hallucination and "should work" reporting; Frontend's component-API hallucination and design drift with no human "eye" catching inconsistency across sessions.)
- **Human-adjacent failure modes** — ways this Role goes wrong that a skilled human in the equivalent job could also fall into (scope creep, becoming a bottleneck, poor judgment on trade-offs). Real, but not the differentiated finding RDF exists to surface — these get a lighter pass.

The AI-specific list is the one that should feed most heavily into the eventual Charter's Failure Modes and Anti-Patterns sections. If this brainstorm produces zero genuinely AI-specific findings, that's a signal to look harder before moving on, not a signal that this Role happens to have none.

### 3.5 Required Founder Decisions

Every open question that Discover surfaces and can't resolve on its own — authority boundaries, escalation categories, autonomy classification calls, anything genuinely ambiguous — gets listed as a **Founder Decision Record** (template §9.2). This is a **process artifact, not permanent documentation** (Founder decision, 2026-08-06): it exists to obtain a policy decision, and once resolved, its *conclusions* — not the deliberation that produced them — get folded directly into the relevant Charter sections during Specify, and into that Charter's Versioning changelog "Why" column as a one-line reference. The conversation that produced the decision is not itself part of AIOS's permanent documentation.

**Discover is complete** when the Role Necessity Test has passed, Philosophy Discovery is written, the Boundary Check is resolved (including any planned transfers), Failure Mode Discovery has produced a real AI-specific list, and every Founder Decision has an answer.

---

## 4. Phase 2 — SPECIFY

Specify does not introduce new structure. It fills the existing **Role Charter Template v2.0** and produces a companion **Playbook**, per the standing Charter+Playbook convention (Product Charter, decision #2).

- **Charter** gets Discover's findings distributed into its existing sections: Philosophy Discovery informs Purpose/Mission (Template §2/§3); the Boundary Check informs Scope & Non-Goals (§4); resolved Founder Decisions inform Authority, Boundaries, and Autonomy Classification (§6–§8) directly, plus a one-line reference in each Versioning changelog row explaining *why* a given clause exists; the AI-specific failure list informs Failure Modes and Anti-Patterns (§21–§22).
- **Playbook** gets the concrete frameworks, templates, and worked examples that make the Charter's commitments executable — same relationship as every existing Role.
- **Role Boundary Matrix update** — before Specify is considered complete, every domain this Role now owns (and every domain transferred to it, per §7.2) is reflected in the Matrix. A Charter that exists but isn't reflected in the Matrix is incomplete, regardless of how well-written it is — the Matrix, not a re-read of every Charter, is what future Role designs will check against.

---

## 5. Phase 3 — VALIDATE

### 5.1 Final Principal-Level Review

Before the Universal Validation Checklist runs, the completed Charter and Playbook get the same adversarial review Discover's Role Necessity Test received — but now applied to the actual draft, not the concept. This mirrors the pattern already run twice on Architect (initial review, then a final review before freeze) and once each on Product and Backend: challenge duplication with the Constitution, challenge boundary clarity against the Role Boundary Matrix, challenge whether anything is stylistic-only versus materially necessary. Reject stylistic changes; only material findings proceed.

### 5.2 Universal Validation Checklist

Every AIOS Role must pass this in full before ratification. Tagged **[B]locking** (ratification does not proceed) or **[A]dvisory** (noted, doesn't block).

**Necessity & Boundaries**
- [B] Passed the Role Necessity Test (§3.1), with the written result retained as a process artifact
- [B] Every responsibility is checked against the Role Boundary Matrix — no unresolved overlap with an existing Role
- [B] Every Non-Goal names the specific Role that owns it instead
- [B] Any ownership transferred from an existing Role follows the Ownership Transfer Protocol (§7.2) — the source Charter is unedited, the transfer is logged in the Matrix

**Constitution & Template Compliance**
- [B] The Constitutional Inheritance Declaration is present, unmodified (Template §1)
- [B] No section restates a Constitution framework instead of referencing it (Priority Stack, Simplicity Ladder, Calibrated Confidence, Autonomy Boundaries, Escalation Rules)
- [B] Every Template section is present — a genuinely inapplicable section says so explicitly, none are silently omitted

**Authority & Autonomy**
- [B] Authority is stated as specific, checkable claims — not vague ("has final say on relevant technical matters")
- [B] Autonomy Classification (Template §8) covers act-and-report, propose-and-wait, and always-escalate with concrete examples, not just category labels
- [B] Any Two-Key-eligible category is named explicitly, with its review flow stated

**AI Collaboration & Failure Modes**
- [B] Failure Modes includes a genuinely AI-specific list (§3.4), not only generic engineering failure modes
- [B] The Role states what a zero-context future instance of itself needs to pick up its work correctly (Constitution §22 applied concretely, not just cited)
- [A] A verification/confidence discipline is stated — at minimum a reference to Constitution §12; Roles producing high-stakes output should consider a Backend-style explicit rule

**Verification, Metrics, Process**
- [B] Success Metrics include both outcome metrics and trend-tracked operational KPIs — not aspirational statements only
- [B] Definition of Done is a real, checkable bar, not a restatement of "the work is finished"
- [B] Escalation Rules extend, and don't merely repeat, Constitution §17
- [B] Review Process states who checks this Role's output and how, distinct from what this Role reviews in others

**Documentation & Tooling**
- [B] Tools Available and Allowed actions are concrete, not implied
- [A] Runtime/tooling needs identified during Discover are fully reflected in Tools Available — nothing assumed but unstated
- [B] Handoff Requirements state exactly what a downstream Role or the Founder needs, every time

**Longevity**
- [A] Evolution/Sunset conditions are stated where a future scope change is already foreseeable (the way Frontend's visual-design authority is foreseeably temporary)
- [B] Versioning & Changelog is present and its first entry explains *why*, referencing resolved Founder Decisions rather than reproducing them

A Role clears Validate only when every **[B]** item passes. Advisory gaps are noted in the Charter's Continuous Improvement Log rather than blocking ratification.

---

## 6. Ratification

RDF does not own ratification — it prepares a Role for it. Once Validate is clear, the completed Charter and Playbook go to the Founder, and ratification proceeds exactly per Constitution §15 (Agent Lifecycle): Proposed → Chartered/Active, on Founder approval, with the same lifecycle status and changelog conventions every existing Role already uses.

---

## 7. The Role Boundary Matrix

### 7.1 Purpose & Schema

A single, permanent, living artifact recording who owns what across every AIOS Role — so a new Role design checks one table instead of re-reading every existing Charter in full, the way Frontend's review still had to.

```markdown
| Domain / Responsibility | Owning Role | Boundary Notes | Source | Ownership History |
|---|---|---|---|---|
| e.g. "API contract design" | Architect | Backend implements to it, never redesigns unilaterally | Architect Charter §4 | — |
| e.g. "Visual design authority (color, typography, layout)" | Frontend | Inherited from Product; will transfer to a future Design Role | Product Charter §4 → Frontend Charter §4 | Product (2026-08-06) → Frontend (pending) |
```

- **Domain / Responsibility** — a specific, checkable line item, not a vague category.
- **Owning Role** — current owner, always singular. A domain with two owners is a Boundary Check failure (§3.3), not a valid Matrix entry.
- **Boundary Notes** — the precise edge, especially where a neighboring Role does related but distinct work.
- **Source** — which Charter section actually establishes this, so the Matrix is a fast index, not the sole authority — the Charter itself remains the source of truth for its own content.
- **Ownership History** — every transfer, in order, never overwritten (mirrors ADR superseding, never deleting).

### 7.2 Ownership Transfer Protocol

Handles the case a new Role's scope legitimately carves ownership away from an existing, possibly-frozen Role — explicitly **not** treated as a weakness in the original Charter (Founder decision, 2026-08-06):

1. The new Role's Charter states plainly, in its Scope section, that a given responsibility is **inherited from [Existing Role] Charter §X**, effective on ratification.
2. The Role Boundary Matrix's **Owning Role** field updates to the new Role; the **Ownership History** column gains a new entry — prior owner, new owner, date, and a one-line reason.
3. The original Charter is **never edited**. It remains historically accurate as of its own ratification date — a correct record of what was true when it was frozen, not a live description of current ownership. Anyone checking *current* ownership consults the Matrix, not the original Charter.
4. This is distinct from a Continuous Improvement Log entry (Constitution §30), which does reflect an actual shortcoming — a transfer reflects planned organizational growth, not a mistake.

### 7.3 Maintenance & Ownership

Architect owns and maintains the Role Boundary Matrix (Founder decision, 2026-08-06), consistent with Architect already holding cross-Role technical boundary resolution authority (Architect Charter §6). Ownership may move to a better-suited Role later, decided by the Founder, and logged the same way any other Matrix change would be.

---

## 8. Evolution of RDF Itself

RDF changes the same way the Constitution does, not the way an individual Role's Playbook does — deliberately, rarely, and only by the Founder:

- Any Role or reviewer may **propose** an RDF amendment, stated explicitly as such, never folded silently into an individual Role's review.
- Only the Founder ratifies a change to RDF.
- RDF's own version history is kept in full, same discipline as every other foundational document — nothing overwritten.
- RDF should be revised when real Role-design work exposes a genuine gap in the process (the same evidence-based bar applied to the Template, per Founder decision, 2026-08-06) — not on a schedule, and not speculatively.

---

## 9. Templates

### 9.1 Role Necessity Test

```markdown
# Role Necessity Test: <Proposed Role Name>
## Real Problem
What breaks, or stays unowned, without this Role?
## Cannot Be Absorbed
Could an existing Role's scope reasonably extend to cover this? Why not?
## Clear Ownership
One sentence, plain language, stating this Role's core job.
## No Duplication
Role Boundary Matrix check — any conflicting entries? How resolved?
## Long-Term Value
Will this still make sense in 3-5 years, or is it solving a today-shaped problem?
## Result
PASS / FAIL, with reasoning per row above.
```

### 9.2 Founder Decision Record

```markdown
# Founder Decision Record: <Topic>
## Context
What question needs a policy answer, and why Discover couldn't resolve it alone.
## Options Considered
## Founder Decision
## Where This Lands in the Charter
Which Charter section(s) this decision is folded into.
```
(Process artifact — discarded after its conclusion is folded into the Charter, per §3.5.)

### 9.3 Universal Validation Checklist

Full checklist — see §5.2 above.

---

## Ratification

**AIOS Role Design Framework v1.0** is proposed under **AIOS Constitution v1.1** and takes effect upon Founder approval. Once ratified, it applies to every Role designed from this point forward, beginning with Frontend and QA.

**Status: Ratified and Locked by Founder on 2026-08-06.**
