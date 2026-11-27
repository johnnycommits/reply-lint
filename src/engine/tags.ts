import { sourceUrl } from "./source-url";
import type { Citation, Signals, TagChip } from "./types";

export function xCodeTag(signals: Signals, source: Citation): TagChip {
  return {
    kind: "x-code",
    label: "X's code",
    url: sourceUrl(signals.source.repo, signals.source.commit, source.path, source.lines),
  };
}

export function heuristicTag(): TagChip {
  return { kind: "heuristic", label: "Our heuristic" };
}

export function contextTag(signals: Signals, related: Citation): TagChip {
  return {
    kind: "context",
    label: related.label ?? "Related code",
    url: sourceUrl(
      signals.source.repo,
      signals.source.commit,
      related.path,
      related.lines,
    ),
  };
}

export function infoTag(signals: Signals, related: Citation): TagChip {
  return {
    kind: "info",
    label: "No fixed rule",
    url: sourceUrl(
      signals.source.repo,
      signals.source.commit,
      related.path,
      related.lines,
    ),
  };
}
