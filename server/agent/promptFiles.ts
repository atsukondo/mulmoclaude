// MulmoClaude's side of the plugin prompt split (`@mulmoclaude/core/prompt-files`):
// files go under `<workspace>/config/helps/plugins/<package>/`, and the agent is
// told the WORKSPACE-RELATIVE path. Its cwd is the workspace both natively and in
// Docker (`/home/node/mulmoclaude`), so the same string resolves in both — a host
// absolute path would not exist inside the container.

import path from "node:path";
import { syncPromptFiles, type PromptFilesSource } from "@mulmoclaude/core/prompt-files";
import { WORKSPACE_DIRS, workspacePath } from "../workspace/paths.js";
import { log } from "../system/logger/index.js";

const PROMPT_FILES_SUBDIR = "plugins";
const LOG_PREFIX = "prompt-files";

let agentDirByPackage: ReadonlyMap<string, string> = new Map();

/** The directory the agent reads `packageName`'s files from, or null when
 *  they were not written this session (its tools then keep the full prompt). */
export function agentPromptFilesDir(packageName: string | undefined): string | null {
  if (packageName === undefined) return null;
  return agentDirByPackage.get(packageName) ?? null;
}

/** Write every split-declaring package's files and remember where the agent
 *  finds them. A package that fails is logged and keeps its full prompt. */
export function syncHostPromptFiles(sources: readonly PromptFilesSource[], root = workspacePath): void {
  const relativeRoot = path.posix.join(WORKSPACE_DIRS.helps, PROMPT_FILES_SUBDIR);
  const { written, problems } = syncPromptFiles(path.join(root, ...relativeRoot.split("/")), sources);
  problems.forEach(({ packageName, problem }) => log.warn(LOG_PREFIX, "plugin prompt files skipped — full prompt kept", { packageName, problem }));
  agentDirByPackage = new Map([...written].map(([packageName, subdir]) => [packageName, path.posix.join(relativeRoot, subdir)]));
}
