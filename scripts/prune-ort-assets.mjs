/**
 * Post-build cleanup. Vite emits an onnxruntime-web wasm variant (~23 MB) from
 * a `new URL(...)` in a code path Jima never runs: transformers.js v4 uses only
 * the JSEP build, which we serve from /ort/ (see copy-ort-wasm.mjs) via
 * `env.backends.onnx.wasm.wasmPaths`. So the copy Vite drops in /assets/ is
 * never fetched — remove it so the deployment stays lean.
 */
import { readdirSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web');
const assetsDir = join(root, 'dist', 'assets');

let removed = 0;
let bytes = 0;
try {
  for (const name of readdirSync(assetsDir)) {
    if (/^ort-wasm.*\.wasm$/.test(name)) {
      const full = join(assetsDir, name);
      bytes += statSync(full).size;
      rmSync(full);
      removed++;
    }
  }
} catch {
  // No dist/assets (e.g. build skipped) — nothing to prune.
}

console.log(`[prune-ort-assets] removed ${removed} redundant wasm asset(s), ${(bytes / 1e6).toFixed(1)} MB`);
