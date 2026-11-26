# Reply Lint

Advise-only scores for reply drafts on [x.com](https://x.com), shown beside the composer while you type.

It is a Manifest V3 Chrome extension. The rules engine is plain TypeScript. Thresholds and phrase lists live in [`signals/signals.json`](signals/signals.json), pinned to [xai-org/x-algorithm](https://github.com/xai-org/x-algorithm) commit `52d45989090e63992ba04e4f6cfccd73bf8cc05c` (2026-11-25).

## What it does

While a reply is being written, a small panel lists checks as pass, watch, or fix. Each row has one line of reason and a tag. The panel updates as you type. Length and media are shown as information, because the ranking code sets no fixed rule for them.

The active signals commit is in the panel footer (`52d4598 · 2026-11-25 · bundled` until a remote file is fetched).

## What it never does

- It does not post, and it does not click Reply.
- It does not write, insert, or modify text in the reply box.
- It does not generate reply text.
- It does not send the draft, or anything else, off the machine.

The only network request is a once-a-day fetch of `signals.json` from the URL on the options page. There is no telemetry and no analytics. If that fetch fails or the JSON does not validate, the extension keeps using the copy bundled at build time.

Reply pace and the duplicate-text check use `chrome.storage.local` only. A reply is counted when you click X's Reply button. The listener does not call `preventDefault` or `stopPropagation`. The fixture page has its own click counter so you can see the click still lands.

## Install unpacked

```bash
npm install
npm test
npm run build
```

In Chrome, open `chrome://extensions`, turn on Developer mode, choose **Load unpacked**, and select the `dist/` folder. Branded Chrome 137 and later ignores `--load-extension`, so the extensions page is the install path.

Options (pace limits, which checks are on, signals URL): extension details → Extension options. Or right-click the toolbar icon once Chrome shows it. The icon opens no popup; the panel lives next to the composer.

### Try it without an X login

`demo/composer.html` is a static reply box with the same `data-testid`s the content script looks for. The manifest matches `http://127.0.0.1:4173/*` and `http://localhost:4173/*` so the unpacked extension can attach there.

```bash
npm run demo
```

Open http://127.0.0.1:4173/composer.html with the extension loaded. Type, paste, toggle media, switch the page between dark and light, and click Reply. The page's own counter should increment. That match is for local testing; see open decisions below before a store build.

Opening the HTML file directly will not run the content script. Chrome only injects it on the matched hosts.

## How checks are tagged

Every row is one of these. A heuristic is never labeled as X's rule.

| Tag               | Means                                                                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **X's code**      | The behavior is in the pinned repo. The chip links to the file and lines.                                                                                              |
| **Our heuristic** | Our cutoff or phrase list. A second chip, when it appears, is the name of a related X label (for example `SpamHashTagAbuse`), not a claim that X published our number. |
| **Both**          | Used for pace and for duplicate text. X does the thing the link points at. The number, or the local string compare, is ours.                                           |
| **No fixed rule** | Info only. The link shows the model feature (`weighted_text_len`, `has_photo`).                                                                                        |

| Check                  | Tag           | What you see                                                                                                                                                                                  |
| ---------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typed, not pasted      | X's code      | Warns when pasted text is still in the draft. The grader is told whether a reply was pasted (`grox/core/lm/thread.py`).                                                                       |
| Sounds human           | Our heuristic | Generic openers and AI-sounding phrases from `signals.json`. X runs `llm_slop_post` detection; this list is not that classifier.                                                              |
| Engagement bait        | X's code      | Hard fail for phrases such as "like if" and "follow for more". X drops engagement bait as spam. The phrase list is our detector; the policy prompt is not in the repo, and the row says that. |
| Hashtags               | Our heuristic | Warns above `maxHashtags` (default 1). X has a `SpamHashTagAbuse` label and does not publish this cutoff.                                                                                     |
| @-mentions             | Our heuristic | Warns above `maxMentions` (default 2). X has `SpamMentionAbuse`. The cutoff is ours.                                                                                                          |
| Links                  | Our heuristic | Warns on any link. X has no general link penalty. `has_url` is a model feature, open-link weight is +0.2, and only untrusted or malicious URLs are dropped for being bad URLs.                |
| Not a repeat           | Both          | Warns when the draft matches a reply stored on this machine (at least `minChars`, default 20). X drops `DUPLICATE_CONTENT`. This compare is not X's detector.                                 |
| Reply pace             | Both          | Warns when sent replies pass your hourly or daily limit (defaults 8 and 40). The grader sees a 24-hour count. The caps are yours, edited on the options page.                                 |
| Invites a conversation | Our heuristic | Nudges when there is no question, number, or first-hand detail. Nothing in the ranking code scores that.                                                                                      |
| Length, media          | No fixed rule | Character count (not X's weighted length) and whether media is attached.                                                                                                                      |

Weights in `signals.json` are the For You value-model defaults. They multiply predicted probabilities. The extension does not, and cannot, compute a ranking score from them. See [`signals/README.md`](signals/README.md). That file is also the contract for the Morning Feed bot.

## Update signals.json

1. Edit `signals/signals.json`. Phrase lists, `maxHashtags`, `maxMentions`, `minChars`, and the default pace numbers are the usual edits.
2. Keep `source.commit` honest. If you move the pin, re-read the cited lines and update the weight table. Do not invent weights. `tests/engine.test.ts` locks the current table.
3. `npm test` validates the file against `signals/signals.schema.json` and against the runtime checker the service worker uses.
4. `npm run build` bundles the file into the extension. Reload the unpacked extension.

The service worker reads whatever URL is saved in options (default: the raw GitHub URL for this file on `main`), once a day via `chrome.alarms`, validates it, and stores it in `chrome.storage.local`. A bad or unreachable file does not replace a previously good cache. With no good cache, the panel uses the bundled copy. The footer says which one is active.

No token is read, stored, or sent. A private raw URL will 404, and that is handled.

### Private-repo fetch (decision for John)

This repo is private, so `raw.githubusercontent.com` will fail without auth. The extension must not embed a token. Pick one:

1. **Make the repo public**, or make only `signals/signals.json` public. The default URL then works.
2. **Publish the file somewhere else** the manifest already allows: a public gist (`gist.githubusercontent.com`) or a GitHub Pages URL (`*.github.io`). Put that URL on the options page.
3. **Leave the fetch failing** and ship the bundled copy. The panel still works offline. Update signals by rebuilding the extension.

A URL on any other host needs a matching entry in `host_permissions` in `public/manifest.json`. The allowlist is raw GitHub, gists, and GitHub Pages so the extension is not granted the whole web.

## Develop

```bash
npm test       # vitest, rules engine + schema
npm run lint   # eslint + prettier
npm run build  # dist/ ready to load
npm run demo   # fixture on port 4173
```

Layout:

| Path                       | Role                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `src/engine/`              | Pure checks. `(draft, context, signals, settings) => result`.                       |
| `src/content/selectors.ts` | Composer, reply button, and media selectors. X's DOM changes; edit this file first. |
| `src/content/panel.ts`     | Shadow DOM panel. Styles do not enter or leave the shadow root.                     |
| `src/background/index.ts`  | Daily fetch. The only `fetch` in the project.                                       |
| `src/options/`             | Pace limits, check toggles, signals URL.                                            |
| `signals/`                 | The JSON, the schema, and the note for Morning Feed.                                |
| `demo/composer.html`       | Fixture composer.                                                                   |

The build is Vite multi-entry without a Chrome plugin: content script and options as IIFE, service worker as an ES module. Output is unminified so the unpacked extension is readable.

Stack: TypeScript, Vite, Vitest, ESLint, Prettier. No UI framework.

## Phase two

Not in this MVP.

- **Signals diff bot.** A GitHub Action polls `watchedPaths` in `signals.json` against x-algorithm (commit messages there are all "Open-source X Recommendation Algorithm", so diff file contents). Parse `param!(Name, f64, "key", value)` and open a PR that updates weights and line numbers. Copy-link going to 0 for five days in November 2026 is the case this should catch.
- **Big-account warning.** If the parent author's follower count in the page DOM is over 250,000, say that Grok grades the reply 0–3 and a 0 hides it from non-followers. The constant is `GROK_GEMMA_FOLLOWER_SPLIT` in `grox/flows/reply_spam/constants.py`.
- **Mutual detection** from the page, so the panel can remind you that the +15 bidirectional reply boost does not apply to replies (`xai-value-model/inputs.rs`).
- **24h calibration.** Compare the local reply counter with whatever the product UI exposes, and say when the local count is only "replies sent while this extension was installed".
- **Unlisted Web Store build.** Drop the `127.0.0.1:4173` match, keep the same advise-only permissions, and publish unlisted if you want it off your laptop.

## Open decisions

These are left for you. Defaults are in place so the extension runs.

1. How should the daily signals fetch reach a private repo? Public file, gist, Pages, or bundled-only. See above. Do not add a token.
2. Pace defaults are 8 replies per hour and 40 per day. They are guesses. X does not publish the `fast_reply_spam_post` threshold.
3. The manifest matches the fixture port `4173`. Remove those two match patterns before a store build if you do not want the extension on local pages.
4. The phrase lists are a starting set. They will be wrong for your voice until you edit them.
5. The link warning fires on any link, and it is noisy if you reply with links on purpose. It is a heuristic and it can be turned off.
6. `host_permissions` is limited to GitHub raw, gists, and GitHub Pages. Say if the signals URL should live somewhere else.
