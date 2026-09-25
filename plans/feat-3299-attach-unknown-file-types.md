# feat: accept attachments of unknown file types as files (#3299)

Origin: #3297 (`.mpp`). Core does not learn `.mpp`; it only stops refusing files it cannot read.

## Behaviour

| type | before | after |
|---|---|---|
| readable (image, PDF, DOCX, XLSX, PPTX, text/*, JSON/XML/YAML/TOML) | inlined as content | unchanged |
| anything else | rejected in the chat input | stored under `data/attachments/`, announced to the agent by path, content not sent; the chip says "file only" |

## Changes

1. `server/utils/files/attachment-mime.ts` (new, pure): the MIME ↔ extension tables moved verbatim from `attachment-store.ts`, plus `storedExtensionFor(mimeType, filename)` — known MIME → its extension; unknown MIME → the filename's extension when it is short/alphanumeric and NOT a known extension; else `.bin`.
2. `saveAttachment(base64, mimeType, filename?)` uses it. The upload route and `persistInlineBytesAsPaths` pass the filename.
3. `prepareRequestExtras`: an existing file whose MIME cannot be inferred emits its marker but no content block.
4. Client: `isReadableAttachmentType` pulled out of `ChatInput.vue` into `src/utils/attachment/readableTypes.ts`; `validateFile` no longer rejects by type; the picker's `accept` filter is dropped; `ChatAttachmentPreview` shows a "file only" note for unreadable types. i18n: `unsupportedFileType` removed, `fileOnlyAttachment` added in all 8 locales.

## Why a known extension is never taken from the filename

A client-declared `application/octet-stream` with `x.html` must not land as `.html` — the extension decides how the workspace later serves/renders the file.

## Tests

- unit: `storedExtensionFor` both directions (known MIME, unknown MIME + safe/unsafe/known/missing ext).
- unit: `prepareRequestExtras` emits a marker without bytes for an unknown-extension file; drops a missing one.
- unit: `isReadableAttachmentType`.
- e2e: the three "unsupported type → error" specs become "unknown type → chip with file-only note".
