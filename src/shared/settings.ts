import type { Settings, Signals, ToggleId } from "../engine/types";
import { TOGGLE_IDS } from "../engine/types";

export function defaultSettings(signals: Signals): Settings {
  const enabled = {} as Record<ToggleId, boolean>;
  for (const id of TOGGLE_IDS) {
    enabled[id] = signals.checks[id].enabledByDefault;
  }
  return {
    signalsUrl: signals.defaultSignalsUrl,
    pacePerHour: signals.checks.replyPace.defaultPerHour,
    pacePerDay: signals.checks.replyPace.defaultPerDay,
    enabled,
  };
}

export function resolveSettings(input: unknown, signals: Signals): Settings {
  const defaults = defaultSettings(signals);
  if (!isRecord(input)) return defaults;
  const pacePerHour = clampInt(input.pacePerHour, defaults.pacePerHour);
  const pacePerDay = clampInt(input.pacePerDay, defaults.pacePerDay);
  const signalsUrl =
    typeof input.signalsUrl === "string" && input.signalsUrl.startsWith("https://")
      ? input.signalsUrl.trim()
      : defaults.signalsUrl;
  const enabled = { ...defaults.enabled };
  if (isRecord(input.enabled)) {
    for (const id of TOGGLE_IDS) {
      if (typeof input.enabled[id] === "boolean") enabled[id] = input.enabled[id];
    }
  }
  return { signalsUrl, pacePerHour, pacePerDay, enabled };
}

function clampInt(input: unknown, fallback: number): number {
  if (typeof input !== "number" || !Number.isInteger(input)) return fallback;
  if (input < 0 || input > 1000) return fallback;
  return input;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
