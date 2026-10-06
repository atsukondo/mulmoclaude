// presentMulmoScript splits its system-prompt guidance: a short `promptCompact`
// is injected, and the full reference ships as a prompt file. The MCP tool
// description stays the full reference, so a host that ignores the split — or
// a model loading the tool via ToolSearch — still sees everything.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PROMPT_FILES_DIR_PLACEHOLDER, readPromptSplit } from "@mulmoclaude/core/prompt-files";
import { TOOL_DEFINITION } from "../src/core/definition";

describe("presentMulmoScript prompt split", () => {
  it("is a valid split, so a supporting host injects the compact text", () => {
    assert.ok(readPromptSplit(TOOL_DEFINITION));
  });

  it("ships the full reference — the same text as the tool description — as its prompt file", () => {
    assert.deepEqual(Object.values(TOOL_DEFINITION.promptFiles), [TOOL_DEFINITION.description]);
  });

  it("points the agent at that file through the placeholder, never a literal path", () => {
    const [fileName] = Object.keys(TOOL_DEFINITION.promptFiles);
    assert.ok(TOOL_DEFINITION.promptCompact.includes(`${PROMPT_FILES_DIR_PLACEHOLDER}/${fileName}`));
    assert.ok(TOOL_DEFINITION.promptCompact.length < TOOL_DEFINITION.description.length);
  });
});
