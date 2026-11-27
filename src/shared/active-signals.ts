import bundledJson from "../../signals/signals.json";
import { validateSignals } from "../engine/validate";
import type { Signals } from "../engine/types";

export type SignalsOrigin = "fetched" | "bundled";

export interface ActiveSignals {
  signals: Signals;
  origin: SignalsOrigin;
  fetchedAt: number | null;
  fetchError: string | null;
}

export interface SignalsCache {
  signals: unknown;
  fetchedAt: number;
  url: string;
}

export interface FetchStatus {
  ok: boolean;
  at: number;
  url: string;
  error?: string;
}

const bundled = validateSignals(bundledJson);
if (!bundled.ok) {
  throw new Error(`Bundled signals.json is invalid: ${bundled.error}`);
}

export const BUNDLED_SIGNALS: Signals = bundled.signals;

export function resolveActiveSignals(
  cache: unknown,
  fetchStatus: unknown,
): ActiveSignals {
  const parsedCache = readCache(cache);
  const status = readStatus(fetchStatus);
  if (parsedCache) {
    const validated = validateSignals(parsedCache.signals);
    if (validated.ok) {
      const refreshFailed = status && !status.ok && status.at > parsedCache.fetchedAt;
      return {
        signals: validated.signals,
        origin: "fetched",
        fetchedAt: parsedCache.fetchedAt,
        fetchError: refreshFailed ? (status.error ?? "Refresh failed") : null,
      };
    }
  }
  return {
    signals: BUNDLED_SIGNALS,
    origin: "bundled",
    fetchedAt: null,
    fetchError: status && !status.ok ? (status.error ?? "Fetch failed") : null,
  };
}

export function signalsFooter(active: ActiveSignals): string {
  const sha = active.signals.source.commit.slice(0, 7);
  const date = active.signals.source.commitDate;
  if (active.origin === "fetched" && active.fetchedAt) {
    const problem = active.fetchError ? " · refresh failed" : "";
    return `${sha} · ${date} · fetched ${formatDay(active.fetchedAt)}${problem}`;
  }
  // A 404 before the first good fetch (the file is not on main yet) is not an error.
  const pending = active.fetchError ? " · update pending" : "";
  return `${sha} · ${date} · bundled${pending}`;
}

function formatDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function readCache(input: unknown): SignalsCache | null {
  if (!isRecord(input)) return null;
  if (typeof input.fetchedAt !== "number" || typeof input.url !== "string") return null;
  return { signals: input.signals, fetchedAt: input.fetchedAt, url: input.url };
}

function readStatus(input: unknown): FetchStatus | null {
  if (!isRecord(input)) return null;
  if (typeof input.ok !== "boolean" || typeof input.at !== "number") return null;
  if (typeof input.url !== "string") return null;
  const error = typeof input.error === "string" ? input.error : undefined;
  return { ok: input.ok, at: input.at, url: input.url, ...(error ? { error } : {}) };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
