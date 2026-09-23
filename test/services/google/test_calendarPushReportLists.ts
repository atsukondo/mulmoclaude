// Which report list each thing a push produced goes into (#3272).
//
// `skipped` means "this push did not do what you asked". A deletion Google
// refused is not that: the record went away here, the event is deliberately
// still standing there, and the rest of the run carried. While the two shared
// one list, a single refusal took the caller's problem branch with it and hid
// every create and update the same push had made.
//
// Driven here rather than through `tally`, which needs a workspace, a grant and
// a baseline file on disk. `pushReportLists` owns all three lists, so the
// separation is something a test can actually move.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pushReportLists, type DeleteSweep } from "@mulmoclaude/core/google";

const REFUSAL = "ev1: left in Google because it has attendees";
const SWEEP_FAILURE = "ev2: 500 from Google";
const UNPUSHABLE = "row-9: needs a mapped start and end";
const PUSH_FAILURE = "row-7: HTTP 500";

const sweep = (overrides: Partial<DeleteSweep> = {}): DeleteSweep => ({ seen: 0, deleted: [], kept: [], errors: [], ...overrides });

describe("pushReportLists", () => {
  it("files a refused deletion under kept, never under skipped", () => {
    // THE REGRESSION: with these merged, the caller reads a refusal as "this
    // push failed" and never reaches the counts.
    const lists = pushReportLists([], sweep({ seen: 1, kept: [REFUSAL] }));
    assert.deepEqual(lists.keptInGoogle, [REFUSAL]);
    assert.deepEqual(lists.skipped, []);
  });

  it("files a record that could not be pushed under skipped", () => {
    const lists = pushReportLists([{ kind: "skipped", message: UNPUSHABLE }], sweep());
    assert.deepEqual(lists.skipped, [UNPUSHABLE]);
    assert.deepEqual(lists.keptInGoogle, []);
  });

  it("keeps all three apart when all three happened", () => {
    const lists = pushReportLists(
      [{ kind: "created" }, { kind: "skipped", message: UNPUSHABLE }, { kind: "error", message: PUSH_FAILURE }],
      sweep({ seen: 2, deleted: ["ev3"], kept: [REFUSAL], errors: [SWEEP_FAILURE] }),
    );
    assert.deepEqual(lists.skipped, [UNPUSHABLE]);
    assert.deepEqual(lists.keptInGoogle, [REFUSAL]);
    assert.deepEqual(lists.errors, [PUSH_FAILURE, SWEEP_FAILURE]);
  });

  it("does treat a sweep FAILURE as an error — a 500 is not a decision", () => {
    const lists = pushReportLists([], sweep({ errors: [SWEEP_FAILURE] }));
    assert.deepEqual(lists.errors, [SWEEP_FAILURE]);
    assert.deepEqual(lists.keptInGoogle, []);
  });

  it("reports nothing for a run where everything carried", () => {
    const lists = pushReportLists([{ kind: "created" }, { kind: "updated" }], sweep({ seen: 1, deleted: ["ev3"] }));
    assert.deepEqual(lists, { skipped: [], keptInGoogle: [], errors: [] });
  });

  it("answers exactly these three lists, so nothing has a fourth place to go", () => {
    assert.deepEqual(Object.keys(pushReportLists([], sweep({ kept: [REFUSAL] }))).sort(), ["errors", "keptInGoogle", "skipped"]);
  });
});
