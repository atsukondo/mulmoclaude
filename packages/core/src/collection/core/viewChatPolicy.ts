// Whether a custom view's `__MC_VIEW.startChat` RUNS the prompt or leaves it as
// an editable draft (#3062). Pure + its own module so the one reading of the
// declaration is shared by every surface that renders a view, and is pinned by
// unit tests rather than by driving an iframe.

import type { CollectionCustomView } from "./schema";

/** True when this view's `startChat` should send. Default-deny: a view that does
 *  not declare `allowSendChat` drafts, so upgrading the host can never turn an
 *  already-shipped view's buttons into unreviewed agent turns.
 *
 *  Read from the SCHEMA — never from the message the iframe posts up. The view's
 *  code composes the prompt text; letting it also decide whether that text runs
 *  would put both halves of the decision inside the sandbox.
 *
 *  EVERY surface consults this, the phone included. The phone once always sent,
 *  on the grounds that it has no Enter key to press — but that made the same
 *  view behave differently depending on where it was opened, and it silently
 *  overrode default-deny on a device the author never tested. The phone is
 *  served the resolved flag in its view payload rather than re-reading the
 *  schema, because it never sees the schema. */
export function customViewSendsChat(view: Pick<CollectionCustomView, "allowSendChat">): boolean {
  return view.allowSendChat === true;
}
