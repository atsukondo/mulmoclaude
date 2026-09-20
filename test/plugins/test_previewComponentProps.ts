// Every plugin preview must declare the prop the host actually passes.
//
// `SessionSidebar.vue` renders previews through a DYNAMIC component:
//
//   <component :is="getPlugin(result.toolName)?.previewComponent" :result="result" />
//
// TypeScript cannot check the props of a `<component :is>`, so a preview can
// declare something else entirely and every gate stays green. The accounting
// preview did exactly that from its first commit and rendered a generic string
// for a year (#2716): it asked for `data` / `jsonData`, which nothing has ever
// passed.
//
// A compiled Vue component carries its declared props at runtime, and the
// published `dist` is plain JS, so this census needs no SFC loader.
//
// NOT covered: the host-local previews under `src/plugins/*` that import a
// `.vue` file directly (canvas, editImages, manageRoles, generateImage,
// manageSkills, presentCollection). `tsx --test` cannot load an SFC, so holding
// those needs a Vue-capable runner. This covers the packaged plugins, which is
// where the bug was and where new plugins are added.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Packaged plugins whose built `vue` entry exports a preview component. */
const PACKAGED_PLUGINS = ["accounting", "chart", "collection", "form", "html", "markdown", "mulmoscript", "shapescript"] as const;

// `spotify` is held out, and the reason is the finding rather than an excuse:
// its preview declares `selectedResult` — the prop name the VIEW slot takes
// (`App.vue`: `:selected-result`) — and reads `ok` / `error` off it, neither of
// which is on `ToolResult`. So it is the same class as #2716 but not the same
// one-line fix: someone has to establish where those fields actually arrive
// before renaming anything. Tracked as #3226; this list is a ratchet and the
// entry comes back the moment that lands.
const KNOWN_UNFIXED = ["spotify"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** Vue normalises `defineProps<{ result: T }>()` to `{ result: {} }` on the
 *  compiled component, so the declared NAMES survive into the bundle even
 *  though the types do not. Names are all this census needs. */
const declaredPropNames = (component: unknown): string[] | null => {
  if (!isRecord(component)) return null;
  const { props } = component;
  if (Array.isArray(props)) return props.filter((name): name is string => typeof name === "string");
  if (isRecord(props)) return Object.keys(props);
  return null;
};

const previewExportsOf = (moduleNamespace: Record<string, unknown>): [string, unknown][] =>
  Object.entries(moduleNamespace).filter(([name]) => /preview$/i.test(name));

describe("every packaged plugin preview declares the prop the sidebar passes", () => {
  it("the held-out list stays short and named", () => {
    // A ratchet with no assertion is a list that only ever grows.
    assert.deepEqual([...KNOWN_UNFIXED], ["spotify"], "add a tracking issue before holding another plugin out");
  });

  PACKAGED_PLUGINS.forEach((plugin) => {
    it(`${plugin}`, async () => {
      const entry = path.join(repoRoot, "packages/plugins", `${plugin}-plugin`, "dist/vue.js");
      assert.ok(existsSync(entry), `${entry} is missing — run \`yarn build:packages\` before this suite`);

      const moduleNamespace: Record<string, unknown> = await import(entry);
      const previews = previewExportsOf(moduleNamespace);
      assert.ok(previews.length > 0, `${plugin} exports no *Preview from dist/vue.js`);

      previews.forEach(([exportName, component]) => {
        const names = declaredPropNames(component);
        assert.ok(names !== null, `${plugin}: ${exportName} declares no props at all`);
        assert.ok(
          names.includes("result"),
          `${plugin}: ${exportName} declares [${names.join(", ")}] but the sidebar passes only \`result\`, so those props are always undefined (#2716)`,
        );
      });
    });
  });
});
