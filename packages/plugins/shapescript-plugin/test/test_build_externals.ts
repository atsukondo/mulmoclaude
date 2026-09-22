// Which three specifiers the build leaves to the consumer. Exactly the bare
// `three` must be external: bundling it again gives a host that draws with its
// own three a second copy, and externalising `three-bvh-csg` (no `exports`, so
// Node loads its UMD build, which requires three.cjs) splits three in Node.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfigFromFile } from "vite";

type External = string | RegExp;

const PACKAGE_DIR = join(import.meta.dirname, "..");
const SRC = join(PACKAGE_DIR, "src");
const THREE_SPECIFIER = /from\s+["'](three[^"']*)["']/g;

// Loaded the way `vite build` loads it: the config uses `__dirname`, which only
// Vite's loader defines for an ESM package.
async function externals(): Promise<External[]> {
  const loaded = await loadConfigFromFile({ command: "build", mode: "production" }, join(PACKAGE_DIR, "vite.config.ts"), PACKAGE_DIR, "silent");
  const external = loaded?.config.build?.rollupOptions?.external;
  assert.ok(Array.isArray(external), "vite.config.ts must declare external as a list");
  return external.filter((entry): entry is External => typeof entry === "string" || entry instanceof RegExp);
}

/** Rollup's rule for a list of externals: a string matches exactly, a RegExp by test. */
function isExternal(id: string, list: readonly External[]): boolean {
  return list.some((entry) => (typeof entry === "string" ? entry === id : entry.test(id)));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|vue)$/.test(entry.name) ? [path] : [];
  });
}

function threeSpecifiersInSource(): string[] {
  const found = sourceFiles(SRC).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(THREE_SPECIFIER)].flatMap((match) => (match[1] === undefined ? [] : [match[1]])),
  );
  return [...new Set(found)].sort();
}

describe("build externals", () => {
  it("leaves the bare three to the consumer", async () => {
    assert.equal(isExternal("three", await externals()), true);
  });

  it("bundles every other three specifier the source imports", async () => {
    const list = await externals();
    const specifiers = threeSpecifiersInSource();
    assert.ok(specifiers.includes("three-bvh-csg"), "the scan must see the CSG helper, or this test checks nothing");
    assert.ok(
      specifiers.some((specifier) => specifier.startsWith("three/examples/")),
      "the scan must see a three/examples module, or this test checks nothing",
    );
    const wronglyExternal = specifiers.filter((specifier) => specifier !== "three" && isExternal(specifier, list));
    assert.deepEqual(wronglyExternal, []);
  });

  it("bundles three-mesh-bvh, which the source never names but the CSG helper imports", async () => {
    assert.equal(isExternal("three-mesh-bvh", await externals()), false);
  });
});

describe("isExternal", () => {
  it("matches a string entry exactly, not by prefix", () => {
    assert.equal(isExternal("three", ["three"]), true);
    assert.equal(isExternal("three-bvh-csg", ["three"]), false);
    assert.equal(isExternal("three/examples/jsm/exporters/STLExporter.js", ["three"]), false);
  });

  it("matches a RegExp entry by test", () => {
    assert.equal(isExternal("three/examples/jsm/exporters/STLExporter.js", [/^three(\/|$)/]), true);
    assert.equal(isExternal("three-bvh-csg", [/^three(\/|$)/]), false);
  });

  it("matches nothing against an empty list", () => {
    assert.equal(isExternal("three", []), false);
  });
});
