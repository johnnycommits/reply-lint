import { engagementBait } from "./checks/engagement-bait";
import { infoLength, infoMedia } from "./checks/info";
import { invitesConversation } from "./checks/invites-conversation";
import { replyPace } from "./checks/reply-pace";
import { soundsHuman } from "./checks/sounds-human";
import {
  spamDuplicate,
  spamHashtags,
  spamLinks,
  spamMentions,
} from "./checks/spam-shape";
import { typedNotPasted } from "./checks/typed-not-pasted";
import type { CheckResult, DraftInput, EvalContext, Settings, Signals } from "./types";

export function evaluate(
  draft: DraftInput,
  context: EvalContext,
  signals: Signals,
  settings: Settings,
): CheckResult[] {
  const scored = [
    typedNotPasted(draft, context, signals, settings),
    soundsHuman(draft, context, signals, settings),
    engagementBait(draft, context, signals, settings),
    spamHashtags(draft, context, signals, settings),
    spamMentions(draft, context, signals, settings),
    spamLinks(draft, context, signals, settings),
    spamDuplicate(draft, context, signals, settings),
    replyPace(draft, context, signals, settings),
    invitesConversation(draft, context, signals, settings),
  ].filter((result): result is CheckResult => result !== null);

  return [
    ...scored,
    infoLength(draft, context, signals),
    infoMedia(draft, context, signals),
  ];
}

export function summarize(results: readonly CheckResult[]): {
  fails: number;
  warns: number;
  passes: number;
} {
  return {
    fails: results.filter((result) => result.status === "fail").length,
    warns: results.filter((result) => result.status === "warn").length,
    passes: results.filter((result) => result.status === "pass").length,
  };
}
