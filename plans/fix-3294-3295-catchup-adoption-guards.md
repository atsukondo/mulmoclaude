# fix: adopt a catch-up snapshot only when it is complete and current (#3294, #3295)

## Problem

`refreshSessionTranscript` replaced the client transcript whenever the server copy was
richer (`shouldAdoptServerTranscript`). Two situations make that unsafe:

- **#3294 (mid-run).** Reconnect and visibility catch-ups run while a turn streams. The
  server JSONL does not yet hold the text being streamed: `flushTextAccumulator` writes it
  only when a non-text event arrives or the run ends. So a mid-run snapshot is missing the
  card the user is watching, and adopting it drops that card. It also leaves
  `runStartIndex` and `assistantTextInterrupted` describing the old list.
- **#3295 (stale snapshot).** Live events that arrive while the fetch is in flight are not
  in the snapshot. Adopting it drops them until the next refresh.

## Change

- `src/utils/session/catchUpGuard.ts` (pure):
  - `transcriptRevision` combines card count, last uuid and the last card's text length.
  - `decideCatchUpAdoption` checks, in order: `running`, then `stale`, then
    `not-richer`; otherwise `adopt`.
- `refreshSessionTranscript` skips a running session before fetching, takes the revision
  before the fetch, and adopts only on `adopt`.
- **A missed `session_finished` is also recovered.** It used to trigger the post-run
  refresh. Now `refreshSessionStates` reports each session it flips from running to
  stopped (`onSessionStopped`, via the new pure `applySessionSummary`), and `App.vue`
  refreshes that session's transcript.

## Decision (#3294's "to decide")

The issue offered two options: skip adoption while running, or recompute `runStartIndex`
from the alignment. **Skipping is the only complete option**, because recomputing run
state cannot restore streamed text the snapshot does not contain. The cost is that cards
missed mid-run appear when the turn ends, not at reconnect.

## Verification

- `applySessionSummary` was extracted from the `refreshSessionStates` loop. The old body
  and the helper were run side by side over every input combination with no difference;
  that enumeration stays as a permanent test.
- Each guard rule has a test that goes red when the rule is removed.
