import { fill } from "../fill";
import { characterCount } from "../text";
import { infoTag } from "../tags";
import type { CheckResult, DraftInput, EvalContext, Signals } from "../types";

export function infoLength(
  draft: DraftInput,
  _context: EvalContext,
  signals: Signals,
): CheckResult {
  const check = signals.checks.infoLength;
  return {
    id: "infoLength",
    title: check.title,
    status: "info",
    reason: fill(check.reason, { count: characterCount(draft.text) }),
    tags: [infoTag(signals, check.related)],
  };
}

export function infoMedia(
  _draft: DraftInput,
  context: EvalContext,
  signals: Signals,
): CheckResult {
  const check = signals.checks.infoMedia;
  return {
    id: "infoMedia",
    title: check.title,
    status: "info",
    reason: context.mediaAttached ? fill(check.reasonOn, {}) : fill(check.reasonOff, {}),
    tags: [infoTag(signals, check.related)],
  };
}
