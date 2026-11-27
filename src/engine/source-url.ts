const COMMIT = /^[0-9a-f]{40}$/;

export function sourceUrl(
  repo: string,
  commit: string,
  path: string,
  lines: readonly [number, number],
): string {
  if (!COMMIT.test(commit)) {
    throw new Error("source commit must be a 40-character sha");
  }
  const [start, end] = lines;
  const base = `https://github.com/${repo}/blob/${commit}/${path}`;
  if (start === end) return `${base}#L${start}`;
  return `${base}#L${start}-L${end}`;
}
