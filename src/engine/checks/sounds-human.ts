import { fill } from "../fill";
import { findListedPhrase, findOpener } from "../text";
import { contextTag, heuristicTag } from "../tags";
import type { CheckResult, DraftInput, EvalContext, Settings, Signals } from "../types";

export function soundsHuman(
  draft: DraftInput,
  _context: EvalContext,
  signals: Signals,
  settings: Settings,
): CheckResult | null {
  const check = signals.checks.soundsHuman;
  if (!settings.enabled.soundsHuman) return null;
  if (!draft.text.trim()) return null;
  const phrase =
    findOpener(draft.text, check.openers) ?? findListedPhrase(draft.text, check.phrases);
  return {
    id: "soundsHuman",
    title: check.title,
    status: phrase ? "warn" : "pass",
    reason: phrase ? fill(check.reasonWarn, { phrase }) : fill(check.reasonPass, {}),
    tags: [heuristicTag(), contextTag(signals, check.related)],
  };
}
