import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isReadableAttachmentType } from "../../../src/utils/attachment/readableTypes.ts";

describe("isReadableAttachmentType", () => {
  for (const mime of [
    "image/png",
    "image/heic",
    "text/plain",
    "text/csv",
    "application/pdf",
    "application/json",
    "application/xml",
    "application/x-yaml",
    "application/toml",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]) {
    it(`reads ${mime}`, () => assert.equal(isReadableAttachmentType(mime), true));
  }

  for (const mime of ["", "application/octet-stream", "application/zip", "application/vnd.ms-project", "application/msword", "video/mp4", "IMAGE/PNG"]) {
    it(`file only: ${JSON.stringify(mime)}`, () => assert.equal(isReadableAttachmentType(mime), false));
  }
});
