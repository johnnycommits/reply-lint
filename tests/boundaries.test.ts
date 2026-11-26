import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("advise-only boundaries", () => {
  it("fetches from the service worker only", () => {
    const files = walk(join(root, "src")).filter((file) => file.endsWith(".ts"));
    const fetches = files.filter((file) => readFileSync(file, "utf8").includes("fetch("));
    expect(fetches.map((file) => relative(root, file))).toEqual([
      "src/background/index.ts",
    ]);
  });

  it("does not block or rewrite the composer", () => {
    const content = walk(join(root, "src/content"))
      .filter((file) => file.endsWith(".ts"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    for (const forbidden of [
      /\.preventDefault\s*\(/,
      /\.stopPropagation\s*\(/,
      /\.stopImmediatePropagation\s*\(/,
      /document\.execCommand\s*\(/,
      /\.innerHTML\s*=/,
      /sendBeacon\s*\(/,
      /new XMLHttpRequest\s*\(/,
      /new WebSocket\s*\(/,
    ]) {
      expect(content).not.toMatch(forbidden);
    }
  });
});

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}
