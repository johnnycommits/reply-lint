import optionsCss from "./options.css?inline";
import {
  BUNDLED_SIGNALS,
  resolveActiveSignals,
  signalsFooter,
} from "../shared/active-signals";
import { resolveSettings } from "../shared/settings";
import { STORAGE_KEYS } from "../shared/storage";
import { TOGGLE_IDS, type Settings, type ToggleId } from "../engine/types";

const style = document.createElement("style");
style.textContent = optionsCss;
document.head.append(style);

const app = document.querySelector("#app");
if (!app) throw new Error("Missing #app");

app.append(heading(), paceSection(), checksSection(), urlSection(), actions());

const paceHour = formControl<HTMLInputElement>("pace-hour");
const paceDay = formControl<HTMLInputElement>("pace-day");
const signalsUrl = formControl<HTMLInputElement>("signals-url");
const status = document.querySelector("#status");
if (!status) throw new Error("Missing status");

void load();

document.querySelector("#save")?.addEventListener("click", () => void save());
document.querySelector("#refresh")?.addEventListener("click", () => void refresh());

function heading(): HTMLElement {
  const wrap = document.createElement("div");
  const title = document.createElement("h1");
  title.textContent = "Reply Lint";
  const lead = document.createElement("p");
  lead.className = "lead";
  lead.textContent =
    "Advise-only. These settings stay on this machine. The extension never posts, never edits the reply box, and never sends draft text anywhere.";
  wrap.append(title, lead);
  return wrap;
}

function paceSection(): HTMLElement {
  const section = document.createElement("section");
  const title = document.createElement("h2");
  title.textContent = "Reply pace";
  const grid = document.createElement("div");
  grid.className = "grid";
  grid.append(
    numberField(
      "pace-hour",
      "Replies per hour",
      "Your limit. X does not publish this number.",
    ),
    numberField(
      "pace-day",
      "Replies per day",
      "Your limit. The grader does see a 24-hour count.",
    ),
  );
  section.append(title, grid);
  return section;
}

function checksSection(): HTMLElement {
  const section = document.createElement("section");
  const title = document.createElement("h2");
  title.textContent = "Checks";
  const list = document.createElement("div");
  list.className = "checks";
  for (const id of TOGGLE_IDS) {
    const label = document.createElement("label");
    label.className = "check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = `check-${id}`;
    const text = document.createElement("span");
    text.textContent = BUNDLED_SIGNALS.checks[id].title;
    label.append(input, text);
    list.append(label);
  }
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent =
    "Length and media stay visible. X's code sets no fixed rule for them, so they are not pass or fail.";
  section.append(title, list, hint);
  return section;
}

function urlSection(): HTMLElement {
  const section = document.createElement("section");
  const title = document.createElement("h2");
  title.textContent = "Signals file";
  const label = document.createElement("label");
  const name = document.createElement("span");
  name.textContent = "HTTPS URL fetched once a day";
  const input = document.createElement("input");
  input.type = "url";
  input.id = "signals-url";
  input.spellcheck = false;
  input.autocomplete = "off";
  label.append(name, input);
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.id = "signals-state";
  section.append(title, label, hint);
  return section;
}

function actions(): HTMLElement {
  const section = document.createElement("section");
  const row = document.createElement("div");
  row.className = "actions";
  const save = document.createElement("button");
  save.type = "button";
  save.id = "save";
  save.textContent = "Save";
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.id = "refresh";
  refresh.className = "secondary";
  refresh.textContent = "Refresh signals now";
  const statusLine = document.createElement("p");
  statusLine.className = "status hint";
  statusLine.id = "status";
  row.append(save, refresh);
  section.append(row, statusLine);
  return section;
}

function numberField(id: string, labelText: string, hint: string): HTMLElement {
  const label = document.createElement("label");
  const name = document.createElement("span");
  name.textContent = labelText;
  const input = document.createElement("input");
  input.type = "number";
  input.id = id;
  input.min = "0";
  input.max = "1000";
  input.step = "1";
  const note = document.createElement("span");
  note.textContent = hint;
  label.append(name, input, note);
  return label;
}

async function load(): Promise<void> {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.settings,
    STORAGE_KEYS.signalsCache,
    STORAGE_KEYS.signalsFetch,
  ]);
  const active = resolveActiveSignals(
    stored[STORAGE_KEYS.signalsCache],
    stored[STORAGE_KEYS.signalsFetch],
  );
  const settings = resolveSettings(stored[STORAGE_KEYS.settings], active.signals);
  apply(settings);
  const state = document.querySelector("#signals-state");
  if (state) {
    state.textContent = `Active file: ${signalsFooter(active)}. Invalid or unreachable files fall back to the copy bundled with the extension.`;
  }
}

function apply(settings: Settings): void {
  paceHour.value = String(settings.pacePerHour);
  paceDay.value = String(settings.pacePerDay);
  signalsUrl.value = settings.signalsUrl;
  for (const id of TOGGLE_IDS) {
    const box = document.querySelector<HTMLInputElement>(`#check-${id}`);
    if (box) box.checked = settings.enabled[id];
  }
}

async function save(): Promise<void> {
  const enabled = {} as Record<ToggleId, boolean>;
  for (const id of TOGGLE_IDS) {
    enabled[id] =
      document.querySelector<HTMLInputElement>(`#check-${id}`)?.checked ?? true;
  }
  const settings: Settings = {
    pacePerHour: readInt(paceHour.value, BUNDLED_SIGNALS.checks.replyPace.defaultPerHour),
    pacePerDay: readInt(paceDay.value, BUNDLED_SIGNALS.checks.replyPace.defaultPerDay),
    signalsUrl: signalsUrl.value.trim().startsWith("https://")
      ? signalsUrl.value.trim()
      : BUNDLED_SIGNALS.defaultSignalsUrl,
    enabled,
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
  setStatus("Saved on this machine.");
}

async function refresh(): Promise<void> {
  setStatus("Fetching signals…");
  await save();
  const response = (await chrome.runtime.sendMessage({
    type: "reply-lint:refresh-signals",
  })) as { ok?: boolean; error?: string } | undefined;
  if (response?.ok) setStatus("Fetched a valid signals file.");
  else setStatus(`Using the bundled copy. ${response?.error ?? "Fetch failed."}`);
  await load();
}

function readInt(value: string, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000) return fallback;
  return parsed;
}

function setStatus(message: string): void {
  if (status) status.textContent = message;
}

function formControl<T extends HTMLElement>(id: string): T {
  const node = document.querySelector<T>(`#${id}`);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
}
