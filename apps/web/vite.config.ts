import { defineConfig } from "vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/*
 * Cross-origin isolation headers.
 *
 * Jima Captions runs Whisper through transformers.js, whose WASM backend only
 * goes multithreaded when `SharedArrayBuffer` is available — and that requires
 * the document to be cross-origin isolated. `credentialless` (rather than
 * `require-corp`) is what lets the cross-origin model download from the Hugging
 * Face CDN through without every response carrying a CORP header.
 *
 * They are set on EVERY route, not just /captions: isolation is a property of
 * the document that was loaded, so a user who lands on `/` and then client-side
 * navigates into Captions would otherwise arrive without it. Nothing else in
 * the app loads cross-origin subresources, so there is no cost.
 *
 * vercel.json sets the same headers in production — keep the two in sync.
 */
const crossOriginIsolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

// The production build ships only the app (index.html). The headless render
// harness (harness.html) is test-only — Vite's dev server serves it by path
// during the Playwright golden-frame/export-smoke runs, so it never bloats the
// deployed bundle.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  build: {
    target: "es2022",
  },
  worker: {
    format: "es",
  },
});
