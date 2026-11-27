import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const { execFile } = await import("node:child_process");
const { promisify } = await import("node:util");
await promisify(execFile)(process.execPath, ["scripts/icons.mjs"], { cwd: root });

await bundle({
  entry: "src/content/index.ts",
  name: "ReplyLintContent",
  formats: ["iife"],
  fileName: () => "content.js",
});

await bundle({
  entry: "src/background/index.ts",
  name: "ReplyLintBackground",
  formats: ["es"],
  fileName: () => "background.js",
});

await bundle({
  entry: "src/options/options.ts",
  name: "ReplyLintOptions",
  formats: ["iife"],
  fileName: () => "options.js",
});

const html = await readFile(resolve(root, "src/options/index.html"), "utf8");
await writeFile(
  resolve(dist, "options.html"),
  html.replace(
    '<script type="module" src="./options.ts"></script>',
    '<script src="options.js"></script>',
  ),
);

await cp(resolve(root, "public/manifest.json"), resolve(dist, "manifest.json"));
await cp(resolve(root, "public/icons"), resolve(dist, "icons"), { recursive: true });

console.log("Built dist/. Load that folder as an unpacked extension.");

async function bundle({ entry, name, formats, fileName }) {
  await build({
    configFile: false,
    root,
    logLevel: "warn",
    build: {
      emptyOutDir: false,
      outDir: dist,
      sourcemap: true,
      minify: false,
      cssCodeSplit: false,
      lib: {
        entry: resolve(root, entry),
        name,
        formats,
        fileName,
      },
      rollupOptions: {
        output: {
          extend: true,
          inlineDynamicImports: true,
        },
      },
    },
  });
}
