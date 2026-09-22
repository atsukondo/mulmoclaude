// `firebase` is an OPTIONAL peer of `@mulmoclaude/core` — so the entry points
// that do not need Firestore have to LOAD without it (#3263).
//
// Why a child process with a resolution hook, rather than reading the source:
// the invariant was already WRITTEN in `collection/server/index.ts`, and it was
// broken seven lines below the sentence stating it. Nothing that reads the tree
// notices — `typecheck` passes because types erase, and this repository's own
// tests pass because this repository installs firebase. The only check that
// bites is loading the built entry with the package made unresolvable, which is
// exactly what a consumer without it does. `@receptron/sharedapp` is one: a
// pure projection library with no I/O and no Firestore, where core 5 failed at
// load with `ERR_MODULE_NOT_FOUND` for every module reachable from this entry.
//
// This runs against `packages/core/dist`, the artifact that ships — CI builds
// the workspace packages before the test step, so what it reads there is this
// commit. Run by hand on a tree whose `dist` predates your edit, it answers for
// the OLD build and says so nowhere: `yarn build:packages` first. A missing
// `dist` fails loudly, which is the case worth having loud; a stale one cannot
// be told apart from a fresh one by reading it.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REGISTER_HOOKS = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", "noFirebaseRegister.mjs")).href;

/** Fences the child's answer off from anything else it may print. */
const MARKER = "__EXPORTS__";

/** Import one subpath of the package in a child whose `firebase` cannot be
 *  resolved. Returns what a consumer would see: the names the entry exported,
 *  or the load failure. */
function importWithoutFirebase(subpath: string): { ok: boolean; names: string[]; stderr: string } {
  // The names are fenced by a marker rather than taken as the whole of stdout:
  // a module that logged a line on import would otherwise turn a real result
  // into a `JSON.parse` crash, which reads as a broken test rather than as
  // whatever it actually is.
  const script = `
    const entry = await import(${JSON.stringify(subpath)});
    process.stdout.write("\\n${MARKER}" + JSON.stringify(Object.keys(entry)));
  `;
  const child = spawnSync(process.execPath, ["--import", REGISTER_HOOKS, "--input-type=module", "-e", script], {
    cwd: resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."),
    encoding: "utf-8",
  });
  const fenced = (child.stdout ?? "").split("\n").find((line) => line.startsWith(MARKER));
  const failure = child.error === undefined ? (child.stderr ?? "") : `${child.error.message}\n${child.stderr ?? ""}`;
  if (child.status !== 0 || fenced === undefined) return { ok: false, names: [], stderr: failure };
  const names: unknown = JSON.parse(fenced.slice(MARKER.length));
  return { ok: true, names: Array.isArray(names) ? names.map(String) : [], stderr: failure };
}

describe("the optional `firebase` peer (#3263)", () => {
  // THE CONTROL, and it is not decoration: without it a green result above
  // could mean "the hook never fired" just as easily as "the entry is clean".
  // `collection/firestore` is the subpath whose NAME says it needs the SDK, so
  // it is the one place the refusal must still happen.
  it("is genuinely unresolvable in the child — `collection/firestore` still fails", () => {
    const loaded = importWithoutFirebase("@mulmoclaude/core/collection/firestore");
    assert.equal(loaded.ok, false, "expected the SDK-bound subpath to fail without firebase");
    assert.match(loaded.stderr, /ERR_MODULE_NOT_FOUND/);
    assert.match(loaded.stderr, /firebase/);
  });

  it("does not gate `collection/server` — it loads with firebase absent", () => {
    const loaded = importWithoutFirebase("@mulmoclaude/core/collection/server");
    assert.ok(loaded.ok, `collection/server must load without firebase, got:\n${loaded.stderr}`);
  });

  it("serves the entry's whole surface, not a subset that happens to link", () => {
    const loaded = importWithoutFirebase("@mulmoclaude/core/collection/server");
    // `parseAppManifest` is why this is load-bearing rather than tidiness: it
    // exists on NO other subpath, so a consumer that cannot load this entry has
    // no way around it. `storeFor` is the module that carried the SDK import in
    // (the backend registry names the Firestore store), and `sharedItemsPath`
    // is the value the barrel re-exports from it.
    ["parseAppManifest", "storeFor", "sharedItemsPath", "discoverCollections"].forEach((name) => {
      assert.ok(loaded.names.includes(name), `expected '${name}' among the entry's exports`);
    });
  });
});
