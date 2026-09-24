// #3294 / #3295. A catch-up snapshot may replace the transcript only when it
// is complete (no run in progress) and current (nothing changed during the fetch).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ToolResultComplete } from "gui-chat-protocol/vue";
import { decideCatchUpAdoption, transcriptRevision } from "../../../src/utils/session/catchUpGuard.js";
import { makeErrorResult, makeTextResult } from "../../../src/utils/tools/result.js";

const user = makeTextResult("hi", "user");
const reply = makeTextResult("hello", "assistant");

function richerServerCopy(): ToolResultComplete[] {
  return [{ ...user, uuid: "u-server" }, { ...reply, uuid: "r-server" }, makeErrorResult("missed")];
}

describe("transcriptRevision", () => {
  it("is stable while nothing changes", () => {
    assert.equal(transcriptRevision([user, reply]), transcriptRevision([user, reply]));
  });

  it("changes when a card is added, replaced, or the streaming card grows", () => {
    const base = transcriptRevision([user, reply]);
    assert.notEqual(transcriptRevision([user, reply, makeErrorResult("x")]), base);
    assert.notEqual(transcriptRevision([user, makeTextResult("hello", "assistant")]), base);
    assert.notEqual(transcriptRevision([user, { ...reply, message: "hello there" }]), base);
  });

  it("handles an empty transcript and a card with an empty message", () => {
    assert.equal(transcriptRevision([]), ["0", "", "0"].join(":"));
    const bare: ToolResultComplete = { uuid: "t", toolName: "presentChart", message: "", title: "Chart", data: {} };
    assert.equal(transcriptRevision([bare]), "1:t:0");
  });
});

describe("decideCatchUpAdoption", () => {
  it("adopts a richer, current snapshot of a finished session", () => {
    const clientResults = [user, reply];
    const decision = decideCatchUpAdoption({
      isRunning: false,
      revisionAtFetch: transcriptRevision(clientResults),
      clientResults,
      serverResults: richerServerCopy(),
    });
    assert.equal(decision, "adopt");
  });

  it("never adopts while a run is in progress — the snapshot lacks the streaming text", () => {
    const clientResults = [user, reply];
    const decision = decideCatchUpAdoption({
      isRunning: true,
      revisionAtFetch: transcriptRevision(clientResults),
      clientResults,
      serverResults: richerServerCopy(),
    });
    assert.equal(decision, "running");
  });

  it("rejects a snapshot overtaken by a live card that arrived during the fetch", () => {
    const revisionAtFetch = transcriptRevision([user]);
    const clientResults = [user, makeTextResult("live card", "assistant")];
    assert.equal(decideCatchUpAdoption({ isRunning: false, revisionAtFetch, clientResults, serverResults: richerServerCopy() }), "stale");
  });

  it("rejects a snapshot overtaken by streamed text that arrived during the fetch", () => {
    const revisionAtFetch = transcriptRevision([user, reply]);
    const clientResults = [user, { ...reply, message: "hello, and more" }];
    assert.equal(decideCatchUpAdoption({ isRunning: false, revisionAtFetch, clientResults, serverResults: richerServerCopy() }), "stale");
  });

  it("keeps the client copy when the snapshot is not richer", () => {
    const clientResults = [user, reply];
    const decision = decideCatchUpAdoption({ isRunning: false, revisionAtFetch: transcriptRevision(clientResults), clientResults, serverResults: [user] });
    assert.equal(decision, "not-richer");
  });

  it("checks running before staleness, so a live run is reported as running", () => {
    const decision = decideCatchUpAdoption({ isRunning: true, revisionAtFetch: "stale", clientResults: [user], serverResults: richerServerCopy() });
    assert.equal(decision, "running");
  });

  it("handles an empty client and an empty server", () => {
    assert.equal(decideCatchUpAdoption({ isRunning: false, revisionAtFetch: transcriptRevision([]), clientResults: [], serverResults: [] }), "not-richer");
    assert.equal(decideCatchUpAdoption({ isRunning: false, revisionAtFetch: transcriptRevision([]), clientResults: [], serverResults: [user] }), "adopt");
  });
});
