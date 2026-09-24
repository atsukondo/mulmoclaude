# fix: keep selection and timestamps when catch-up adopts the server transcript (#3292)

## Problem

`refreshSessionTranscript` adopts the server copy by replacing `session.toolResults` only.
`parseSessionEntries` gives every text / skill / error card a fresh uuid on each parse,
so after adoption:

- every text card's `resultTimestamps` entry is orphaned (export and sidebar lose the time);
- a `selectedResultUuid` pointing at a text card no longer exists, so `App.vue`'s
  `selectedResult` becomes `null` and nothing is shown as selected.

## Change

`src/utils/session/adoptTranscript.ts` (pure):

- `alignServerToClient`: an in-order greedy match between the two card lists. Cards match
  when the uuid is the same (tool results keep theirs), or when they are the same text
  kind and title and the server body starts with the client body (the truncated-stream
  case, #2096). A server card with no match is one the client missed.
- `adoptServerTranscript`: a matched card keeps the client's timestamp; a missed card
  gets the adoption time. Selection rules:
  - a user on the last card follows to the new last card;
  - any other selection is kept, on its new uuid;
  - a selection whose card is gone falls back to the last card.

`useSessionLifecycle.ts` applies all three fields.

## Decisions (the issue's "to decide")

- Follow the tail only when the user was on the last card, so a deliberate earlier
  selection is never stolen.
- A recovered card is stamped with the adoption time rather than an interpolated one. It
  arrived now as far as this client is concerned, and interpolation would reorder
  existing times.

## Out of scope

Client-only cards the server never persists (e.g. an attachment error pushed by
`App.vue`) are still dropped when the server copy is adopted, as before.
