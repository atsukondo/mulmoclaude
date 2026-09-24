// #3292. Adopting the server transcript must carry the selection and every
// card's timestamp across, even though text cards come back with new uuids.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ToolResultComplete } from "gui-chat-protocol/vue";
import { adoptServerTranscript, alignServerToClient, type TranscriptView } from "../../../src/utils/session/adoptTranscript.js";
import { makeErrorResult, makeTextResult } from "../../../src/utils/tools/result.js";

const NOW_MS = 9_000;

function toolCard(uuid: string): ToolResultComplete {
  return { uuid, toolName: "presentChart", message: "chart", title: "Chart", data: {} };
}

/** The same text card as the server re-parses it: identical content, new uuid. */
function reparsed(card: ToolResultComplete): ToolResultComplete {
  return { ...card, uuid: `${card.uuid}-server` };
}

function clientView(toolResults: ToolResultComplete[], selectedResultUuid: string | null): TranscriptView {
  const resultTimestamps = new Map(toolResults.map((card, index) => [card.uuid, (index + 1) * 100]));
  return { toolResults, selectedResultUuid, resultTimestamps };
}

describe("adoptServerTranscript — the reported case", () => {
  it("keeps timestamps of cards the client had, stamps the recovered one, and follows the tail", () => {
    const user = makeTextResult("hi", "user");
    const truncated = makeTextResult("half a re", "assistant");
    const client = clientView([user, truncated], truncated.uuid);
    const recoveredError = makeErrorResult("claude exited with code 2");
    const server = [reparsed(user), { ...reparsed(truncated), message: "half a reply" }, recoveredError];

    const adopted = adoptServerTranscript(client, server, NOW_MS);

    assert.equal(adopted.toolResults, server);
    assert.equal(adopted.selectedResultUuid, recoveredError.uuid);
    assert.deepEqual(
      [...adopted.resultTimestamps],
      [
        [server[0]?.uuid, 100],
        [server[1]?.uuid, 200],
        [recoveredError.uuid, NOW_MS],
      ],
    );
  });
});

describe("adoptServerTranscript — selection", () => {
  it("keeps a deliberate selection of an earlier text card, on its new uuid", () => {
    const user = makeTextResult("hi", "user");
    const reply = makeTextResult("hello", "assistant");
    const client = clientView([user, reply], user.uuid);
    const server = [reparsed(user), reparsed(reply), makeErrorResult("x")];
    assert.equal(adoptServerTranscript(client, server, NOW_MS).selectedResultUuid, `${user.uuid}-server`);
  });

  it("keeps a selected tool card, whose uuid survives the round trip", () => {
    const user = makeTextResult("hi", "user");
    const chart = toolCard("chart-1");
    const reply = makeTextResult("done", "assistant");
    const client = clientView([user, chart, reply], chart.uuid);
    const server = [reparsed(user), chart, reparsed(reply), makeErrorResult("x")];
    assert.equal(adoptServerTranscript(client, server, NOW_MS).selectedResultUuid, chart.uuid);
  });

  it("falls back to the last card when nothing was selected", () => {
    const user = makeTextResult("hi", "user");
    const server = [reparsed(user), makeErrorResult("x")];
    assert.equal(adoptServerTranscript(clientView([user], null), server, NOW_MS).selectedResultUuid, server[1]?.uuid);
  });

  it("falls back to the last card when the selected card is not in the server copy", () => {
    const user = makeTextResult("hi", "user");
    const clientOnly = makeErrorResult("attach failed");
    const reply = makeTextResult("hello", "assistant");
    const client = clientView([user, clientOnly, reply], clientOnly.uuid);
    const server = [reparsed(user), reparsed(reply), makeErrorResult("x")];
    assert.equal(adoptServerTranscript(client, server, NOW_MS).selectedResultUuid, server[2]?.uuid);
  });

  it("selects nothing when the server copy is empty", () => {
    const adopted = adoptServerTranscript(clientView([], null), [], NOW_MS);
    assert.equal(adopted.selectedResultUuid, null);
    assert.equal(adopted.resultTimestamps.size, 0);
  });
});

describe("alignServerToClient", () => {
  it("skips a card the client missed in the middle and keeps aligning after it", () => {
    const user = makeTextResult("hi", "user");
    const chart = toolCard("chart-1");
    const later = makeTextResult("after the chart", "assistant");
    const missed = makeTextResult("before the chart", "assistant");
    const server = [reparsed(user), missed, chart, reparsed(later)];
    const aligned = alignServerToClient([user, chart, later], server);
    assert.deepEqual(
      [...aligned],
      [
        [`${user.uuid}-server`, user.uuid],
        [chart.uuid, chart.uuid],
        [`${later.uuid}-server`, later.uuid],
      ],
    );
  });

  it("does not pair a user card with an assistant card of the same text", () => {
    const asUser = makeTextResult("same words", "user");
    const asAssistant = makeTextResult("same words", "assistant");
    assert.equal(alignServerToClient([asUser], [asAssistant]).size, 0);
  });

  it("does not pair text whose server body does not extend the client's", () => {
    const client = makeTextResult("hello", "assistant");
    const server = makeTextResult("goodbye", "assistant");
    assert.equal(alignServerToClient([client], [server]).size, 0);
  });

  it("does not pair two different tool cards by kind alone", () => {
    assert.equal(alignServerToClient([toolCard("a")], [toolCard("b")]).size, 0);
  });
});

// Generated inputs: the server copy is the client copy re-parsed (new text
// uuids, some bodies extended) with missed cards inserted anywhere. For every
// shape, each client card that survives keeps its timestamp, only inserted
// cards get the adoption time, and the selection always names a server card.
describe("adoptServerTranscript — generated transcripts", () => {
  const SEED = 3292;
  const CASES = 400;

  function nextRandom(state: { value: number }): number {
    state.value = (state.value * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state.value / 2_147_483_648;
  }

  function randomCard(state: { value: number }, label: string): ToolResultComplete {
    const kind = Math.floor(nextRandom(state) * 3);
    if (kind === 0) return makeTextResult(`user ${label}`, "user");
    if (kind === 1) return makeTextResult(`reply ${label}`, "assistant");
    return toolCard(`tool-${label}`);
  }

  it(`holds for ${CASES} seeded cases (seed ${SEED})`, () => {
    const state = { value: SEED };
    Array.from({ length: CASES }, (_unused, caseIndex) => caseIndex).forEach((caseIndex) => {
      const clientCards = Array.from({ length: Math.floor(nextRandom(state) * 6) }, (_unused, index) => randomCard(state, `${caseIndex}-${index}`));
      const serverCards: ToolResultComplete[] = [];
      const insertedUuids = new Set<string>();
      clientCards.forEach((card) => {
        if (nextRandom(state) < 0.3) {
          const missed = randomCard(state, `${caseIndex}-missed-${serverCards.length}`);
          insertedUuids.add(missed.uuid);
          serverCards.push(missed);
        }
        const isText = card.toolName === "text-response";
        const extended = isText && nextRandom(state) < 0.5 ? { ...reparsed(card), message: `${card.message ?? ""} more` } : card;
        serverCards.push(isText ? (extended === card ? reparsed(card) : extended) : card);
      });
      const tail = makeErrorResult(`missed ${caseIndex}`);
      insertedUuids.add(tail.uuid);
      serverCards.push(tail);

      const selectionIndex = Math.floor(nextRandom(state) * (clientCards.length + 1));
      const client = clientView(clientCards, clientCards[selectionIndex]?.uuid ?? null);
      const adopted = adoptServerTranscript(client, serverCards, NOW_MS);
      const context = `seed ${SEED}, case ${caseIndex}`;

      assert.ok(
        serverCards.some((card) => card.uuid === adopted.selectedResultUuid),
        `selection must name a server card (${context})`,
      );
      serverCards.forEach((card) => {
        const stamp = adopted.resultTimestamps.get(card.uuid);
        if (insertedUuids.has(card.uuid)) assert.equal(stamp, NOW_MS, `inserted card gets adoption time (${context})`);
        else assert.notEqual(stamp, NOW_MS, `surviving card keeps its timestamp (${context})`);
      });
    });
  });
});
