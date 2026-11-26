import { evaluate, summarize } from "../engine/evaluate";
import type { DraftInput } from "../engine/types";
import { signalsFooter, resolveActiveSignals } from "../shared/active-signals";
import { recordSentReply, replyLogFromStorage } from "../shared/reply-log";
import { resolveSettings } from "../shared/settings";
import { STORAGE_KEYS } from "../shared/storage";
import {
  findComposerRoot,
  findComposers,
  findReplyButton,
  mediaAttached,
  readComposerText,
} from "./selectors";
import { detectTheme } from "./theme";
import { mountPanel, placePanel, type PanelHandle } from "./panel";

const DEBOUNCE_MS = 120;

interface PasteState {
  snippets: string[];
  unreadable: boolean;
}

declare global {
  interface Window {
    __replyLintStarted?: boolean;
  }
}

export function start(): void {
  if (window.__replyLintStarted) return;
  window.__replyLintStarted = true;
  const attached = new WeakMap<HTMLElement, () => void>();

  const scan = () => {
    for (const composer of findComposers(document)) {
      if (attached.has(composer)) continue;
      attached.set(composer, watchComposer(composer));
    }
  };

  const observer = new MutationObserver(() => scan());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scan();
}

function watchComposer(composer: HTMLElement): () => void {
  const root = findComposerRoot(composer);
  const paste: PasteState = { snippets: [], unreadable: false };
  const boundButtons = new WeakSet<HTMLElement>();
  let collapsed = false;
  let timer = 0;
  let panel: PanelHandle | null = null;
  let stopped = false;

  const ensurePanel = () => {
    if (panel) return panel;
    panel = mountPanel(() => {
      collapsed = !collapsed;
      void chrome.storage.local.set({ [STORAGE_KEYS.panelCollapsed]: collapsed });
      void render();
    });
    return panel;
  };

  const onPaste = (event: Event) => {
    const clipboard = event instanceof ClipboardEvent ? event.clipboardData : null;
    notePaste(paste, clipboard?.getData("text/plain") ?? "");
    schedule();
  };

  const onBeforeInput = (event: Event) => {
    if (!(event instanceof InputEvent)) return;
    if (event.inputType !== "insertFromPaste") return;
    notePaste(paste, event.data ?? "");
    schedule();
  };

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void render(), DEBOUNCE_MS);
  };

  const onScroll = () => {
    if (panel) placePanel(panel.host, composer);
  };

  composer.addEventListener("paste", onPaste);
  composer.addEventListener("beforeinput", onBeforeInput);
  composer.addEventListener("input", schedule);
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onScroll);

  const onStorage = () => schedule();
  chrome.storage.onChanged.addListener(onStorage);

  const bindButton = () => {
    const button = findReplyButton(root);
    if (!button || boundButtons.has(button)) return;
    boundButtons.add(button);
    button.addEventListener(
      "click",
      () => {
        // Read the draft before X's own handler runs. Never preventDefault or stopPropagation.
        const text = readComposerText(composer);
        if (!text.trim()) return;
        void rememberReply(text);
      },
      true,
    );
  };

  const render = async () => {
    if (stopped) return;
    if (!composer.isConnected) {
      stop();
      return;
    }
    bindButton();
    const stored = await chrome.storage.local.get([
      STORAGE_KEYS.settings,
      STORAGE_KEYS.signalsCache,
      STORAGE_KEYS.signalsFetch,
      STORAGE_KEYS.replyLog,
      STORAGE_KEYS.panelCollapsed,
    ]);
    if (stopped || !composer.isConnected) return;
    collapsed = stored[STORAGE_KEYS.panelCollapsed] === true;
    const active = resolveActiveSignals(
      stored[STORAGE_KEYS.signalsCache],
      stored[STORAGE_KEYS.signalsFetch],
    );
    const settings = resolveSettings(stored[STORAGE_KEYS.settings], active.signals);
    const log = replyLogFromStorage(stored[STORAGE_KEYS.replyLog]);
    const text = readComposerText(composer);
    if (!text.trim()) {
      paste.snippets = [];
      paste.unreadable = false;
    }
    const draft: DraftInput = {
      text,
      pastedSnippets: paste.snippets,
      pasteUnreadable: paste.unreadable,
    };
    const results = evaluate(
      draft,
      {
        mediaAttached: mediaAttached(root),
        recentReplies: log.sent.map((entry) => entry.text),
        sentTimestamps: log.sent.map((entry) => entry.at),
        now: Date.now(),
      },
      active.signals,
      settings,
    );
    const counts = summarize(results);
    const handle = ensurePanel();
    handle.update({
      theme: detectTheme(composer),
      collapsed,
      summary: summaryLine(text, counts),
      empty: text.trim().length === 0,
      results,
      footer: signalsFooter(active),
    });
    placePanel(handle.host, composer);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(timer);
    composer.removeEventListener("paste", onPaste);
    composer.removeEventListener("beforeinput", onBeforeInput);
    composer.removeEventListener("input", schedule);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onScroll);
    chrome.storage.onChanged.removeListener(onStorage);
    panel?.destroy();
  };

  void render();
  return stop;
}

function notePaste(paste: PasteState, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) {
    paste.unreadable = true;
    return;
  }
  paste.unreadable = false;
  if (!paste.snippets.includes(trimmed)) paste.snippets.push(trimmed);
}

function summaryLine(
  text: string,
  counts: { fails: number; warns: number; passes: number },
): string {
  if (!text.trim() && counts.fails === 0 && counts.warns === 0)
    return "Waiting for a reply";
  if (counts.fails === 0 && counts.warns === 0) return "All clear";
  const parts: string[] = [];
  if (counts.fails > 0) parts.push(`${counts.fails} to fix`);
  if (counts.warns > 0) parts.push(`${counts.warns} to watch`);
  return parts.join(" · ");
}

async function rememberReply(text: string): Promise<void> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.replyLog);
  const next = recordSentReply(
    replyLogFromStorage(stored[STORAGE_KEYS.replyLog]),
    text,
    Date.now(),
  );
  await chrome.storage.local.set({ [STORAGE_KEYS.replyLog]: next });
}

start();
