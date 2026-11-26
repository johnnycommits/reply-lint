import { normalizeForDuplicate } from "../engine/text";
import type { ReplyLog, SentReply } from "../engine/types";

const RETENTION_MS = 48 * 60 * 60 * 1000;
const MAX_ENTRIES = 100;
const DOUBLE_CLICK_MS = 1500;

export function emptyReplyLog(): ReplyLog {
  return { sent: [] };
}

export function recordSentReply(log: ReplyLog, text: string, now: number): ReplyLog {
  const normalized = normalizeForDuplicate(text);
  if (!normalized) return prune(log, now);
  const previous = log.sent[log.sent.length - 1];
  if (
    previous &&
    previous.text === normalized &&
    now - previous.at >= 0 &&
    now - previous.at < DOUBLE_CLICK_MS
  ) {
    return prune(log, now);
  }
  const sent = [...log.sent, { text: normalized, at: now }];
  return prune({ sent }, now);
}

export function replyLogFromStorage(input: unknown): ReplyLog {
  if (!isRecord(input) || !Array.isArray(input.sent)) return emptyReplyLog();
  const sent: SentReply[] = [];
  for (const entry of input.sent) {
    if (!isRecord(entry)) continue;
    if (typeof entry.text !== "string" || typeof entry.at !== "number") continue;
    if (!Number.isFinite(entry.at)) continue;
    sent.push({ text: entry.text, at: entry.at });
  }
  return { sent };
}

function prune(log: ReplyLog, now: number): ReplyLog {
  const sent = log.sent
    .filter((entry) => now - entry.at <= RETENTION_MS && entry.at <= now + 1000)
    .slice(-MAX_ENTRIES);
  return { sent };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
