import type { ToolResult } from "gui-chat-protocol";
import type { PluginRegistration, ToolPlugin } from "../../tools/types";
import toolDefinition, { TOOL_NAME } from "./definition";
import type { ImageToolData } from "./definition";
import { makePostExecute } from "../execute";
import { isGenerateImageResult } from "./hostResponse";
import { wrapWithScope } from "../scope";
import { makeUuid } from "../../utils/id";
import type { ImageEndpoints } from "../editImages/definition";
import View from "./View.vue";
import Preview from "./Preview.vue";

function createUploadedImageResult(imageData: string, fileName: string, prompt: string): ToolResult<ImageToolData, never> {
  return {
    toolName: TOOL_NAME,
    data: { imageData, prompt },
    message: "",
    title: fileName,
  };
}

const postToImageRoute = makePostExecute<ImageEndpoints, ImageToolData>("image", "generate", TOOL_NAME);

const generateImagePlugin: ToolPlugin<ImageToolData> = {
  toolDefinition,

  // A body the route was not supposed to send becomes a message rather than a
  // blank panel: the view renders `data.imageData`, and nothing downstream
  // checks that it arrived.
  execute: async (context, args) => {
    const result = await postToImageRoute(context, args);
    if (isGenerateImageResult(result)) return result;
    return { toolName: TOOL_NAME, uuid: makeUuid(), message: "The image service answered with an unrecognized response." };
  },

  isEnabled: () => true,
  generatingMessage: "Generating image...",
  inputHandlers: [
    {
      type: "file",
      acceptedTypes: ["image/png", "image/jpeg"],
      handleInput: (fileData: string, fileName: string) => createUploadedImageResult(fileData, fileName, ""),
    },
    {
      type: "clipboard-image",
      handleInput: (imageData: string) => createUploadedImageResult(imageData, "clipboard-image.png", ""),
    },
  ],
  viewComponent: wrapWithScope("image", View),
  previewComponent: wrapWithScope("image", Preview),
};
export { TOOL_NAME };

export const REGISTRATION: PluginRegistration = {
  toolName: TOOL_NAME,
  entry: generateImagePlugin,
};
