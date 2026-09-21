// Unit tests for propagating local deletions to Google (#3234).
//
// The guard itself lives in `test_calendarDeletePlan.ts`; this is the
// orchestration around it, and the two things it must get right are both
// about the BASELINE:
//
//   - a deletion that carried must drop its baseline entry, or the same
//     deletion is reported on every run forever;
//   - a deletion that was REFUSED must keep it, because the event is still
//     there and the report is the only thing that says so.
//
// Both are checked here rather than only in a live run, because the live suite
// needs a grant and a disposable calendar and so does not gate a PR.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sweepDeletes, type DeleteSweepDeps } from "@mulmoclaude/core/google";

/** A calendar stubbed at the three effects the sweep has, recording each. */
const stub = (events: Record<string, { attendeeCount: number } | null>) => {
  const calls = { fetched: [] as string[], deleted: [] as string[], forgotten: [] as string[] };
  const deps: DeleteSweepDeps = {
    fetchEvent: async (eventId) => {
      calls.fetched.push(eventId);
      return events[eventId] ?? null;
    },
    deleteEvent: async (eventId) => {
      calls.deleted.push(eventId);
    },
    forget: async (eventId) => {
      calls.forgotten.push(eventId);
    },
  };
  return { deps, calls };
};

describe("sweepDeletes — off by default", () => {
  it("touches nothing when the collection did not opt in, but still counts", async () => {
    const { deps, calls } = stub({ ev1: { attendeeCount: 0 } });
    const sweep = await sweepDeletes(["ev1", "ev2"], false, deps);
    assert.deepEqual(sweep, { seen: 2, deleted: [], skipped: [], errors: [] });
    assert.deepEqual(calls, { fetched: [], deleted: [], forgotten: [] });
  });

  it("does not even read Google when there is nothing to delete", async () => {
    const { deps, calls } = stub({});
    assert.deepEqual(await sweepDeletes([], true, deps), { seen: 0, deleted: [], skipped: [], errors: [] });
    assert.deepEqual(calls.fetched, []);
  });
});

describe("sweepDeletes — a solo event", () => {
  it("deletes it and forgets its baseline, in that order", async () => {
    const { deps, calls } = stub({ ev1: { attendeeCount: 0 } });
    const sweep = await sweepDeletes(["ev1"], true, deps);
    assert.deepEqual(sweep, { seen: 1, deleted: ["ev1"], skipped: [], errors: [] });
    assert.deepEqual(calls.deleted, ["ev1"]);
    assert.deepEqual(calls.forgotten, ["ev1"]);
  });

  it("carries every one of several", async () => {
    const { deps, calls } = stub({ ev1: { attendeeCount: 0 }, ev2: { attendeeCount: 0 }, ev3: { attendeeCount: 0 } });
    const sweep = await sweepDeletes(["ev1", "ev2", "ev3"], true, deps);
    assert.deepEqual(sweep.deleted, ["ev1", "ev2", "ev3"]);
    assert.deepEqual(calls.forgotten, ["ev1", "ev2", "ev3"]);
  });
});

describe("sweepDeletes — an event with attendees", () => {
  it("leaves it in Google and says why", async () => {
    const { deps, calls } = stub({ ev1: { attendeeCount: 2 } });
    const sweep = await sweepDeletes(["ev1"], true, deps);
    assert.deepEqual(sweep.deleted, []);
    assert.equal(sweep.skipped.length, 1);
    assert.match(sweep.skipped[0] ?? "", /ev1: left in Google because it has attendees/);
    assert.deepEqual(calls.deleted, []);
  });

  // The baseline is what finds the deletion next time. Dropping it here would
  // silence the report while the event stayed on other people's calendars.
  it("KEEPS its baseline, so the refusal is reported again next run", async () => {
    const { deps, calls } = stub({ ev1: { attendeeCount: 2 } });
    await sweepDeletes(["ev1"], true, deps);
    assert.deepEqual(calls.forgotten, []);
  });

  it("does not stop the sweep — the solo events around it still go", async () => {
    const { deps, calls } = stub({ ev1: { attendeeCount: 0 }, ev2: { attendeeCount: 5 }, ev3: { attendeeCount: 0 } });
    const sweep = await sweepDeletes(["ev1", "ev2", "ev3"], true, deps);
    assert.deepEqual(sweep.deleted, ["ev1", "ev3"]);
    assert.equal(sweep.skipped.length, 1);
    assert.deepEqual(calls.forgotten, ["ev1", "ev3"]);
  });
});

describe("sweepDeletes — an event already gone from Google", () => {
  // Nothing is left to diverge, so this is not a refusal to report — it is a
  // baseline entry with nothing behind it, and keeping it would make the push
  // announce the same phantom deletion forever.
  it("forgets its baseline without reporting or deleting", async () => {
    const { deps, calls } = stub({ ev1: null });
    const sweep = await sweepDeletes(["ev1"], true, deps);
    assert.deepEqual(sweep, { seen: 1, deleted: [], skipped: [], errors: [] });
    assert.deepEqual(calls.deleted, []);
    assert.deepEqual(calls.forgotten, ["ev1"]);
  });
});

describe("sweepDeletes — a failure", () => {
  const failing = (failOn: string, events: Record<string, { attendeeCount: number } | null>) => {
    const { deps, calls } = stub(events);
    const wrapped: DeleteSweepDeps = {
      ...deps,
      deleteEvent: async (eventId) => {
        if (eventId === failOn) throw new Error("Google Calendar API 503");
        await deps.deleteEvent(eventId);
      },
    };
    return { deps: wrapped, calls };
  };

  it("reports the event that failed and keeps its baseline, so the next run retries", async () => {
    const { deps, calls } = failing("ev1", { ev1: { attendeeCount: 0 } });
    const sweep = await sweepDeletes(["ev1"], true, deps);
    assert.deepEqual(sweep.deleted, []);
    assert.equal(sweep.errors.length, 1);
    assert.match(sweep.errors[0] ?? "", /ev1: could not be deleted in Google — .*503/);
    assert.deepEqual(calls.forgotten, []);
  });

  it("keeps going after it", async () => {
    const { deps, calls } = failing("ev1", { ev1: { attendeeCount: 0 }, ev2: { attendeeCount: 0 } });
    const sweep = await sweepDeletes(["ev1", "ev2"], true, deps);
    assert.deepEqual(sweep.deleted, ["ev2"]);
    assert.equal(sweep.errors.length, 1);
    assert.deepEqual(calls.forgotten, ["ev2"]);
  });

  it("reports a read that fails the same way, without deleting", async () => {
    const { calls } = stub({});
    const deps: DeleteSweepDeps = {
      fetchEvent: async () => {
        throw new Error("Google Calendar API 500");
      },
      deleteEvent: async (eventId) => {
        calls.deleted.push(eventId);
      },
      forget: async (eventId) => {
        calls.forgotten.push(eventId);
      },
    };
    const sweep = await sweepDeletes(["ev1"], true, deps);
    assert.equal(sweep.errors.length, 1);
    assert.deepEqual(calls.deleted, []);
    assert.deepEqual(calls.forgotten, []);
  });
});
