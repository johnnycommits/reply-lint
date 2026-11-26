import { fill } from "../fill";
import { countHashtags, countMentions, containsLink, isDuplicateText } from "../text";
import { contextTag, heuristicTag, xCodeTag } from "../tags";
import type { CheckResult, DraftInput, EvalContext, Settings, Signals } from "../types";

export function spamHashtags(
  draft: DraftInput,
  _context: EvalContext,
  signals: Signals,
  settings: Settings,
): CheckResult | null {
  const check = signals.checks.spamHashtags;
  if (!settings.enabled.spamHashtags) return null;
  if (!draft.text.trim()) return null;
  const count = countHashtags(draft.text);
  const over = count > check.maxHashtags;
  const template = over
    ? check.reasonWarn
    : count === 1
      ? check.reasonPass
      : check.reasonPassPlural;
  return {
    id: "spamHashtags",
    title: check.title,
    status: over ? "warn" : "pass",
    reason: fill(template, { count, max: check.maxHashtags }),
    tags: [heuristicTag(), contextTag(signals, check.related)],
  };
}

export function spamMentions(
  draft: DraftInput,
  _context: EvalContext,
  signals: Signals,
  settings: Settings,
): CheckResult | null {
  const check = signals.checks.spamMentions;
  if (!settings.enabled.spamMentions) return null;
  if (!draft.text.trim()) return null;
  const count = countMentions(draft.text);
  const over = count > check.maxMentions;
  return {
    id: "spamMentions",
    title: check.title,
    status: over ? "warn" : "pass",
    reason: fill(over ? check.reasonWarn : check.reasonPass, {
      count,
      max: check.maxMentions,
    }),
    tags: [heuristicTag(), contextTag(signals, check.related)],
  };
}

export function spamLinks(
  draft: DraftInput,
  _context: EvalContext,
  signals: Signals,
  settings: Settings,
): CheckResult | null {
  const check = signals.checks.spamLinks;
  if (!settings.enabled.spamLinks) return null;
  if (!draft.text.trim()) return null;
  const linked = containsLink(draft.text);
  return {
    id: "spamLinks",
    title: check.title,
    status: linked ? "warn" : "pass",
    reason: linked ? fill(check.reasonWarn, {}) : fill(check.reasonPass, {}),
    tags: [heuristicTag(), contextTag(signals, check.related)],
  };
}

export function spamDuplicate(
  draft: DraftInput,
  context: EvalContext,
  signals: Signals,
  settings: Settings,
): CheckResult | null {
  const check = signals.checks.spamDuplicate;
  if (!settings.enabled.spamDuplicate) return null;
  if (!draft.text.trim()) return null;
  const verdict = isDuplicateText(draft.text, context.recentReplies, check.minChars);
  const status = verdict === "duplicate" ? "warn" : "pass";
  const reason =
    verdict === "duplicate"
      ? check.reasonWarn
      : verdict === "skip"
        ? check.reasonSkip
        : check.reasonPass;
  return {
    id: "spamDuplicate",
    title: check.title,
    status,
    reason: fill(reason, {}),
    tags: [xCodeTag(signals, check.source), heuristicTag()],
  };
}
