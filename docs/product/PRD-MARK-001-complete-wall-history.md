# PRD-MARK-001: Complete Wall Mark History

**Status:** Proposed for Founder review; no implementation approval inferred
**Scope owner:** Product
**Validation tier:** Spec-ready reliability correction within the existing Wall and exact-Mark journeys

## Problem and evidence

- **Verified:** `getWallMarks` makes one unpaged active-Mark read. My Wall, person Wall, and Shared Wall use that result as their entire visible history.
- **Verified:** the deferred destination resolver also tests exact-Mark availability by searching that same list. A bounded response can therefore misclassify an older, authorized Mark as unavailable.
- **Verified:** existing Alerts history already offers progressive older-page loading and a retry state.
- **Believed-likely:** long-lived Walls will exceed the hosted query response limit. The hosted setting and actual Wall sizes have not been inspected.

## Goal

Every authorized active Mark on a Personal or Shared Wall remains reachable as its history grows. A link to an older authorized Mark opens that exact Mark regardless of which history page contains it.

## Acceptance criteria

1. My Wall, another person's Wall, and Shared Walls initially show a bounded newest portion of available Marks in the established pinned-first order. Each offers a **Load older Marks** action while more remain, including when the current filter has no loaded matches.
2. Loading older Marks appends without duplicates or lost rows across equal timestamps and the pinned-to-unpinned boundary while the underlying Wall order is stable. A failed request keeps visible Marks and allows retry. A refresh or a pin/removal action starts the history over from its newest page so a changed ordering cannot leave an old cursor in use.
3. Opening an authorized exact-Mark link shows that Mark independently of which history page contains it, preserving the ordinary Wall context. For a Secret Mark, this means the existing locked shell and one-time reveal affordance, never automatically revealing content. For other Mark types, the ordinary detail and reactions remain usable. If the Mark later appears in a loaded page, it is shown only once. A missing, removed, pending, inaccessible, or wrong-Wall target gets the existing privacy-safe unavailable outcome. Transport failure remains retryable.
4. Account change, sign-out, screen departure, or a newer refresh prevents an old request from changing the current Wall. New live arrivals remain visible once, and filtering applies consistently to loaded Marks.
5. Header copy says **N loaded Marks** until the last page has been reached, then may say **N Marks**. The independently focused Mark is excluded from the loaded grid count. No partial count is presented as the total.
6. Existing Wall visibility, authorization, Anonymous/Secret presentation, moderation, reactions, and exact-link behavior are preserved.

## Non-goals

- Changing Mark retention, visibility, ordering policy, moderation, or Wall access rules.
- Infinite scroll, search across history, new filters, a new feed, or a new Mark type.
- Selecting a public domain, universal HTTPS links, schema or hosted changes, merge, deployment, or release as part of this proposal.

## Product quality bar and validation

An older memory should feel present on the Wall, not lost behind a misleading empty or unavailable state. The older-page action must remain discoverable on filtered and unfiltered Walls; a failed load should never erase the memories already visible.

**Success:** device verification of older pages, exact links beyond the first page, pin boundaries, and failure recovery on Personal and Shared Walls, alongside contract tests and independent review.
**Kill criterion:** if exact access or privacy cannot be preserved with bounded client reads, pause the slice and seek a smaller reviewed design; do not ship a list-only pagination change.

## Decision and open gate

This is a product-facing change to the three Wall screens. The Founder authorized proceeding with the proposed Wall history work on 2026-09-23; this document makes the action and count wording explicit for review. A separate architecture review should validate the read contract and decide whether any database index is required; this document does not authorize a migration.
