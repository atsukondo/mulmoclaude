import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inferMimeFromExtension, storedExtensionFor } from "../../../server/utils/files/attachment-mime.ts";

const OCTET = "application/octet-stream";

describe("storedExtensionFor — known MIME", () => {
  it("uses the MIME's extension and ignores the filename", () => {
    assert.equal(storedExtensionFor("application/pdf", "report.mpp"), ".pdf");
    assert.equal(storedExtensionFor("image/jpeg", "photo.png"), ".jpg");
    assert.equal(storedExtensionFor("text/csv", undefined), ".csv");
  });
});

describe("storedExtensionFor — unknown MIME keeps the original extension", () => {
  for (const [filename, expected] of [
    ["schedule.mpp", ".mpp"],
    ["SCHEDULE.MPP", ".mpp"],
    ["archive.tar.gz", ".gz"],
    ["model.3dm", ".3dm"],
  ] as const) {
    it(`${filename} → ${expected}`, () => {
      assert.equal(storedExtensionFor(OCTET, filename), expected);
      assert.equal(storedExtensionFor("", filename), expected);
    });
  }
});

describe("storedExtensionFor — unknown MIME falls back to .bin", () => {
  for (const filename of [undefined, "", "noext", ".hidden", "trailingdot.", "weird.m-p", "space.m p", "long.abcdefghijklmnopq", "dir/../x.m$p", "x.日本"]) {
    it(`filename ${JSON.stringify(filename)}`, () => {
      assert.equal(storedExtensionFor(OCTET, filename), ".bin");
    });
  }

  for (const filename of ["page.html", "icon.svg", "doc.pdf", "a.json", "x.JPG", "sheet.xlsx"]) {
    it(`a known extension is never taken from the filename: ${filename}`, () => {
      assert.equal(storedExtensionFor(OCTET, filename), ".bin");
    });
  }
});

describe("storedExtensionFor — every stored extension round-trips or stays unknown", () => {
  it("a kept extension is one inferMimeFromExtension does not know", () => {
    ["a.mpp", "b.xer", "c.dwg", "d.zip"].forEach((filename) => {
      const ext = storedExtensionFor(OCTET, filename);
      assert.equal(inferMimeFromExtension(`x${ext}`), undefined);
    });
  });
});
