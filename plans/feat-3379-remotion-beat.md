# feat: remotion beats in the mulmoscript-plugin tool description (#3379)

## Goal

mulmocast 2.13.0 adds `image: { type: "remotion", prompt, fps? }` plus a script-level
`remotionParams.brief`. Teach the agent about it through `presentMulmoScript`'s tool
description, without making it a default choice.

## Changes

1. `packages/plugins/mulmoscript-plugin/src/core/definition.ts` — add `remotion` to
   "Beat visual options", NOT marked PREFER: use only when the user asks for Remotion or is
   known to have it installed (the remotion packages are optional mulmocast deps the host does
   not ship; without them generation fails). Mention the cost (several `claude -p` calls per
   scene), `remotionParams.brief`, and that it cannot be combined with `moviePrompt`.
2. Dependency floors to `^2.13.0` for `mulmocast` / `@mulmocast/types`: plugin peers, root
   and launcher (the launcher must satisfy the plugin's peer range).
3. View: `beatMayHaveMovie` (`src/vue/helpers.ts`) only knew `moviePrompt` and animated
   `html_tailwind`, so a remotion beat's `_animated.mp4` was never probed. Add `remotion`.
   Server side needs nothing: mulmocast writes remotion output to
   `getBeatAnimatedVideoPath`, which `beatMovieOp` already checks, and the still lands on the
   normal beat `.png` path. Preview shows only title/description — no change.

## Not in scope

- Installing remotion packages in the host.
- MulmoTerminal guidance (receptron/mulmoterminal#2904).
