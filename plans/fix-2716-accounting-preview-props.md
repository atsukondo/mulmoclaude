# plan: the accounting preview card has never rendered a real summary

Tracking: #2716

## What is wrong

`packages/plugins/accounting-plugin/src/vue/Preview.vue` declares

```ts
defineProps<{ data?: unknown; jsonData?: Record<string, unknown> }>();
```

but the only place a `previewComponent` is rendered passes just `:result`:

```html
<!-- src/components/SessionSidebar.vue:64 -->
<component :is="getPlugin(result.toolName)?.previewComponent"
           v-if="getPlugin(result.toolName)?.previewComponent" :result="result" />
```

So both props are always `undefined` and `summarisePreview` always falls through
to its generic branch. Every other plugin declares `result`; accounting is the
only one out of line. Reproduced, not inferred:

```
今サイドバーが出しているもの → pluginAccounting.previewGeneric
正しく渡した場合             → pluginAccounting.preview.bookCreated {"name":"Harness Co","id":"book-1"}
```

## Why no gate caught it

The package DOES run `vue-tsc --noEmit` over `src/**/*`, so the SFC is
typechecked. The mismatch survives because the render site is a **dynamic**
component (`<component :is="...">`), whose props TypeScript cannot check. This
class of bug is structurally invisible to the typechecker and can only be held
by a test.

## #2716's framing was right, and I got it wrong first

I initially claimed the opposite of what follows, and the record is worth
keeping because the mistake is an easy one to repeat.

Reading only the render site, `data` looks irrelevant: `SessionSidebar.vue`'s
`v-if` is `getPlugin(result.toolName)?.previewComponent`, and `sidebarResults`
is `deduplicateResults(toolResults)`, which only collapses consecutive updating
results. Neither mentions `data`. I concluded the card was already there and
that adding `getReport` merely filled it — and an e2e injecting a data-less
envelope "confirmed" it, because injection bypasses the layer that matters.

**The gate is one layer up.** `server/agent/mcp-server.ts` posts a result to the
session only when the handler set `data`:

```ts
if (result.data !== undefined) { … }
```

and its comment names `getReport` as a deliberate narrate-only action. Two more
host sites say the same: `sessionHelpers.ts` ("every result that reaches this
function is intended to surface a card") and `session-store/index.ts` ("Holds
only results that carried `data` — the bridge pushes nothing else"). So a
data-less action produces no card, no `toolResults` entry, and no JSONL line.

Which means the issue's framing holds: **adding `getReport` here ADDS a card per
report call.** That is the cost, and it is a product call, not a mechanical fix.
The comment above `PREVIEW_ACTIONS` was correct about the effect and only
imprecise about where the gate lives; it now names the bridge.

## Shape

1. **`Preview.vue` takes `result`** and reads `result.data`, like every other
   plugin preview.
2. **`jsonData` goes.** The router sets `data` and has never set `jsonData`
   (`router.ts:388` is the only writer), so the second prop and the merge inside
   `summarisePreview` are dead. `summarisePreview(data, translate)` loses the
   parameter; `asPayload` stays, since it is what rejects a non-record payload.
3. **`getReport` joins `PREVIEW_ACTIONS`**, which is what makes `summarisePl` /
   `summariseBs` reachable for the first time. Verified the shapes line up:
   `handleGetReport` returns `{ bookId, profitLoss }` / `{ bookId, balanceSheet }`,
   and `ProfitLoss` carries `from` / `to` / `netIncome` while `BalanceSheet`
   carries `asOf` / `sections[].type` / `sections[].total` — exactly the fields
   the two summarisers read, so neither falls back to `?`.
4. **The router comment is corrected** to say what the gate actually does.

## The guard — a census, not a spot check

Accounting is one instance of "a preview component whose props do not match the
render site". A fix to that one file leaves the next plugin free to repeat it,
and the typechecker cannot see it.

The built artefacts expose their declared props at runtime, and `dist` is plain
JS, so `tsx --test` can read them without loading an SFC:

```
accounting  {"data":{},"jsonData":{}}   ← the outlier
html        {"result":{}}
chart       {"result":{}}
```

So the test asserts that **every** plugin exposing a `previewComponent` declares
a `result` prop. That holds the class, and it fails for any future plugin that
drifts.

## Verification

- The card is a UI change, so run the app and look at the sidebar for a
  `getReport` call — the claim "a card already renders" came from reading code
  and has not yet been seen on screen.
- Break-verify the census test: revert the props to `data`/`jsonData` and watch
  it go red.
- Unit-test `summarisePl` / `summariseBs` through the real payload shape the
  router now produces, not a hand-built one.

## Not in scope

- The other plugins' previews — they already declare `result`.
- Whether reads in general should earn a card. `getReport` is the only read this
  touches, and only because its summariser already exists and has never been
  reachable.
