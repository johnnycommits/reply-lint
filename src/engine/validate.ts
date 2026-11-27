import type { Signals, ToggleId } from "./types";
import { TOGGLE_IDS } from "./types";

export interface ValidSignals {
  ok: true;
  signals: Signals;
}

export interface InvalidSignals {
  ok: false;
  error: string;
}

const COMMIT = /^[0-9a-f]{40}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const SCORED_TAGS: Record<ToggleId, string> = {
  typedNotPasted: "x-code",
  soundsHuman: "heuristic",
  engagementBait: "x-code",
  spamHashtags: "heuristic",
  spamMentions: "heuristic",
  spamLinks: "heuristic",
  spamDuplicate: "mixed",
  replyPace: "mixed",
  invitesConversation: "heuristic",
};

export function validateSignals(input: unknown): ValidSignals | InvalidSignals {
  try {
    return validateSignalsInner(input);
  } catch (error) {
    if (error instanceof ValidationError) return fail(error.message);
    throw error;
  }
}

function validateSignalsInner(input: unknown): ValidSignals | InvalidSignals {
  if (!isRecord(input)) return fail("signals must be an object");
  if (input.schemaVersion !== 1) return fail("schemaVersion must be 1");
  if (
    typeof input.defaultSignalsUrl !== "string" ||
    !input.defaultSignalsUrl.startsWith("https://")
  ) {
    return fail("defaultSignalsUrl must be an https URL");
  }
  if (typeof input.caveat !== "string" || input.caveat.length === 0) {
    return fail("caveat is required");
  }

  const source = readSource(input.source);
  if (typeof source === "string") return fail(source);

  const weights = readWeights(input.weights);
  if (typeof weights === "string") return fail(weights);

  const replyRisks = readRisks(input.replyRisks);
  if (typeof replyRisks === "string") return fail(replyRisks);

  if (!Array.isArray(input.watchedPaths) || input.watchedPaths.length === 0) {
    return fail("watchedPaths must be a non-empty array");
  }
  if (!input.watchedPaths.every((path) => typeof path === "string" && path.length > 0)) {
    return fail("watchedPaths entries must be strings");
  }

  const checks = readChecks(input.checks);
  if (typeof checks === "string") return fail(checks);

  const signals: Signals = {
    schemaVersion: 1,
    defaultSignalsUrl: input.defaultSignalsUrl,
    caveat: input.caveat,
    source,
    weights,
    replyRisks,
    watchedPaths: input.watchedPaths,
    checks,
  };
  return { ok: true, signals };
}

function readSource(input: unknown): Signals["source"] | string {
  if (!isRecord(input)) return "source must be an object";
  if (
    typeof input.repo !== "string" ||
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(input.repo)
  ) {
    return "source.repo must look like owner/name";
  }
  if (typeof input.url !== "string" || !input.url.startsWith("https://")) {
    return "source.url must be https";
  }
  if (typeof input.commit !== "string" || !COMMIT.test(input.commit)) {
    return "source.commit must be a 40-character sha";
  }
  if (typeof input.commitDate !== "string" || !DAY.test(input.commitDate)) {
    return "source.commitDate must be YYYY-MM-DD";
  }
  if (typeof input.commitTimeUtc !== "string" || input.commitTimeUtc.length === 0) {
    return "source.commitTimeUtc is required";
  }
  if (typeof input.researchedAt !== "string" || !DAY.test(input.researchedAt)) {
    return "source.researchedAt must be YYYY-MM-DD";
  }
  return {
    repo: input.repo,
    url: input.url,
    commit: input.commit,
    commitDate: input.commitDate,
    commitTimeUtc: input.commitTimeUtc,
    researchedAt: input.researchedAt,
  };
}

function readWeights(input: unknown): Signals["weights"] | string {
  if (!Array.isArray(input) || input.length === 0)
    return "weights must be a non-empty array";
  const rows: Signals["weights"] = [];
  const seen = new Set<string>();
  for (const row of input) {
    if (!isRecord(row)) return "each weight must be an object";
    if (typeof row.id !== "string" || row.id.length === 0) return "weight.id is required";
    if (seen.has(row.id)) return `duplicate weight id ${row.id}`;
    seen.add(row.id);
    if (typeof row.label !== "string" || row.label.length === 0)
      return "weight.label is required";
    if (typeof row.weight !== "number" || !Number.isFinite(row.weight)) {
      return `weight ${row.id} must be a finite number`;
    }
    const lines = readLines(row.lines);
    if (typeof lines === "string") return `weight ${row.id}: ${lines}`;
    if (typeof row.path !== "string" || row.path.length === 0)
      return "weight.path is required";
    const note = optionalString(row.note);
    if (note === false) return `weight ${row.id} note must be a string`;
    rows.push({
      id: row.id,
      label: row.label,
      weight: row.weight,
      path: row.path,
      lines,
      ...(note ? { note } : {}),
    });
  }
  return rows;
}

function readRisks(input: unknown): Signals["replyRisks"] | string {
  if (!Array.isArray(input) || input.length === 0)
    return "replyRisks must be a non-empty array";
  const risks: Signals["replyRisks"] = [];
  for (const risk of input) {
    if (!isRecord(risk)) return "each replyRisk must be an object";
    if (typeof risk.id !== "string" || risk.id.length === 0)
      return "replyRisk.id is required";
    if (typeof risk.summary !== "string" || risk.summary.length === 0) {
      return "replyRisk.summary is required";
    }
    if (!Array.isArray(risk.sources) || risk.sources.length === 0) {
      return `replyRisk ${risk.id} needs sources`;
    }
    const sources = [];
    for (const source of risk.sources) {
      const citation = readCitation(source, false);
      if (typeof citation === "string") return `replyRisk ${risk.id}: ${citation}`;
      sources.push(citation);
    }
    risks.push({ id: risk.id, summary: risk.summary, sources });
  }
  return risks;
}

function readChecks(input: unknown): Signals["checks"] | string {
  if (!isRecord(input)) return "checks must be an object";
  const keys = Object.keys(input);
  const expected = [...TOGGLE_IDS, "infoLength", "infoMedia"];
  for (const key of expected) {
    if (!(key in input)) return `checks.${key} is required`;
  }
  for (const key of keys) {
    if (!expected.includes(key)) return `unknown check ${key}`;
  }

  const typed = readSimpleCheck(input.typedNotPasted, "typedNotPasted", [
    "reasonPass",
    "reasonWarn",
  ]);
  if (typeof typed === "string") return typed;
  const sounds = readSoundsHuman(input.soundsHuman);
  if (typeof sounds === "string") return sounds;
  const bait = readBait(input.engagementBait);
  if (typeof bait === "string") return bait;
  const hashtags = readCountCheck(input.spamHashtags, "spamHashtags", "maxHashtags", [
    "reasonPass",
    "reasonPassPlural",
    "reasonWarn",
  ]);
  if (typeof hashtags === "string") return hashtags;
  const mentions = readCountCheck(input.spamMentions, "spamMentions", "maxMentions", [
    "reasonPass",
    "reasonWarn",
  ]);
  if (typeof mentions === "string") return mentions;
  const links = readHeuristic(input.spamLinks, "spamLinks", ["reasonPass", "reasonWarn"]);
  if (typeof links === "string") return links;
  const duplicate = readDuplicate(input.spamDuplicate);
  if (typeof duplicate === "string") return duplicate;
  const pace = readPace(input.replyPace);
  if (typeof pace === "string") return pace;
  const conversation = readConversation(input.invitesConversation);
  if (typeof conversation === "string") return conversation;
  const infoLength = readInfoLength(input.infoLength);
  if (typeof infoLength === "string") return infoLength;
  const infoMedia = readInfoMedia(input.infoMedia);
  if (typeof infoMedia === "string") return infoMedia;

  return {
    typedNotPasted: typed,
    soundsHuman: sounds,
    engagementBait: bait,
    spamHashtags: hashtags,
    spamMentions: mentions,
    spamLinks: links,
    spamDuplicate: duplicate,
    replyPace: pace,
    invitesConversation: conversation,
    infoLength,
    infoMedia,
  };
}

function readSimpleCheck(
  input: unknown,
  id: ToggleId,
  reasons: string[],
): Signals["checks"]["typedNotPasted"] | string {
  if (!isRecord(input)) return `checks.${id} must be an object`;
  if (input.tag !== SCORED_TAGS[id]) return `checks.${id}.tag must be ${SCORED_TAGS[id]}`;
  const title = requiredString(input.title, `checks.${id}.title`);
  if (typeof title !== "string") return title;
  if (typeof input.enabledByDefault !== "boolean") {
    return `checks.${id}.enabledByDefault must be boolean`;
  }
  const source = readCitation(input.source, false);
  if (typeof source === "string") return `checks.${id}: ${source}`;
  const copy: Record<string, string> = {};
  for (const reason of reasons) {
    const value = requiredString(input[reason], `checks.${id}.${reason}`);
    if (typeof value !== "string") return value;
    copy[reason] = value;
  }
  return {
    title,
    tag: "x-code",
    enabledByDefault: input.enabledByDefault,
    source,
    reasonPass: copy.reasonPass ?? "",
    reasonWarn: copy.reasonWarn ?? "",
  };
}

function readSoundsHuman(input: unknown): Signals["checks"]["soundsHuman"] | string {
  const base = readHeuristicBase(input, "soundsHuman");
  if (typeof base === "string") return base;
  if (!isRecord(input)) return "checks.soundsHuman must be an object";
  const openers = stringList(input.openers, "checks.soundsHuman.openers");
  if (typeof openers === "string") return openers;
  const phrases = stringList(input.phrases, "checks.soundsHuman.phrases");
  if (typeof phrases === "string") return phrases;
  const reasonPass = requiredString(input.reasonPass, "checks.soundsHuman.reasonPass");
  if (typeof reasonPass !== "string") return reasonPass;
  const reasonWarn = requiredString(input.reasonWarn, "checks.soundsHuman.reasonWarn");
  if (typeof reasonWarn !== "string") return reasonWarn;
  return { ...base, tag: "heuristic", openers, phrases, reasonPass, reasonWarn };
}

function readBait(input: unknown): Signals["checks"]["engagementBait"] | string {
  if (!isRecord(input)) return "checks.engagementBait must be an object";
  if (input.tag !== "x-code") return "checks.engagementBait.tag must be x-code";
  const title = requiredString(input.title, "checks.engagementBait.title");
  if (typeof title !== "string") return title;
  if (typeof input.enabledByDefault !== "boolean") {
    return "checks.engagementBait.enabledByDefault must be boolean";
  }
  const source = readCitation(input.source, false);
  if (typeof source === "string") return `checks.engagementBait: ${source}`;
  const detectorNote = requiredString(
    input.detectorNote,
    "checks.engagementBait.detectorNote",
  );
  if (typeof detectorNote !== "string") return detectorNote;
  const phrases = stringList(input.phrases, "checks.engagementBait.phrases");
  if (typeof phrases === "string") return phrases;
  const reasonPass = requiredString(input.reasonPass, "checks.engagementBait.reasonPass");
  if (typeof reasonPass !== "string") return reasonPass;
  const reasonFail = requiredString(input.reasonFail, "checks.engagementBait.reasonFail");
  if (typeof reasonFail !== "string") return reasonFail;
  return {
    title,
    tag: "x-code",
    enabledByDefault: input.enabledByDefault,
    source,
    detectorNote,
    phrases,
    reasonPass,
    reasonFail,
  };
}

function readCountCheck(
  input: unknown,
  id: "spamHashtags",
  field: "maxHashtags",
  reasons: string[],
): Signals["checks"]["spamHashtags"] | string;
function readCountCheck(
  input: unknown,
  id: "spamMentions",
  field: "maxMentions",
  reasons: string[],
): Signals["checks"]["spamMentions"] | string;
function readCountCheck(
  input: unknown,
  id: "spamHashtags" | "spamMentions",
  field: "maxHashtags" | "maxMentions",
  reasons: string[],
): Signals["checks"]["spamHashtags"] | Signals["checks"]["spamMentions"] | string {
  const base = readHeuristicBase(input, id);
  if (typeof base === "string") return base;
  if (!isRecord(input)) return `checks.${id} must be an object`;
  if (
    typeof input[field] !== "number" ||
    !Number.isInteger(input[field]) ||
    input[field] < 0
  ) {
    return `checks.${id}.${field} must be a non-negative integer`;
  }
  const copy: Record<string, string> = {};
  for (const reason of reasons) {
    const value = requiredString(input[reason], `checks.${id}.${reason}`);
    if (typeof value !== "string") return value;
    copy[reason] = value;
  }
  return {
    ...base,
    tag: "heuristic",
    [field]: input[field],
    ...copy,
  } as Signals["checks"]["spamHashtags"] | Signals["checks"]["spamMentions"];
}

function readHeuristic(
  input: unknown,
  id: "spamLinks",
  reasons: string[],
): Signals["checks"]["spamLinks"] | string {
  const base = readHeuristicBase(input, id);
  if (typeof base === "string") return base;
  if (!isRecord(input)) return `checks.${id} must be an object`;
  const copy: Record<string, string> = {};
  for (const reason of reasons) {
    const value = requiredString(input[reason], `checks.${id}.${reason}`);
    if (typeof value !== "string") return value;
    copy[reason] = value;
  }
  return {
    ...base,
    tag: "heuristic",
    reasonPass: copy.reasonPass ?? "",
    reasonWarn: copy.reasonWarn ?? "",
  };
}

function readDuplicate(input: unknown): Signals["checks"]["spamDuplicate"] | string {
  if (!isRecord(input)) return "checks.spamDuplicate must be an object";
  if (input.tag !== "mixed") return "checks.spamDuplicate.tag must be mixed";
  const title = requiredString(input.title, "checks.spamDuplicate.title");
  if (typeof title !== "string") return title;
  if (typeof input.enabledByDefault !== "boolean") {
    return "checks.spamDuplicate.enabledByDefault must be boolean";
  }
  const heuristicNote = requiredString(
    input.heuristicNote,
    "checks.spamDuplicate.heuristicNote",
  );
  if (typeof heuristicNote !== "string") return heuristicNote;
  const source = readCitation(input.source, false);
  if (typeof source === "string") return `checks.spamDuplicate: ${source}`;
  if (
    typeof input.minChars !== "number" ||
    !Number.isInteger(input.minChars) ||
    input.minChars < 1
  ) {
    return "checks.spamDuplicate.minChars must be a positive integer";
  }
  const reasonPass = requiredString(input.reasonPass, "checks.spamDuplicate.reasonPass");
  if (typeof reasonPass !== "string") return reasonPass;
  const reasonSkip = requiredString(input.reasonSkip, "checks.spamDuplicate.reasonSkip");
  if (typeof reasonSkip !== "string") return reasonSkip;
  const reasonWarn = requiredString(input.reasonWarn, "checks.spamDuplicate.reasonWarn");
  if (typeof reasonWarn !== "string") return reasonWarn;
  return {
    title,
    tag: "mixed",
    enabledByDefault: input.enabledByDefault,
    heuristicNote,
    source,
    minChars: input.minChars,
    reasonPass,
    reasonSkip,
    reasonWarn,
  };
}

function readPace(input: unknown): Signals["checks"]["replyPace"] | string {
  if (!isRecord(input)) return "checks.replyPace must be an object";
  if (input.tag !== "mixed") return "checks.replyPace.tag must be mixed";
  const title = requiredString(input.title, "checks.replyPace.title");
  if (typeof title !== "string") return title;
  if (typeof input.enabledByDefault !== "boolean") {
    return "checks.replyPace.enabledByDefault must be boolean";
  }
  const heuristicNote = requiredString(
    input.heuristicNote,
    "checks.replyPace.heuristicNote",
  );
  if (typeof heuristicNote !== "string") return heuristicNote;
  const source = readCitation(input.source, false);
  if (typeof source === "string") return `checks.replyPace: ${source}`;
  if (!nonNegativeInt(input.defaultPerHour))
    return "checks.replyPace.defaultPerHour must be an integer";
  if (!nonNegativeInt(input.defaultPerDay))
    return "checks.replyPace.defaultPerDay must be an integer";
  const reasonPass = requiredString(input.reasonPass, "checks.replyPace.reasonPass");
  if (typeof reasonPass !== "string") return reasonPass;
  const reasonWarn = requiredString(input.reasonWarn, "checks.replyPace.reasonWarn");
  if (typeof reasonWarn !== "string") return reasonWarn;
  return {
    title,
    tag: "mixed",
    enabledByDefault: input.enabledByDefault,
    heuristicNote,
    source,
    defaultPerHour: input.defaultPerHour,
    defaultPerDay: input.defaultPerDay,
    reasonPass,
    reasonWarn,
  };
}

function readConversation(
  input: unknown,
): Signals["checks"]["invitesConversation"] | string {
  if (!isRecord(input)) return "checks.invitesConversation must be an object";
  if (input.tag !== "heuristic")
    return "checks.invitesConversation.tag must be heuristic";
  const title = requiredString(input.title, "checks.invitesConversation.title");
  if (typeof title !== "string") return title;
  if (typeof input.enabledByDefault !== "boolean") {
    return "checks.invitesConversation.enabledByDefault must be boolean";
  }
  const heuristicNote = requiredString(
    input.heuristicNote,
    "checks.invitesConversation.heuristicNote",
  );
  if (typeof heuristicNote !== "string") return heuristicNote;
  const experiencePatterns = stringList(
    input.experiencePatterns,
    "checks.invitesConversation.experiencePatterns",
  );
  if (typeof experiencePatterns === "string") return experiencePatterns;
  for (const pattern of experiencePatterns) {
    try {
      RegExp(pattern, "i");
    } catch {
      return `invalid experience pattern ${pattern}`;
    }
  }
  const reasonPass = requiredString(
    input.reasonPass,
    "checks.invitesConversation.reasonPass",
  );
  if (typeof reasonPass !== "string") return reasonPass;
  const reasonWarn = requiredString(
    input.reasonWarn,
    "checks.invitesConversation.reasonWarn",
  );
  if (typeof reasonWarn !== "string") return reasonWarn;
  return {
    title,
    tag: "heuristic",
    enabledByDefault: input.enabledByDefault,
    heuristicNote,
    experiencePatterns,
    reasonPass,
    reasonWarn,
  };
}

function readInfoLength(input: unknown): Signals["checks"]["infoLength"] | string {
  if (!isRecord(input)) return "checks.infoLength must be an object";
  if (input.tag !== "info") return "checks.infoLength.tag must be info";
  const title = requiredString(input.title, "checks.infoLength.title");
  if (typeof title !== "string") return title;
  const related = readCitation(input.related, true);
  if (typeof related === "string") return `checks.infoLength: ${related}`;
  const reason = requiredString(input.reason, "checks.infoLength.reason");
  if (typeof reason !== "string") return reason;
  return { title, tag: "info", related, reason };
}

function readInfoMedia(input: unknown): Signals["checks"]["infoMedia"] | string {
  if (!isRecord(input)) return "checks.infoMedia must be an object";
  if (input.tag !== "info") return "checks.infoMedia.tag must be info";
  const title = requiredString(input.title, "checks.infoMedia.title");
  if (typeof title !== "string") return title;
  const related = readCitation(input.related, true);
  if (typeof related === "string") return `checks.infoMedia: ${related}`;
  const reasonOn = requiredString(input.reasonOn, "checks.infoMedia.reasonOn");
  if (typeof reasonOn !== "string") return reasonOn;
  const reasonOff = requiredString(input.reasonOff, "checks.infoMedia.reasonOff");
  if (typeof reasonOff !== "string") return reasonOff;
  return { title, tag: "info", related, reasonOn, reasonOff };
}

function readHeuristicBase(
  input: unknown,
  id: string,
):
  | {
      title: string;
      enabledByDefault: boolean;
      heuristicNote: string;
      related: Signals["checks"]["soundsHuman"]["related"];
    }
  | string {
  if (!isRecord(input)) return `checks.${id} must be an object`;
  if (input.tag !== "heuristic") return `checks.${id}.tag must be heuristic`;
  const title = requiredString(input.title, `checks.${id}.title`);
  if (typeof title !== "string") return title;
  if (typeof input.enabledByDefault !== "boolean") {
    return `checks.${id}.enabledByDefault must be boolean`;
  }
  const heuristicNote = requiredString(input.heuristicNote, `checks.${id}.heuristicNote`);
  if (typeof heuristicNote !== "string") return heuristicNote;
  const related = readCitation(input.related, true);
  if (typeof related === "string") return `checks.${id}: ${related}`;
  return { title, enabledByDefault: input.enabledByDefault, heuristicNote, related };
}

function readCitation(
  input: unknown,
  requireLabel: boolean,
): { path: string; lines: [number, number]; note?: string; label?: string } | string {
  if (!isRecord(input)) return "citation must be an object";
  if (typeof input.path !== "string" || input.path.length === 0)
    return "citation path is required";
  const lines = readLines(input.lines);
  if (typeof lines === "string") return lines;
  const note = optionalString(input.note);
  if (note === false) return "citation note must be a string";
  const label = optionalString(input.label);
  if (label === false) return "citation label must be a string";
  if (requireLabel && !label) return "citation label is required";
  return {
    path: input.path,
    lines,
    ...(note ? { note } : {}),
    ...(label ? { label } : {}),
  };
}

function readLines(input: unknown): [number, number] | string {
  if (!Array.isArray(input) || input.length !== 2) return "lines must be [start, end]";
  const [start, end] = input;
  if (typeof start !== "number" || typeof end !== "number")
    return "lines must be numbers";
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    return "lines must be positive integers with start <= end";
  }
  return [start, end];
}

function stringList(input: unknown, label: string): string[] | string {
  if (!Array.isArray(input) || input.length === 0)
    return `${label} must be a non-empty array`;
  if (!input.every((item) => typeof item === "string" && item.trim().length > 0)) {
    return `${label} must be non-empty strings`;
  }
  return input;
}

class ValidationError extends Error {}

function requiredString(input: unknown, label: string): string {
  if (typeof input !== "string" || input.length === 0) {
    throw new ValidationError(`${label} is required`);
  }
  return input;
}

function optionalString(input: unknown): string | undefined | false {
  if (input === undefined) return undefined;
  if (typeof input !== "string") return false;
  return input;
}

function nonNegativeInt(input: unknown): input is number {
  return typeof input === "number" && Number.isInteger(input) && input >= 0;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function fail(error: string): InvalidSignals {
  return { ok: false, error };
}
