// Whether a catch-up snapshot may replace the client's transcript. Adopting is
// only safe when the snapshot is both complete and current:
//
// - complete: while a turn runs, the server has not yet written the text still
//   streaming (its accumulator is flushed by the next non-text event or at run
//   end), so a mid-run snapshot is missing the card the user is watching. The
//   server says so in the snapshot itself; the client's own `isRunning` only
//   mirrors the session list and can lag, so either one saying "running" wins
//   (#3294).
// - current: live events that arrived while the fetch was in flight are not in
//   the snapshot; adopting it would drop them until the next refresh (#3295).

import type { ToolResultComplete } from "gui-chat-protocol/vue";
import type { SessionEntry } from "../../types/session";
import { EVENT_TYPES } from "../../types/events";
import { isRecord } from "../types";
import { shouldAdoptServerTranscript } from "./sessionEntries";

/** What the transcript looked like when the fetch started, held by reference.
 *  Every live change replaces a card, a card's `data`, or its `message` string
 *  (appending, `Object.assign`, slot replacement), so comparing those
 *  references catches it without every mutation site keeping a counter. */
export interface TranscriptSnapshot {
  cards: ToolResultComplete[];
  messages: (string | undefined)[];
  datas: unknown[];
}

export function captureTranscript(toolResults: readonly ToolResultComplete[]): TranscriptSnapshot {
  return { cards: [...toolResults], messages: toolResults.map((card) => card.message), datas: toolResults.map((card) => card.data) };
}

export function transcriptChangedSince(snapshot: TranscriptSnapshot, toolResults: readonly ToolResultComplete[]): boolean {
  if (snapshot.cards.length !== toolResults.length) return true;
  return toolResults.some((card, index) => card !== snapshot.cards[index] || card.message !== snapshot.messages[index] || card.data !== snapshot.datas[index]);
}

/** The server marks a snapshot taken during a run on its `session_meta` row.
 *  A response without the flag (an older server) counts as not running. */
export function snapshotTakenMidRun(entries: readonly SessionEntry[]): boolean {
  const meta = entries.find((entry) => entry.type === EVENT_TYPES.sessionMeta);
  return isRecord(meta) && meta.isRunning === true;
}

export type CatchUpDecision = "adopt" | "running" | "stale" | "not-richer";

export interface CatchUpState {
  clientRunning: boolean;
  snapshotMidRun: boolean;
  snapshotAtFetch: TranscriptSnapshot;
  clientResults: readonly ToolResultComplete[];
  serverResults: readonly ToolResultComplete[];
}

export function decideCatchUpAdoption(state: CatchUpState): CatchUpDecision {
  if (state.clientRunning || state.snapshotMidRun) return "running";
  if (transcriptChangedSince(state.snapshotAtFetch, state.clientResults)) return "stale";
  return shouldAdoptServerTranscript(state.serverResults, state.clientResults) ? "adopt" : "not-richer";
}

/** After a refresh, does the client verifiably hold everything the server has?
 *  Only then may a stop that was never announced by `session_finished` mark the
 *  session read — otherwise the finished turn could be cleared unseen. `null`
 *  means the refresh did not get as far as deciding. */
export function holdsWholeTurn(decision: CatchUpDecision | null): boolean {
  return decision === "adopt" || decision === "not-richer";
}
