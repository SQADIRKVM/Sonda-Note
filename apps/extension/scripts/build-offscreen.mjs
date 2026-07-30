/**
 * Post-build step: bundle the offscreen document.
 *
 * Plasmo has no offscreen-document convention — it generates HTML only for its
 * own entry points (popup.tsx, options.tsx, …), and a hand-written .html at the
 * project root is copied verbatim without compiling the TypeScript it points at.
 * That silently produces a build whose offscreen page 404s, which would break
 * recording at runtime while the build still reports success.
 *
 * So we bundle src/offscreen.ts with esbuild (already present as a Parcel
 * dependency) and write an offscreen.html next to it that loads the result.
 *
 * Runs against every target directory under build/ so `plasmo build` and
 * `plasmo build --zip` both get a working offscreen document.
 */

import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = join(root, "build");
const entry = join(root, "src", "offscreen.ts");

const HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Sonda Note — recorder</title>
  </head>
  <body>
    <!--
      Invisible by design. Manifest V3 forbids MediaRecorder in a service worker,
      so this document holds the recorder and the upload socket for the lifetime
      of a recording.
    -->
    <script src="offscreen.js"></script>
  </body>
</html>
`;

if (!existsSync(entry)) {
  console.error(`✗ offscreen entry not found: ${entry}`);
  process.exit(1);
}

if (!existsSync(buildRoot)) {
  console.error("✗ no build/ directory — run `plasmo build` first");
  process.exit(1);
}

const targets = readdirSync(buildRoot, { withFileTypes: true })
  .filter((entryDir) => entryDir.isDirectory() && entryDir.name.includes("mv3"))
  .map((entryDir) => join(buildRoot, entryDir.name));

if (targets.length === 0) {
  console.error("✗ no mv3 build target found under build/");
  process.exit(1);
}

for (const target of targets) {
  await build({
    entryPoints: [entry],
    outfile: join(target, "offscreen.js"),
    bundle: true,
    format: "iife", // classic script: no module CSP concerns in an extension page
    target: ["chrome116"], // offscreen API requires Chrome 109+; 116 is a safe floor
    minify: true,
    legalComments: "none",
    logLevel: "warning",
  });

  writeFileSync(join(target, "offscreen.html"), HTML, "utf8");
  console.log(`✓ offscreen document written to ${target.replace(root + "/", "")}`);
}
