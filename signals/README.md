# signals.json

Single source of truth for Reply Lint and for the Morning Feed bot. Both should read this file. Neither should hard-code weights.

The file is pinned to one commit of [xai-org/x-algorithm](https://github.com/xai-org/x-algorithm). The pin lives in `source`. Line numbers are for that commit, not for whatever HEAD is today.

JSON Schema: [`signals.schema.json`](./signals.schema.json). The extension rejects a fetch that fails the same checks (`src/engine/validate.ts`) and keeps the copy bundled at build time.

## What the bot should read

| Field                                 | Use                                                                                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`                       | Only `1` is understood. Refuse anything else.                                                                                                                                                                  |
| `source.commit` / `source.commitDate` | Show which algorithm snapshot the scores came from.                                                                                                                                                            |
| `caveat`                              | Weights are multipliers on predicted probabilities, not on like counts. Do not turn a weight ratio into "one report cancels N likes".                                                                          |
| `weights[]`                           | For You value-model defaults at the pin. `weight`, `id`, `path`, `lines`. `home-mixer/params/param.rs` is the source of truth. `vm-ranker/params.rs` repeats names with older defaults and is not copied here. |
| `replyRisks[]`                        | Facts about replies: paste, 24h volume, 250k Grok grading, slop labels, engagement-bait drops, duplicate-content drops. Each fact has one or more `sources` with `path` and `lines`.                           |
| `watchedPaths`                        | Paths a future diff job should poll. Commit messages in that repo are all identical, so diff file content.                                                                                                     |

Build a browser link the same way the extension does:

`https://github.com/{source.repo}/blob/{source.commit}/{path}#L{start}-L{end}`

Use `#L{line}` when start and end are the same.

## What the bot should not treat as an X rule

`checks` configures the extension. Phrase lists, hashtag and mention cutoffs, the link warning, and the pace limits are ours. The `tag` on each check says so:

| `tag`       | Meaning                                                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x-code`    | The behavior is in the pinned repo. `source` is the file and lines. A `detectorNote`, when present, means the phrase list is only how the extension notices that behavior. |
| `heuristic` | Our check. `related` may name an X label that inspired it. The label is not the cutoff.                                                                                    |
| `mixed`     | Both. Pace is the example: X shows the grader a 24-hour reply count (`source`), and the numeric cap is `heuristicNote`.                                                    |
| `info`      | Shown, never pass or fail. Length and media are model features with no hand-set threshold.                                                                                 |

Morning Feed can ignore `checks` and score from `weights` plus `replyRisks`. If it wants the same draft warnings as the extension, it should call the same rules with the thresholds in `checks`, and it should show the same tags.

## Changing the file

Edit thresholds and phrase lists here when the advice should move but the code should not. Adding a new check id needs a code change in `src/engine/checks/` as well as a schema change. A remote file with an unknown check id is rejected so a typo cannot silently drop a check.

After editing, run `npm test`. The weight table is locked in `tests/engine.test.ts` to the numbers read from `param.rs` at `52d45989090e63992ba04e4f6cfccd73bf8cc05c`. Do not "fix" a test by inventing a weight. Re-read the file at the new commit, then update `source`, the table, and the test together.
