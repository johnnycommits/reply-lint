import { describe, expect, it } from "vitest";
import bundled from "../signals/signals.json";
import { evaluate } from "../src/engine/evaluate";
import { sourceUrl } from "../src/engine/source-url";
import {
  containsLink,
  countHashtags,
  countMentions,
  pastedStillPresent,
} from "../src/engine/text";
import { validateSignals } from "../src/engine/validate";
import { resolveActiveSignals } from "../src/shared/active-signals";
import { recordSentReply } from "../src/shared/reply-log";
import { defaultSettings, resolveSettings } from "../src/shared/settings";
import type { CheckResult, DraftInput, EvalContext, Signals } from "../src/engine/types";

const parsed = validateSignals(bundled);
if (!parsed.ok) throw new Error(parsed.error);
const signals: Signals = parsed.signals;
const NOW = Date.parse("2026-11-26T22:00:00Z");

const EXPECTED_WEIGHTS: Record<string, number> = {
  favorite: 0.708,
  reply: 5,
  bidirectionalFollowReplyBoost: 15,
  bidirectionalFollowDwellBoost: 0,
  retweet: 1,
  photoExpand: 0.05,
  videoOpen: 0,
  click: 0.274,
  openLink: 0.2,
  profileClick: 0,
  vqv: 0,
  share: 2.118,
  shareViaDm: 5,
  shareViaCopyLink: 20,
  dwell: 0.05,
  quote: 5,
  quotedClick: 0.05,
  quotedVqv: 0,
  followAuthor: 4,
  postUnexplored: 0.015,
  postVideo: 0,
  grokAnalyze: 0,
  contDwellTime: 0.0075,
  contClickDwellTime: 0.385,
  notInterested: -53.07,
  blockAuthor: -31.2,
  muteAuthor: -58.8,
  report: -234,
  notDwelled: -0.02,
};

describe("weights locked to the pinned commit", () => {
  it("matches the verified home-mixer defaults and nothing else", () => {
    expect(signals.weights.map((row) => row.id)).toEqual(Object.keys(EXPECTED_WEIGHTS));
    for (const row of signals.weights) {
      expect(row.weight).toBe(EXPECTED_WEIGHTS[row.id]);
      expect(row.path).toBe("home-mixer/params/param.rs");
      expect(row.lines[0]).toBeLessThanOrEqual(row.lines[1]);
    }
    expect(signals.weights.find((row) => row.id === "favorite")?.lines).toEqual([
      466, 471,
    ]);
    expect(signals.weights.find((row) => row.id === "report")?.lines).toEqual([589, 589]);
  });

  it("builds source links at the pinned sha", () => {
    expect(
      sourceUrl(
        signals.source.repo,
        signals.source.commit,
        "grox/core/lm/thread.py",
        [62, 63],
      ),
    ).toBe(
      "https://github.com/xai-org/x-algorithm/blob/52d45989090e63992ba04e4f6cfccd73bf8cc05c/grox/core/lm/thread.py#L62-L63",
    );
    expect(
      sourceUrl(
        signals.source.repo,
        signals.source.commit,
        "home-mixer/params/param.rs",
        [472, 472],
      ),
    ).toBe(
      "https://github.com/xai-org/x-algorithm/blob/52d45989090e63992ba04e4f6cfccd73bf8cc05c/home-mixer/params/param.rs#L472",
    );
  });
});

describe("evaluate", () => {
  it("scores an empty draft without failing it", () => {
    const results = run("");
    expect(results.map((result) => result.id)).toEqual([
      "replyPace",
      "infoLength",
      "infoMedia",
    ]);
    expect(
      results.every((result) => result.status === "pass" || result.status === "info"),
    ).toBe(true);
  });

  it("warns when pasted text is still in the draft and tags X's code", () => {
    const results = run("shipped the timeout fix", {
      pasted: ["shipped the timeout fix"],
    });
    const check = byId(results, "typedNotPasted");
    expect(check.status).toBe("warn");
    expect(check.tags.map((tag) => tag.kind)).toEqual(["x-code"]);
    expect(check.tags[0]?.url).toContain("grox/core/lm/thread.py#L62-L63");
    expect(check.reason.toLowerCase()).toContain("pasted");
  });

  it("passes typed text that no longer contains the paste", () => {
    const check = byId(
      run("rewrote it by hand", { pasted: ["old clipboard"] }),
      "typedNotPasted",
    );
    expect(check.status).toBe("pass");
  });

  it("warns on our phrase list and says the list is ours", () => {
    const check = byId(run("Great point, the timeout was 30 seconds."), "soundsHuman");
    expect(check.status).toBe("warn");
    expect(check.reason).toContain("great point");
    expect(check.reason).toContain("ours");
    expect(check.tags.map((tag) => tag.kind)).toEqual(["heuristic", "context"]);
    expect(check.tags.some((tag) => tag.kind === "x-code")).toBe(false);
  });

  it("fails engagement bait and points at the spam drop, not the phrase list", () => {
    const check = byId(run("Like if you have seen this timeout."), "engagementBait");
    expect(check.status).toBe("fail");
    expect(check.reason).toContain("detector");
    expect(check.tags.map((tag) => tag.kind)).toEqual(["x-code"]);
    expect(check.tags[0]?.url).toContain(
      "task_write_safety_post_annotations_result_sink.py#L236-L266",
    );
  });

  it("warns on hashtags, mentions, links, and repeats with separate tags", () => {
    const text = "see https://example.com and #one #two @a @b @c";
    const results = run(text, {
      recent: ["see https://example.com and #one #two @a @b @c"],
    });
    expect(byId(results, "spamHashtags").status).toBe("warn");
    expect(byId(results, "spamHashtags").reason).toContain("ours");
    expect(byId(results, "spamHashtags").tags[0]?.kind).toBe("heuristic");
    expect(byId(results, "spamMentions").status).toBe("warn");
    expect(byId(results, "spamLinks").status).toBe("warn");
    expect(byId(results, "spamLinks").reason).toContain("no general link penalty");
    expect(byId(results, "spamDuplicate").status).toBe("warn");
    expect(byId(results, "spamDuplicate").tags.map((tag) => tag.kind)).toEqual([
      "x-code",
      "heuristic",
    ]);
  });

  it("does not count a URL fragment as a hashtag", () => {
    expect(countHashtags("see https://example.com/a#frag only")).toBe(0);
    expect(countMentions("mail me@john.dev about @ada")).toBe(1);
    expect(containsLink("t.co/abc")).toBe(true);
  });

  it("treats pace limits as ours and the 24h count as X's", () => {
    const hourAgo = NOW - 60 * 60 * 1000;
    const stamps = Array.from({ length: 9 }, (_, index) => hourAgo + index * 1000);
    const check = byId(run("What timeout did you hit?", { sent: stamps }), "replyPace");
    expect(check.status).toBe("warn");
    expect(check.reason).toContain("caps are yours");
    expect(check.tags.map((tag) => tag.kind)).toEqual(["x-code", "heuristic"]);
    expect(check.tags[0]?.url).toContain("thread.py#L48-L51");
  });

  it("nudges replies with nothing specific to answer", () => {
    expect(byId(run("Nice."), "invitesConversation").status).toBe("warn");
    expect(byId(run("What timeout did you hit?"), "invitesConversation").status).toBe(
      "pass",
    );
    expect(
      byId(run("I tried 30s and it still failed."), "invitesConversation").status,
    ).toBe("pass");
    expect(byId(run("Nice."), "invitesConversation").tags.map((tag) => tag.kind)).toEqual(
      ["heuristic"],
    );
  });

  it("keeps length and media as info, including when media is attached", () => {
    const results = run("What timeout did you hit?", { media: true });
    const length = byId(results, "infoLength");
    const media = byId(results, "infoMedia");
    expect(length.status).toBe("info");
    expect(media.status).toBe("info");
    expect(length.tags[0]?.label).toBe("No fixed rule");
    expect(media.reason).toContain("Media attached");
    expect(length.reason).toContain("no fixed length rule");
  });

  it("omits a check the options page turned off", () => {
    const settings = defaultSettings(signals);
    settings.enabled.engagementBait = false;
    const results = evaluate(
      draft("Like if you agree, what broke?"),
      context(),
      signals,
      settings,
    );
    expect(results.some((result) => result.id === "engagementBait")).toBe(false);
  });

  it("uses the options pace limits", () => {
    const settings = defaultSettings(signals);
    settings.pacePerHour = 0;
    const check = byId(
      evaluate(draft("What broke?"), context({ sent: [NOW - 1000] }), signals, settings),
      "replyPace",
    );
    expect(check.status).toBe("warn");
    expect(check.reason).toContain("limit 0");
  });
});

describe("signals fallback and reply log", () => {
  it("keeps a valid cache and falls back when the cache is garbage", () => {
    const cached = resolveActiveSignals(
      { signals: bundled, fetchedAt: 10, url: "https://example.com/signals.json" },
      { ok: false, at: 11, url: "https://example.com/signals.json", error: "HTTP 404" },
    );
    expect(cached.origin).toBe("fetched");
    expect(cached.fetchError).toContain("404");

    const fallback = resolveActiveSignals(
      {
        signals: { schemaVersion: 99 },
        fetchedAt: 10,
        url: "https://example.com/signals.json",
      },
      { ok: false, at: 11, url: "https://example.com/signals.json", error: "HTTP 404" },
    );
    expect(fallback.origin).toBe("bundled");
    expect(fallback.signals.source.commit).toBe(signals.source.commit);
  });

  it("rejects a file that invents a weight or a check", () => {
    const brokenWeight = structuredClone(bundled) as { weights: { weight: unknown }[] };
    brokenWeight.weights[0].weight = "high";
    expect(validateSignals(brokenWeight).ok).toBe(false);

    const extra = structuredClone(bundled) as { checks: Record<string, unknown> };
    extra.checks.madeUp = { title: "Nope" };
    expect(validateSignals(extra).ok).toBe(false);

    const badPattern = structuredClone(bundled) as {
      checks: { invitesConversation: { experiencePatterns: string[] } };
    };
    badPattern.checks.invitesConversation.experiencePatterns = ["("];
    expect(validateSignals(badPattern).ok).toBe(false);
  });

  it("counts a reply once when the button is double-clicked", () => {
    const first = recordSentReply({ sent: [] }, "What timeout did you hit?", NOW);
    const second = recordSentReply(first, "What timeout did you hit?", NOW + 200);
    expect(second.sent).toHaveLength(1);
    const later = recordSentReply(
      second,
      "A different reply about the timeout.",
      NOW + 5000,
    );
    expect(later.sent).toHaveLength(2);
  });

  it("ignores a non-https signals URL", () => {
    const settings = resolveSettings(
      { signalsUrl: "http://evil.example/signals.json" },
      signals,
    );
    expect(settings.signalsUrl.startsWith("https://")).toBe(true);
  });
});

describe("paste helper", () => {
  it("clears once the pasted snippet is gone", () => {
    expect(pastedStillPresent("hello there", ["hello"], false)).toBe(true);
    expect(pastedStillPresent("rewritten", ["hello"], false)).toBe(false);
    expect(pastedStillPresent("", ["hello"], true)).toBe(false);
  });
});

function run(
  text: string,
  extras: {
    pasted?: string[];
    unreadable?: boolean;
    media?: boolean;
    recent?: string[];
    sent?: number[];
  } = {},
): CheckResult[] {
  return evaluate(
    draft(text, extras.pasted, extras.unreadable),
    context({
      media: extras.media,
      recent: extras.recent,
      sent: extras.sent,
    }),
    signals,
    defaultSettings(signals),
  );
}

function draft(text: string, pasted: string[] = [], unreadable = false): DraftInput {
  return { text, pastedSnippets: pasted, pasteUnreadable: unreadable };
}

function context(
  extras: { media?: boolean; recent?: string[]; sent?: number[] } = {},
): EvalContext {
  return {
    mediaAttached: extras.media ?? false,
    recentReplies: extras.recent ?? [],
    sentTimestamps: extras.sent ?? [],
    now: NOW,
  };
}

function byId(results: CheckResult[], id: string): CheckResult {
  const found = results.find((result) => result.id === id);
  if (!found) throw new Error(`missing check ${id}`);
  return found;
}
