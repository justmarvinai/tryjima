// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

/**
 * Determinism guard (CLAUDE.md hard rule 6, TECHNICAL_ARCHITECTURE.md §6.1):
 * engine + templates must be pure f(t, values, aspect, seed). No wall-clock,
 * no unseeded randomness. Also enforces the GSAP ban (ADR-001) everywhere.
 */
const determinismRules = {
  "no-restricted-properties": [
    "error",
    { object: "Date", property: "now", message: "Determinism: use the seeded/injected clock, not Date.now (TECHNICAL_ARCHITECTURE.md §6.1)." },
    { object: "Math", property: "random", message: "Determinism: use the seeded RNG from template context, not Math.random." },
    { object: "performance", property: "now", message: "Determinism: time comes from the frame index / injected clock, not performance.now." },
  ],
  "no-restricted-syntax": [
    "error",
    { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: "Determinism: argless `new Date()` reads the wall clock. Pass an explicit timestamp." },
  ],
  // Broaden the determinism/purity net beyond wall-clock + Math.random: these
  // globals are locale-dependent, unseeded-random, environment-reading or
  // network, none of which belong in the pure f(t) render path (CLAUDE.md rule
  // 6). They have zero legitimate use in engine/templates today; the legit
  // browser APIs (document/fetch/requestAnimationFrame for fonts, image loading
  // and preview) are deliberately not restricted.
  "no-restricted-globals": [
    "error",
    { name: "Intl", message: "Determinism: locale-dependent formatting varies by environment — use the deterministic helpers in shared/format.ts." },
    { name: "crypto", message: "Determinism: use the seeded RNG from template context, not crypto." },
    { name: "navigator", message: "Purity: no environment reads in the pure render path." },
    { name: "localStorage", message: "Purity: no storage reads in engine/templates." },
    { name: "sessionStorage", message: "Purity: no storage reads in engine/templates." },
    { name: "XMLHttpRequest", message: "Purity: no network in the render path." },
    { name: "WebSocket", message: "Purity: no network in the render path." },
  ],
};

const noGsap = {
  "no-restricted-imports": [
    "error",
    { patterns: [{ group: ["gsap", "gsap/*"], message: "GSAP is banned (ADR-001): its post-Webflow license forbids no-code animation tools like Jima." }] },
  ],
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.tsbuildinfo",
      "playwright-report/**",
      "test-results/**",
      "**/.vercel/**",
      // Vendored onnxruntime-web runtime, copied out of node_modules by
      // scripts/copy-ort-wasm.mjs at pre(dev|build). Generated third-party
      // code — not ours to lint, and gitignored.
      "apps/web/public/ort/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      ...noGsap,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
    },
  },
  {
    // The determinism guard applies only to the pure packages.
    files: ["packages/engine/**/*.ts", "packages/templates/**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.bench.ts"],
    rules: determinismRules,
  },
  {
    // React hooks correctness for the web app.
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "tests/**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
);
