/**
 * Copies the onnxruntime-web runtime files that transformers.js needs into
 * public/ort/, so they're served from our own origin instead of a third-party
 * CDN. This keeps Jima's privacy promise (nothing but the HF model download
 * leaves the user's origin) and makes transcription work offline once cached.
 *
 * We set `env.backends.onnx.wasm.wasmPaths = '/ort/'`, which makes ORT resolve
 * BOTH its loader glue (`*.mjs`) AND the wasm binaries (`*.wasm`) against that
 * directory. ORT dynamically picks a variant at runtime (the WebGPU/JSEP path
 * also pulls in the asyncify build), so we must ship every variant — the
 * browser then downloads only the one it actually uses.
 *
 * These files are large and reproducible from node_modules, so public/ort/ is
 * gitignored rather than committed. Runs automatically before `dev` and `build`.
 */
import { mkdirSync, copyFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web');
const srcDir = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const outDir = join(root, 'public', 'ort');

if (!existsSync(srcDir)) {
  console.error(`[copy-ort-wasm] missing onnxruntime-web at ${srcDir} — run pnpm install first.`);
  process.exit(1);
}

// Every threaded runtime variant's loader (.mjs) and binary (.wasm).
const pattern = /^ort-wasm-simd-threaded.*\.(mjs|wasm)$/;
const files = readdirSync(srcDir).filter((name) => pattern.test(name));

mkdirSync(outDir, { recursive: true });

let copied = 0;
let bytes = 0;
for (const name of files) {
  const src = join(srcDir, name);
  const dest = join(outDir, name);
  const size = statSync(src).size;
  // Skip if already present and identical in size (fast re-runs).
  if (existsSync(dest) && statSync(dest).size === size) {
    copied++;
    continue;
  }
  copyFileSync(src, dest);
  copied++;
  bytes += size;
}

console.log(
  `[copy-ort-wasm] ${copied}/${files.length} file(s) ready in public/ort/` +
    (bytes ? ` (${(bytes / 1e6).toFixed(1)} MB copied)` : ' (up to date)'),
);
