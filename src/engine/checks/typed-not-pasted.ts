import { fill } from "../fill";
import { pastedStillPresent } from "../text";
import { xCodeTag } from "../tags";
import type { CheckResult, DraftInput, EvalContext, Settings, Signals } from "../types";

export function typedNotPasted(
  draft: DraftInput,
  _context: EvalContext,
  signals: Signals,
  settings: Settings,
): CheckResult | null {
  const check = signals.checks.typedNotPasted;
  if (!settings.enabled.typedNotPasted) return null;
  if (!draft.text.trim()) return null;
  const pasted = pastedStillPresent(
    draft.text,
    draft.pastedSnippets,
    draft.pasteUnreadable,
  );
  return {
    id: "typedNotPasted",
    title: check.title,
    status: pasted ? "warn" : "pass",
    reason: pasted ? fill(check.reasonWarn, {}) : fill(check.reasonPass, {}),
    tags: [xCodeTag(signals, check.source)],
  };
}
