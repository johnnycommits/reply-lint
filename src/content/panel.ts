import panelCss from "./panel.css?inline";
import type { CheckResult, Status } from "../engine/types";

export interface PanelModel {
  theme: "light" | "dark";
  collapsed: boolean;
  summary: string;
  empty: boolean;
  results: CheckResult[];
  footer: string;
}

export interface PanelHandle {
  host: HTMLElement;
  update(model: PanelModel): void;
  destroy(): void;
}

const STATUS_LABEL: Record<Status, string> = {
  pass: "Pass",
  warn: "Watch",
  fail: "Fix",
  info: "Info",
};

export function mountPanel(onToggle: () => void): PanelHandle {
  const host = document.createElement("div");
  host.id = "reply-lint-host";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = panelCss;
  const panel = document.createElement("section");
  panel.className = "panel";
  panel.setAttribute("aria-label", "Reply Lint");
  shadow.append(style, panel);
  document.documentElement.append(host);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "toggle";
  toggle.addEventListener("click", onToggle);
  panel.append(toggle);

  const advise = document.createElement("p");
  advise.className = "advise";
  advise.textContent = "Scores this draft. Does not post or edit it.";
  panel.append(advise);

  const body = document.createElement("div");
  body.className = "body";
  panel.append(body);

  const footer = document.createElement("footer");
  footer.className = "footer";
  panel.append(footer);

  return {
    host,
    update(model) {
      panel.dataset.theme = model.theme;
      panel.dataset.collapsed = model.collapsed ? "true" : "false";
      toggle.setAttribute("aria-expanded", model.collapsed ? "false" : "true");
      toggle.replaceChildren(mark(), titles(model.summary), chevron());
      const nodes: Node[] = [];
      if (model.empty) nodes.push(emptyNote());
      nodes.push(checks(model.results));
      body.replaceChildren(...nodes);
      footer.textContent = `Signals ${model.footer}`;
    },
    destroy() {
      host.remove();
    },
  };
}

export function placePanel(host: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const width = 300;
  const gap = 12;
  let left = rect.right + gap;
  let top = rect.top;
  if (left + width > window.innerWidth - 8) {
    left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    top = rect.bottom + gap;
  }
  top = Math.max(8, Math.min(top, window.innerHeight - 48));
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.zIndex = "2147483646";
  host.style.top = `${top}px`;
  host.style.left = `${Math.max(8, left)}px`;
  host.style.width = `${width}px`;
}

function mark(): HTMLElement {
  const node = document.createElement("span");
  node.className = "mark";
  node.textContent = "✓";
  return node;
}

function titles(summary: string): HTMLElement {
  const node = document.createElement("span");
  node.className = "titles";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = "Reply Lint";
  const line = document.createElement("span");
  line.className = "summary";
  line.textContent = summary;
  node.append(name, line);
  return node;
}

function chevron(): HTMLElement {
  const node = document.createElement("span");
  node.className = "chevron";
  node.setAttribute("aria-hidden", "true");
  return node;
}

function emptyNote(): HTMLElement {
  const note = document.createElement("p");
  note.className = "empty";
  note.textContent = "Type a reply to score it.";
  return note;
}

function checks(results: CheckResult[]): HTMLElement {
  const list = document.createElement("ul");
  list.className = "checks";
  for (const result of results) list.append(checkRow(result));
  return list;
}

function checkRow(result: CheckResult): HTMLElement {
  const item = document.createElement("li");
  item.className = "check";
  item.dataset.status = result.status;

  const dot = document.createElement("span");
  dot.className = "dot";
  const sr = document.createElement("span");
  sr.className = "sr";
  sr.textContent = STATUS_LABEL[result.status];
  dot.append(sr);

  const copy = document.createElement("div");
  const head = document.createElement("div");
  head.className = "head";
  const title = document.createElement("p");
  title.className = "check-title";
  title.textContent = result.title;
  head.append(title, tags(result));

  const reason = document.createElement("p");
  reason.className = "reason";
  reason.textContent = result.reason;
  copy.append(head, reason);
  item.append(dot, copy);
  return item;
}

function tags(result: CheckResult): HTMLElement {
  const row = document.createElement("span");
  row.className = "tags";
  for (const tag of result.tags) {
    if (tag.url) {
      const link = document.createElement("a");
      link.className = "tag";
      link.href = tag.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = tag.label;
      row.append(link);
    } else {
      const chip = document.createElement("span");
      chip.className = "tag";
      chip.textContent = tag.label;
      row.append(chip);
    }
  }
  return row;
}
