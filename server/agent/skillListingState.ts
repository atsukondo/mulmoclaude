import { log } from "../system/logger/index.js";
import { isSkillListingHeavy, summariseSkillListing, type SkillListingSummary } from "./skillListing.js";

export interface LastSkillListing extends SkillListingSummary {
  heavy: boolean;
  /** ISO time of the turn whose `init` frame this came from. */
  seenAt: string;
}

let lastSkillListing: LastSkillListing | null = null;
// The warning names one count once, not every turn: the count only moves when
// the user installs or removes something, which is when it is worth repeating.
let lastWarnedSkillCount: number | null = null;

/** Record the skill summary of a raw CLI frame; a no-op for every frame but `init`. */
export function noteSkillListing(frame: unknown, now: Date = new Date()): void {
  const summary = summariseSkillListing(frame);
  if (!summary) return;
  const heavy = isSkillListingHeavy(summary);
  lastSkillListing = { ...summary, heavy, seenAt: now.toISOString() };
  log.debug("agent", "skill listing", { skillCount: summary.skillCount, plugins: summary.pluginNames });
  if (!heavy || lastWarnedSkillCount === summary.skillCount) return;
  lastWarnedSkillCount = summary.skillCount;
  log.warn("agent", "the CLI lists many skills on every request — Settings → Model can stop loading Claude Code's user settings and plugins", {
    skillCount: summary.skillCount,
    plugins: summary.pluginNames,
  });
}

/** The most recent turn's skill summary, or null before any turn ran. */
export function getLastSkillListing(): LastSkillListing | null {
  return lastSkillListing;
}

export function _resetSkillListingForTest(): void {
  lastSkillListing = null;
  lastWarnedSkillCount = null;
}
