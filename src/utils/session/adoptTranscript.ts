// Adopting the server's transcript after a reconnect catch-up (#2096) replaces
// the card list, but text / skill / error cards get a fresh uuid on every
// parse. Swapping the list alone therefore orphans every text card's timestamp
// and can leave the selection pointing at a uuid that no longer exists (#3292).
// This carries both across by aligning the server cards to the client's.

import type { ToolResultComplete } from "gui-chat-protocol/vue";
import { TEXT_LIKE_RESULT_TOOL_NAMES } from "../tools/result";

export interface TranscriptView {
  toolResults: ToolResultComplete[];
  selectedResultUuid: string | null;
  resultTimestamps: Map<string, number>;
}

/** Same card seen twice: identical uuid (tool results keep theirs), or the
 *  same kind of text card whose server body extends the client's — a dropped
 *  frame can leave the client with a truncated prefix. */
function isSameCard(clientCard: ToolResultComplete, serverCard: ToolResultComplete): boolean {
  if (clientCard.uuid === serverCard.uuid) return true;
  if (!TEXT_LIKE_RESULT_TOOL_NAMES.has(serverCard.toolName)) return false;
  if (clientCard.toolName !== serverCard.toolName || clientCard.title !== serverCard.title) return false;
  return (serverCard.message ?? "").startsWith(clientCard.message ?? "");
}

/** Server uuid → the client uuid it continues, matched in order. A server card
 *  with no counterpart is one the client missed and maps to nothing. */
export function alignServerToClient(clientResults: readonly ToolResultComplete[], serverResults: readonly ToolResultComplete[]): Map<string, string> {
  const serverToClient = new Map<string, string>();
  let clientIndex = 0;
  serverResults.forEach((serverCard) => {
    const clientCard = clientResults[clientIndex];
    if (clientCard === undefined || !isSameCard(clientCard, serverCard)) return;
    serverToClient.set(serverCard.uuid, clientCard.uuid);
    clientIndex += 1;
  });
  return serverToClient;
}

/** Where the selection lands: a user parked on the last card keeps following
 *  the conversation; any other choice is kept, on its new uuid; a selection
 *  whose card is gone falls back to the last card. */
function resolveAdoptedSelection(client: TranscriptView, serverResults: readonly ToolResultComplete[], serverToClient: Map<string, string>): string | null {
  const lastServerUuid = serverResults[serverResults.length - 1]?.uuid ?? null;
  const selected = client.selectedResultUuid;
  if (selected === null || selected === client.toolResults[client.toolResults.length - 1]?.uuid) return lastServerUuid;
  const match = serverResults.find((serverCard) => serverToClient.get(serverCard.uuid) === selected);
  return match?.uuid ?? lastServerUuid;
}

export function adoptServerTranscript(client: TranscriptView, serverResults: ToolResultComplete[], nowMs: number): TranscriptView {
  const serverToClient = alignServerToClient(client.toolResults, serverResults);
  const resultTimestamps = new Map<string, number>();
  serverResults.forEach((serverCard) => {
    const clientUuid = serverToClient.get(serverCard.uuid);
    const carried = clientUuid === undefined ? undefined : client.resultTimestamps.get(clientUuid);
    resultTimestamps.set(serverCard.uuid, carried ?? nowMs);
  });
  return {
    toolResults: serverResults,
    selectedResultUuid: resolveAdoptedSelection(client, serverResults, serverToClient),
    resultTimestamps,
  };
}
