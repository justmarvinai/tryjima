// Self-hosted OFL fonts. Imported by apps/web/src/main.tsx AND by the headless
// render harness, so the Motion engine's `document.fonts.load` always finds the
// faces it needs (no fallback on first paint, no blurry first export).
//
// Two distinct jobs live here:
//   1. CHROME type — Archivo (display), Geist (UI), Geist Mono (numerals).
//      These drive the Jima design system and are not user-selectable.
//   2. CONTENT type — the families a user can pick for a Motion template
//      headline/body or a caption style. These need real STATIC instances:
//      a canvas `font` string cannot express variable-font axes, so a
//      variable-only face silently renders as a fallback in the engine and in
//      the caption renderer (see docs/ARCHITECTURE.md § pitfalls).

/* ---- 1. Chrome ---- */
// Archivo Variable — display/headline face (wght + wdth axes; the system sets
// font-stretch: 108-112% for the wide, chunky look).
import "@fontsource-variable/archivo";
// Geist Variable — all UI text.
import "@fontsource-variable/geist";
// Geist Mono Variable — timecodes, durations, dimensions, counters.
import "@fontsource-variable/geist-mono";

/* ---- 2. Content: Motion template fonts ---- */
// Space Grotesk — default template display font.
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
// Inter — body role, also selectable as a headline font.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
// Fraunces — serif.
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
// JetBrains Mono — mono.
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
// Archivo STATIC instances — deliberately separate from the variable import
// above (family "Archivo" vs "Archivo Variable"): the variable face drives
// chrome, these serve the engine when a user picks Archivo for a template.
import "@fontsource/archivo/400.css";
import "@fontsource/archivo/500.css";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/sora/400.css";
import "@fontsource/sora/500.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/parkinsans/400.css";
import "@fontsource/parkinsans/500.css";
import "@fontsource/parkinsans/600.css";
import "@fontsource/parkinsans/700.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
// Noto Emoji — last-resort emoji face (OFL-1.1), at the end of every fallback
// chain. Fontsource splits it into ten unicode-range subsets, so a machine that
// does reach it fetches one small file rather than a megabyte.
import "@fontsource/noto-emoji/400.css";

/* ---- 3. Content: caption fonts ----
   Anton and Archivo Black power the caption style presets. They are declared as
   @font-face in styles/caption-fonts.css and loaded on demand through the
   FontFace loader in @jima/captions/fonts, because the export worker has no
   access to document stylesheets and must construct the faces itself. Nothing
   to import here — see apps/web/public/fonts/. */
