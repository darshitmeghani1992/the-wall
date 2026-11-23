# Poll Marks for the first public beta

Status: poll scope approved by the Founder on 23 November 2026 (“Include polls only”). The behavior below is a Product proposal awaiting the protected UX decision and the Secret-mode decision. The proposal does not change the current app.

The scope decision includes single-choice and multiple-choice Poll Marks on Personal and Shared Walls. Who-Said-This, Roast Me and Awards Night stay deferred. The existing public beta release gates apply. See [release tracker #57](https://github.com/darshitmeghani1992/the-wall/issues/57).

## Proposed experience

- Add an inline Poll action to the existing New Mark composer. Author a question, enter two to six distinct options, and choose whether voters can select one option or several. Reuse the existing 500-character question limit and propose 80 characters per option. Trim surrounding whitespace and use a consistent rule for case-insensitive duplicate options. A poll occupies one Mark and does not include a media attachment.
- Require the existing Wall view and contribution permissions to publish. Preserve Anonymous author mode where the Wall allows it and continue to protect that identity. The target Wall, actor and chosen options remain unchanged through recoverable failures. Reset the editor on an account or destination change.
- Propose one ballot per eligible account. A vote requires current access to the poll and the Wall and owner or contributor capability. Following alone remains view-only. In a Shared Wall, the existing posting rules apply. A recipient or moderator does not gain additional rights from reading a poll.
- Require exactly one selection for a single-choice ballot and at least one distinct selection for a multiple-choice ballot. Voters may replace their entire selection while the poll is open. A re-sent action produces one ballot and one set of counts. A multi-option ballot counts once in the ballot total and once per selected option.
- Show aggregate results to eligible viewers without voter names, voter IDs or per-person choices. Show the signed-in voter their own selections only. Clearly distinguish total ballots from per-option counts for multiple-choice polls.
- Propose author-controlled closing with explicit confirmation and no reopening or timer. Closing preserves results and prevents further votes. Propose editing the question or options only before the first ballot and within the existing sender edit window. Reuse existing Mark removal, reporting and moderation rules. Keep read/write permission checks live after view, follow, membership or block changes.

## Decisions before protected implementation

- Master Build Specification §27 says any supported Mark may be Secret. The proposed Poll Mark relies on repeated or multi-person participation and results. Confirm that Poll Marks are ineligible for Secret for this beta, or supply a specific recipient, voting, reveal, results and expiration contract for Secret polls. Anonymous author mode remains independent.
- Review the inline composer action and the proposed poll-card and detail interaction against the existing UI approval process, including limits, voters, result visibility, editing and close behavior. Scope inclusion alone did not approve these interaction details.

## Acceptance

| Journey | Pass condition |
|---|---|
| Create | An eligible contributor can create a single-choice and multiple-choice poll on both Wall types. Invalid, duplicated or incomplete options cannot post. Rapid taps and a lost successful response create one Mark. |
| Vote and change | Single choice refuses multiple selections. Multiple choice accepts a valid set and rejects unknown or duplicate options. A changed ballot atomically replaces old selections. Retry, concurrent taps and two devices leave one valid ballot with accurate totals. |
| Permissions | Owner, eligible contributor, accepted member, view-only follower and outsider see only permitted actions and content. Removal, blocking, deactivation or lost eligibility stops later access or voting. Read-only access never grants a ballot. |
| Results and privacy | Zero-vote, open and closed states display correctly. Only the voter can read their own selections. Aggregates contain no voter or Anonymous author identifiers in cards, detail, links, alerts, logs or realtime payloads. |
| Close, edit and report | The author can close an eligible poll once. After a close, edits and new ballots fail without changing results. Before a first vote, edits honor the sender window and cannot race a committed ballot. Existing hide, report and removal pathways still work. |
| Recovery and devices | VoiceOver and TalkBack identify question, choice type, selection and results. Slow, offline, ambiguous success and account-switch cases preserve the appropriate state. Independent QA passes on exact installed Android and iOS release builds. |

See [technical plan](../architecture/FP-MARK-002-poll-marks.md) for the gated implementation sequence.
