import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outBack,
  outQuint,
  inCubic,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const PALETTES: Palette[] = [
  { id: "ink-trio", name: "Ink trio", colors: { background: "#0F0F13", textColor: "#FFFFFF", bar1: "#FF4D1C", bar2: "#3455E6", bar3: "#D8F34D" } },
  { id: "paper-bold", name: "Paper bold", colors: { background: "#FFFFFF", textColor: "#101014", bar1: "#FF4D1C", bar2: "#101014", bar3: "#FFD23F" } },
  { id: "berry-pop", name: "Berry pop", colors: { background: "#160A14", textColor: "#FFFFFF", bar1: "#FF2E9E", bar2: "#7C5CFF", bar3: "#FF8A3D" } },
  { id: "ocean-fresh", name: "Ocean fresh", colors: { background: "#EAF6FF", textColor: "#05263D", bar1: "#2E9BF0", bar2: "#05263D", bar3: "#2FBF9F" } },
];

/** Greedy-wrap into ≤ maxLines lines, then shrink so the widest line fits. */
function wrapAndFit(
  fonts: TemplateContext["fonts"],
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; size: number } {
  const family = fonts.family(role);
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight, size: sz });
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [""], size: size0 };
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || measure(next, size0) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  let packed = lines;
  if (packed.length > maxLines) {
    packed = [...packed.slice(0, maxLines - 1), packed.slice(maxLines - 1).join(" ")];
  }
  let size = size0;
  for (let guard = 0; guard < 8; guard++) {
    const widest = Math.max(...packed.map((l) => measure(l, size)));
    if (widest <= maxWidth || widest === 0) break;
    size = Math.max(16, Math.floor(size * (maxWidth / widest)));
  }
  return { lines: packed, size };
}

function fontFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.075;
    case "9:16":
      return 0.11;
    case "4:5":
      return 0.1;
    case "1:1":
      return 0.1;
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#FFFFFF"));
  const textColor = str(values.textColor, pcol("textColor", "#101014"));
  const bar1 = str(values.bar1, pcol("bar1", "#FF4D1C"));
  const bar2 = str(values.bar2, pcol("bar2", "#101014"));
  const bar3 = str(values.bar3, pcol("bar3", "#FFD23F"));
  const barColors = [bar1, bar2, bar3];
  const title = str(values.title, "Let's begin");
  const barCount = Math.round(clamp(num(values.barCount, 4), 3, 6));

  const W = size.width;
  const H = size.height;
  const DUR = 4.0;

  const bgRect = new Graphics().rect(-W / 2, -H / 2, W, H).fill(bg);
  bgRect.position.set(W / 2, H / 2);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Title, hidden behind the bar stack until it clears ---
  const titleSize0 = Math.round(W * fontFrac(ctx.aspect));
  const { lines, size: titleSize } = wrapAndFit(fonts, title, "display", 700, titleSize0, W * 0.78, 2);
  const titleLH = Math.round(titleSize * 1.1);
  const titleText = makeText(fonts, {
    text: lines.join("\n"),
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
    lineHeight: titleLH,
  });
  titleText.position.set(W / 2, H / 2);
  titleText.scale.set(0.94);
  titleText.alpha = 0;
  root.addChild(titleText);
  // Hidden until the bar stack fully covers the frame — otherwise the title is
  // visible in the gaps for the first ~0.2s, before any bar has arrived (the
  // whole point is a wipe-to-reveal). Both the 0 and the later 1 are timeline
  // `set`s (not a one-time build assignment) so alpha is a pure function of t —
  // seeking backward re-establishes 0, keeping re-seek pixel-exact.
  timeline.set(titleText, "alpha", 0, 0);

  // --- Bar stack: staggered, alternating-direction wipe across, then clear ---
  const entryStart0 = 0.15;
  const entryEach = 0.08;
  const entryDur = 0.5;
  const exitEach = 0.07;
  const exitDur = 0.5;
  const holdGap = 0.28;

  let lastEntryEnd = 0;
  const bars: { bar: Graphics; dir: 1 | -1 }[] = [];
  for (let i = 0; i < barCount; i++) {
    const top = Math.round((i * H) / barCount);
    const bot = Math.round(((i + 1) * H) / barCount);
    const h = bot - top;
    const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
    const color = barColors[i % barColors.length] ?? bar1;
    const fromX = dir > 0 ? -W : W;
    const bar = new Graphics().rect(0, 0, W, h).fill(color);
    bar.position.set(fromX, top);
    root.addChild(bar);
    bars.push({ bar, dir });

    const enterStart = entryStart0 + i * entryEach;
    const enterEnd = enterStart + entryDur;
    lastEntryEnd = Math.max(lastEntryEnd, enterEnd);
    timeline.to(bar, { prop: "x", from: fromX, to: 0, start: enterStart, duration: entryDur, ease: outQuint });
  }

  // Reveal the title only once every bar has landed (frame fully covered), so it
  // pops out from behind the stack as it clears rather than leaking early.
  timeline.set(titleText, "alpha", 1, lastEntryEnd);

  const exitStart0 = lastEntryEnd + holdGap;
  let lastExitEnd = 0;
  bars.forEach(({ bar, dir }, i) => {
    const toExitX = dir > 0 ? W : -W;
    const exitStart = exitStart0 + i * exitEach;
    const exitEnd = exitStart + exitDur;
    lastExitEnd = Math.max(lastExitEnd, exitEnd);
    timeline.to(bar, { prop: "x", from: 0, to: toExitX, start: exitStart, duration: exitDur, ease: inCubic });
  });

  // Title settles with a tiny pop right as the stack starts clearing.
  timeline
    .to(titleText, { prop: "scale.x", from: 0.94, to: 1, start: exitStart0, duration: 0.45, ease: outBack })
    .to(titleText, { prop: "scale.y", from: 0.94, to: 1, start: exitStart0, duration: 0.45, ease: outBack });

  // barCount ∈ [3,6] keeps the wipe well inside DUR (worst case ends ~2.8s),
  // leaving a clean hold; the max() is a defensive floor, not a stretch.
  return { timeline, duration: Math.max(DUR, lastExitEnd + 0.6) };
}

export const introBars: TemplateDefinition = {
  id: "intro-bars",
  name: "Bar Wipe Intro",
  tagline: "Colored bars wipe across the frame, then clear to a title.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { title: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Let's begin", maxLength: 40, shrinkToFit: true },
    { key: "barCount", type: "slider", label: "Bars", default: 4, min: 3, max: 6, step: 1 },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "bar1", type: "color", label: "Bar 1", default: "", optional: true },
    { key: "bar2", type: "color", label: "Bar 2", default: "", optional: true },
    { key: "bar3", type: "color", label: "Bar 3", default: "", optional: true },
  ],
  build,
};
