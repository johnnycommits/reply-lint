import { fill } from "../fill";
import { findListedPhrase } from "../text";
import { xCodeTag } from "../tags";
import type { CheckResult, DraftInput, EvalContext, Settings, Signals } from "../types";

export function engagementBait(
  draft: DraftInput,
  _context: EvalContext,
  signals: Signals,
  settings: Settings,
): CheckResult | null {
  const check = signals.checks.engagementBait;
  if (!settings.enabled.engagementBait) return null;
  if (!draft.text.trim()) return null;
  const phrase = findListedPhrase(draft.text, check.phrases);
  return {
    id: "engagementBait",
    title: check.title,
    status: phrase ? "fail" : "pass",
    reason: phrase ? fill(check.reasonFail, { phrase }) : fill(check.reasonPass, {}),
    tags: [xCodeTag(signals, check.source)],
  };
}
