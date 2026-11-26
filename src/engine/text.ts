function urlPattern(): RegExp {
  return /\b(?:https?:\/\/|www\.|t\.co\/)[^\s<>]+/gi;
}

function hashtagPattern(): RegExp {
  return /(?:^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]{1,})/gu;
}

function mentionPattern(): RegExp {
  return /(?:^|[^\p{L}\p{N}_])@([A-Za-z0-9_]{1,15})(?![A-Za-z0-9_])/gu;
}

export function collapseSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function normalizeForMatch(text: string): string {
  return collapseSpace(text).toLowerCase();
}

export function normalizeForDuplicate(text: string): string {
  return collapseSpace(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s#@]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function characterCount(text: string): number {
  return Array.from(text.replace(/\u00a0/g, " ")).length;
}

export function stripUrls(text: string): string {
  return text.replace(urlPattern(), " ");
}

export function countHashtags(text: string): number {
  return matchAll(hashtagPattern(), stripUrls(text)).length;
}

export function countMentions(text: string): number {
  return matchAll(mentionPattern(), text).length;
}

export function containsLink(text: string): boolean {
  return urlPattern().test(text);
}

export function findListedPhrase(
  text: string,
  phrases: readonly string[],
): string | null {
  const haystack = normalizeForMatch(text);
  if (!haystack) return null;
  const ordered = [...phrases].sort((a, b) => b.length - a.length);
  for (const phrase of ordered) {
    const needle = normalizeForMatch(phrase);
    if (!needle) continue;
    if (haystack.includes(needle)) return phrase;
  }
  return null;
}

export function findOpener(text: string, openers: readonly string[]): string | null {
  const haystack = normalizeForMatch(text);
  if (!haystack) return null;
  const ordered = [...openers].sort((a, b) => b.length - a.length);
  for (const opener of ordered) {
    const needle = normalizeForMatch(opener);
    if (!needle) continue;
    if (
      haystack === needle ||
      haystack.startsWith(`${needle} `) ||
      haystack.startsWith(`${needle},`) ||
      haystack.startsWith(`${needle}!`) ||
      haystack.startsWith(`${needle}.`)
    ) {
      return opener;
    }
  }
  return null;
}

export function pastedStillPresent(
  text: string,
  snippets: readonly string[],
  pasteUnreadable: boolean,
): boolean {
  const draft = normalizeForMatch(text);
  if (!draft) return false;
  if (pasteUnreadable) return true;
  return snippets.some((snippet) => {
    const pasted = normalizeForMatch(snippet);
    return pasted.length > 0 && draft.includes(pasted);
  });
}

export function isDuplicateText(
  text: string,
  recentNormalized: readonly string[],
  minChars: number,
): "skip" | "unique" | "duplicate" {
  const normalized = normalizeForDuplicate(text);
  if (normalized.length < minChars) return "skip";
  const hit = recentNormalized.some((recent) => {
    const other = normalizeForDuplicate(recent);
    if (other.length < minChars) return false;
    return (
      other === normalized || other.includes(normalized) || normalized.includes(other)
    );
  });
  return hit ? "duplicate" : "unique";
}

export function paceCounts(
  timestamps: readonly number[],
  now: number,
): { hour: number; day: number } {
  const hour = now - 60 * 60 * 1000;
  const day = now - 24 * 60 * 60 * 1000;
  let hourCount = 0;
  let dayCount = 0;
  for (const at of timestamps) {
    if (at > now) continue;
    if (at >= day) dayCount += 1;
    if (at >= hour) hourCount += 1;
  }
  return { hour: hourCount, day: dayCount };
}

export function hasQuestion(text: string): boolean {
  return text.includes("?");
}

export function hasNumber(text: string): boolean {
  return /\d/.test(text);
}

export function matchesExperience(text: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => {
    try {
      return new RegExp(pattern, "i").test(text);
    } catch {
      return false;
    }
  });
}

function matchAll(pattern: RegExp, text: string): string[] {
  return [...text.matchAll(pattern)].map((match) => match[0]);
}
