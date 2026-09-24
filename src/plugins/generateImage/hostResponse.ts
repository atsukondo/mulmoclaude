// What the image route is allowed to answer, checked before the view renders it.
//
// `execute` spreads the response body into the tool result, and the view reads
// `data.imageData` out of it. A 200 whose body is not what this tool expects —
// a route that changed shape, a proxy that answered for it — would otherwise
// reach the panel as a blank image with no message to explain it.
//
// Ported from `@mulmochat-plugin/generate-image`, where the same guard covers
// the client-side `app.generateImage` callback. Every field the protocol
// declares is checked rather than only the ones read back here, so a body that
// carries something unexpected is refused rather than half-trusted. `jsonData`
// must be absent: this tool sends nothing structured to the LLM, which is what
// its `ToolResult<ImageToolData, never>` says.

import type { ToolResult } from "gui-chat-protocol";
import { isRecord } from "../../utils/types";
import type { ImageToolData } from "./definition";

const isOptionalString = (value: unknown): value is string | undefined => value === undefined || typeof value === "string";

const isOptionalBoolean = (value: unknown): value is boolean | undefined => value === undefined || typeof value === "boolean";

// `imageData` is the path the view renders, so an empty one is the blank panel
// this guard exists to prevent — the absent case is a body with no `data` at
// all, which the route sends when the model returned no image.
const isImageToolData = (value: unknown): value is ImageToolData =>
  isRecord(value) && typeof value.imageData === "string" && value.imageData.length > 0 && isOptionalString(value.prompt);

export const isGenerateImageResult = (value: unknown): value is ToolResult<ImageToolData, never> =>
  isRecord(value) &&
  typeof value.message === "string" &&
  isOptionalString(value.toolName) &&
  isOptionalString(value.uuid) &&
  isOptionalString(value.title) &&
  isOptionalString(value.action) &&
  isOptionalString(value.instructions) &&
  isOptionalBoolean(value.instructionsRequired) &&
  isOptionalBoolean(value.updating) &&
  isOptionalBoolean(value.cancelled) &&
  value.jsonData === undefined &&
  (value.data === undefined || isImageToolData(value.data)) &&
  (value.viewState === undefined || isRecord(value.viewState));
