// Whether a catch-up snapshot may replace the client's transcript. Adopting is
// only safe when the snapshot is both complete and current:
//
// - complete: while a turn runs, the server has not yet written the text still
//   streaming (its accumulator is flushed by the next non-text event or at run
//   end), so a mid-run snapshot is missing the card the user is watching. The
//   live stream is authoritative until the run finishes, and the post-run
//   refresh recovers anything missed (#3294).
// - current: live events that arrived while the fetch was in flight are not in
//   the snapshot; adopting it would drop them until the next refresh (#3295).

import type { ToolResultComplete } from "gui-chat-protocol/vue";
import { shouldAdoptServerTranscript } from "./sessionEntries";

/** Changes whenever a live event changes the transcript: a card added or
 *  replaced, or the streaming card growing. */
export function transcriptRevision(toolResults: readonly ToolResultComplete[]): string {
  const lastCard = toolResults[toolResults.length - 1];
  return `${toolResults.length}:${lastCard?.uuid ?? ""}:${lastCard?.message?.length ?? 0}`;
}

export type CatchUpDecision = "adopt" | "running" | "stale" | "not-richer";

export interface CatchUpState {
  isRunning: boolean;
  revisionAtFetch: string;
  clientResults: readonly ToolResultComplete[];
  serverResults: readonly ToolResultComplete[];
}

export function decideCatchUpAdoption(state: CatchUpState): CatchUpDecision {
  if (state.isRunning) return "running";
  if (transcriptRevision(state.clientResults) !== state.revisionAtFetch) return "stale";
  return shouldAdoptServerTranscript(state.serverResults, state.clientResults) ? "adopt" : "not-richer";
}
