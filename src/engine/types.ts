export type Status = "pass" | "warn" | "fail" | "info";

export interface Lines {
  0: number;
  1: number;
}

export interface Citation {
  path: string;
  lines: [number, number];
  note?: string;
  label?: string;
}

export interface SourcePin {
  repo: string;
  url: string;
  commit: string;
  commitDate: string;
  commitTimeUtc: string;
  researchedAt: string;
}

export interface WeightRow {
  id: string;
  label: string;
  weight: number;
  path: string;
  lines: [number, number];
  note?: string;
}

export interface ReplyRisk {
  id: string;
  summary: string;
  sources: Citation[];
}

export interface TypedNotPastedCheck {
  title: string;
  tag: "x-code";
  enabledByDefault: boolean;
  source: Citation;
  reasonPass: string;
  reasonWarn: string;
}

export interface SoundsHumanCheck {
  title: string;
  tag: "heuristic";
  enabledByDefault: boolean;
  heuristicNote: string;
  related: Citation;
  openers: string[];
  phrases: string[];
  reasonPass: string;
  reasonWarn: string;
}

export interface EngagementBaitCheck {
  title: string;
  tag: "x-code";
  enabledByDefault: boolean;
  source: Citation;
  detectorNote: string;
  phrases: string[];
  reasonPass: string;
  reasonFail: string;
}

export interface SpamHashtagsCheck {
  title: string;
  tag: "heuristic";
  enabledByDefault: boolean;
  heuristicNote: string;
  related: Citation;
  maxHashtags: number;
  reasonPass: string;
  reasonPassPlural: string;
  reasonWarn: string;
}

export interface SpamMentionsCheck {
  title: string;
  tag: "heuristic";
  enabledByDefault: boolean;
  heuristicNote: string;
  related: Citation;
  maxMentions: number;
  reasonPass: string;
  reasonWarn: string;
}

export interface SpamLinksCheck {
  title: string;
  tag: "heuristic";
  enabledByDefault: boolean;
  heuristicNote: string;
  related: Citation;
  reasonPass: string;
  reasonWarn: string;
}

export interface SpamDuplicateCheck {
  title: string;
  tag: "mixed";
  enabledByDefault: boolean;
  heuristicNote: string;
  source: Citation;
  minChars: number;
  reasonPass: string;
  reasonSkip: string;
  reasonWarn: string;
}

export interface ReplyPaceCheck {
  title: string;
  tag: "mixed";
  enabledByDefault: boolean;
  heuristicNote: string;
  source: Citation;
  defaultPerHour: number;
  defaultPerDay: number;
  reasonPass: string;
  reasonWarn: string;
}

export interface InvitesConversationCheck {
  title: string;
  tag: "heuristic";
  enabledByDefault: boolean;
  heuristicNote: string;
  experiencePatterns: string[];
  reasonPass: string;
  reasonWarn: string;
}

export interface InfoLengthCheck {
  title: string;
  tag: "info";
  related: Citation;
  reason: string;
}

export interface InfoMediaCheck {
  title: string;
  tag: "info";
  related: Citation;
  reasonOn: string;
  reasonOff: string;
}

export interface CheckTable {
  typedNotPasted: TypedNotPastedCheck;
  soundsHuman: SoundsHumanCheck;
  engagementBait: EngagementBaitCheck;
  spamHashtags: SpamHashtagsCheck;
  spamMentions: SpamMentionsCheck;
  spamLinks: SpamLinksCheck;
  spamDuplicate: SpamDuplicateCheck;
  replyPace: ReplyPaceCheck;
  invitesConversation: InvitesConversationCheck;
  infoLength: InfoLengthCheck;
  infoMedia: InfoMediaCheck;
}

export interface Signals {
  schemaVersion: 1;
  defaultSignalsUrl: string;
  caveat: string;
  source: SourcePin;
  weights: WeightRow[];
  replyRisks: ReplyRisk[];
  watchedPaths: string[];
  checks: CheckTable;
}

export interface DraftInput {
  text: string;
  pastedSnippets: string[];
  pasteUnreadable: boolean;
}

export interface EvalContext {
  mediaAttached: boolean;
  recentReplies: string[];
  sentTimestamps: number[];
  now: number;
}

export interface Settings {
  signalsUrl: string;
  pacePerHour: number;
  pacePerDay: number;
  enabled: Record<ToggleId, boolean>;
}

export type ToggleId =
  | "typedNotPasted"
  | "soundsHuman"
  | "engagementBait"
  | "spamHashtags"
  | "spamMentions"
  | "spamLinks"
  | "spamDuplicate"
  | "replyPace"
  | "invitesConversation";

export const TOGGLE_IDS: readonly ToggleId[] = [
  "typedNotPasted",
  "soundsHuman",
  "engagementBait",
  "spamHashtags",
  "spamMentions",
  "spamLinks",
  "spamDuplicate",
  "replyPace",
  "invitesConversation",
];

export interface TagChip {
  kind: "x-code" | "heuristic" | "info" | "context";
  label: string;
  url?: string;
}

export interface CheckResult {
  id: string;
  title: string;
  status: Status;
  reason: string;
  tags: TagChip[];
}

export interface SentReply {
  text: string;
  at: number;
}

export interface ReplyLog {
  sent: SentReply[];
}
