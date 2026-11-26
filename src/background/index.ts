import { BUNDLED_SIGNALS } from "../shared/active-signals";
import { resolveSettings } from "../shared/settings";
import { ALARM_NAME, STORAGE_KEYS } from "../shared/storage";
import { validateSignals } from "../engine/validate";

chrome.runtime.onInstalled.addListener(() => {
  void chrome.alarms.create(ALARM_NAME, { periodInMinutes: 24 * 60 });
  void refreshSignals();
});

chrome.runtime.onStartup.addListener(() => {
  void refreshSignals();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) void refreshSignals();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isRecord(message) || message.type !== "reply-lint:refresh-signals") return;
  void refreshSignals().then(sendResponse);
  return true;
});

export async function refreshSignals(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const settings = resolveSettings(stored[STORAGE_KEYS.settings], BUNDLED_SIGNALS);
  const url = settings.signalsUrl;
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body: unknown = await response.json();
    const validated = validateSignals(body);
    if (!validated.ok) throw new Error(validated.error);
    const at = Date.now();
    await chrome.storage.local.set({
      [STORAGE_KEYS.signalsCache]: { signals: validated.signals, fetchedAt: at, url },
      [STORAGE_KEYS.signalsFetch]: { ok: true, at, url },
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch failed";
    await chrome.storage.local.set({
      [STORAGE_KEYS.signalsFetch]: { ok: false, at: Date.now(), url, error: message },
    });
    return { ok: false, error: message };
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
