import { fill } from "../fill";
import { paceCounts } from "../text";
import { heuristicTag, xCodeTag } from "../tags";
import type { CheckResult, DraftInput, EvalContext, Settings, Signals } from "../types";

export function replyPace(
  _draft: DraftInput,
  context: EvalContext,
  signals: Signals,
  settings: Settings,
): CheckResult | null {
  const check = signals.checks.replyPace;
  if (!settings.enabled.replyPace) return null;
  const counts = paceCounts(context.sentTimestamps, context.now);
  const over = counts.hour > settings.pacePerHour || counts.day > settings.pacePerDay;
  return {
    id: "replyPace",
    title: check.title,
    status: over ? "warn" : "pass",
    reason: fill(over ? check.reasonWarn : check.reasonPass, {
      hourCount: counts.hour,
      hourLimit: settings.pacePerHour,
      dayCount: counts.day,
      dayLimit: settings.pacePerDay,
    }),
    tags: [xCodeTag(signals, check.source), heuristicTag()],
  };
}
