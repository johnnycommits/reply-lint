export const COMPOSER_SELECTORS = [
  '[data-testid="tweetTextarea_0"]',
  'div[contenteditable="true"][data-testid^="tweetTextarea"]',
  'div[contenteditable="true"][role="textbox"]',
] as const;

export const REPLY_BUTTON_SELECTORS = [
  '[data-testid="tweetButtonInline"]',
  '[data-testid="tweetButton"]',
  'button[data-testid*="tweetButton"]',
] as const;

export const MEDIA_SELECTORS = [
  '[data-testid="attachments"]',
  '[data-testid="mediaPreview"]',
  '[data-testid="removeMedia"]',
  '[data-testid="videoPlayer"]',
] as const;

export function findComposers(root: ParentNode): HTMLElement[] {
  const found: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  for (const selector of COMPOSER_SELECTORS) {
    for (const node of root.querySelectorAll<HTMLElement>(selector)) {
      if (seen.has(node) || !isReplyComposer(node)) continue;
      seen.add(node);
      found.push(node);
    }
  }
  return found;
}

export function findComposerRoot(composer: HTMLElement): HTMLElement {
  let node: HTMLElement | null = composer;
  let last = composer;
  for (let depth = 0; depth < 8 && node; depth += 1) {
    if (findReplyButton(node)) return node;
    last = node;
    node = node.parentElement;
  }
  return last.parentElement ?? last;
}

export function findReplyButton(root: ParentNode): HTMLElement | null {
  for (const selector of REPLY_BUTTON_SELECTORS) {
    const button = root.querySelector<HTMLElement>(selector);
    if (button) return button;
  }
  return null;
}

export function mediaAttached(root: ParentNode): boolean {
  return MEDIA_SELECTORS.some((selector) => root.querySelector(selector));
}

export function readComposerText(composer: HTMLElement): string {
  const text = composer.innerText || composer.textContent || "";
  return text.replace(/\u00a0/g, " ").replace(/\n$/, "");
}

function isReplyComposer(node: HTMLElement): boolean {
  if (node.getAttribute("contenteditable") !== "true") return false;
  if (node.closest("#reply-lint-host")) return false;
  return node.getClientRects().length > 0 || node.isConnected;
}
