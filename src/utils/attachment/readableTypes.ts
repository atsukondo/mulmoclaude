// Attachment types whose content is inlined for the model (see
// server/agent/attachmentConverter.ts). Any other type is still attached,
// but as a file only: stored in the workspace and handed to the agent by path.

const READABLE_MIME_PREFIXES = ["image/", "text/"];
const READABLE_MIME_EXACT = new Set([
  "application/pdf",
  "application/json",
  "application/xml",
  "application/x-yaml",
  "application/toml",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export function isReadableAttachmentType(mime: string): boolean {
  return READABLE_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)) || READABLE_MIME_EXACT.has(mime);
}
