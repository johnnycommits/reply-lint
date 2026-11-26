import { fill } from "../fill";
import { hasNumber, hasQuestion, matchesExperience } from "../text";
import { heuristicTag } from "../tags";
import type { CheckResult, DraftInput, EvalContext, Settings, Signals } from "../types";

export function invitesConversation(
  draft: DraftInput,
  _context: EvalContext,
  signals: Signals,
  settings: Settings,
): CheckResult | null {
  const check = signals.checks.invitesConversation;
  if (!settings.enabled.invitesConversation) return null;
  if (!draft.text.trim()) return null;
  const specific =
    hasQuestion(draft.text) ||
    hasNumber(draft.text) ||
    matchesExperience(draft.text, check.experiencePatterns);
  return {
    id: "invitesConversation",
    title: check.title,
    status: specific ? "pass" : "warn",
    reason: specific ? fill(check.reasonPass, {}) : fill(check.reasonWarn, {}),
    tags: [heuristicTag()],
  };
}
