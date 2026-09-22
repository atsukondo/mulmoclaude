// Which role a caller OTHER than the role selector may start a chat in.
//
// A plugin — and through it a sandboxed custom view, which names the role in a
// postMessage — can ask for a role by id. Roles carry their own system prompt,
// tool set and model, so honouring an id that names no selectable role would let
// the caller pick an assistant the user cannot reach from the selector. Debug
// roles are excluded for that reason: they are in the merged list but the
// selector hides them outside dev mode, and the remote-host startChat handler
// refuses them on the same grounds.
//
// Returns `undefined` rather than a default, so each entry point keeps its own
// fallback: a new chat inherits the selector's current pick, a draft opens in
// General.

/** The part of a role this decision reads — the merged list satisfies it. */
export interface SelectableRole {
  id: string;
  isDebugRole?: boolean | undefined;
}

export function resolveRequestedRoleId(requested: string | undefined, roles: readonly SelectableRole[]): string | undefined {
  const named = roles.find((role) => role.id === requested);
  return named && named.isDebugRole !== true ? named.id : undefined;
}
