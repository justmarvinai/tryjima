import { Graphics, Text, TextStyle } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  linear,
  outQuad,
  outCubic,
  outQuint,
  outExpo,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Echo Zoom — the headline lands once, then stroke-only copies of the exact
// letterforms scale outward and fade like ripples on a beat, three times in a
// row. The hold keeps one crisp fill plus one faint outline echo. Continuous
// outward outline ripples — not a single zoom slam and not a shine sweep.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#FFFFFF", textColor: "#121216", accent: "#FF4D1C" } },
  { id: "paper-indigo", name: "Paper indigo", colors: { background: "#F2F1FB", textColor: "#221A5E", accent: "#5B4BEB" } },
  { id: "mint-club", name: "Mint club", colors: { background: "#E9F7EF", textColor: "#0F3D2A", accent: "#12A150" } },
  { id: "club-night", name: "Club night", colors: { background: "#121018", textColor: "#F4F1EA", accent: "#3BD6C3" } },
];

interface Layout {
  fontFrac: number; // of canvas width
  maxWidthFrac: number;
  centerFrac: number; // of safe-rect height
}

function layoutOf(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.105, maxWidthFrac: 0.66, centerFrac: 0.45 };
    case "9:16":
      return { fontFrac: 0.125, maxWidthFrac: 0.7, centerFrac: 0.44 };
    case "4:5":
      return { fontFrac: 0.12, maxWidthFrac: 0.72, centerFrac: 0.44 };
    case "1:1":
    default:
      return { fontFrac: 0.118, maxWidthFrac: 0.72, centerFrac: 0.45 };
  }
}

/** Greedy-wrap into <= 2 lines, then shrink so the widest line fits maxWidth. */
function wrapAndFit(
  fonts: FontRegistry,
  text: string,
  size0: number,
  maxWidth: number,
): { joined: string; size: number } {
  const family = fonts.family("display");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight: 700, size: sz });
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { joined: "", size: size0 };
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
  if (packed.length > 2) packed = [packed[0]!, packed.slice(1).join(" ")];
  let size = size0;
  for (let guard = 0; guard < 8; guard++) {
    const widest = Math.max(...packed.map((l) => measure(l, size)));
    if (widest <= maxWidth || widest === 0) break;
    size = Math.max(14, Math.floor(size * (maxWidth / widest)));
  }
  return { joined: packed.join("\n"), size };
}

/** Stroke-only copy of the headline (transparent fill, round joins). */
function makeOutline(
  fonts: FontRegistry,
  text: string,
  size: number,
  lineHeight: number,
  color: string,
  width: number,
): Text {
  const style = new TextStyle({
    fontFamily: fonts.family("display"),
    fontSize: size,
    fontWeight: "700",
    fill: { color: "#FFFFFF", alpha: 0 },
    stroke: { color, width, join: "round" },
    align: "center",
    lineHeight,
  });
  const t = new Text({ text, style });
  t.anchor.set(0.5);
  return t;
}

const LAND_AT = 0.3;
const EMITS = [0.95, 1.6, 2.25] as const;
const HOLD_ECHO_AT = 2.95;
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#121216"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Turn it up");
  const subline = typeof values.subline === "string" ? values.subline : "";
  const showDots = on(values.showDots);

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const L = layoutOf(ctx.aspect);
  const cx = w / 2;
  const cy = zone.y + zone.height * L.centerFrac;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const { joined, size: fs } = wrapAndFit(fonts, headline, Math.round(w * L.fontFrac), zone.width * L.maxWidthFrac);
  const lineHeight = Math.round(fs * 1.06);
  const strokeW = Math.max(2, Math.round(fs * 0.035));
  const timeline = new JimaTimeline();

  // --- Rippling outline echoes (behind the fill) ---
  // Each emission jumps to full echo alpha, then expands and fades out.
  for (const emitAt of EMITS) {
    const echo = makeOutline(fonts, joined, fs, lineHeight, accent, strokeW);
    echo.position.set(cx, cy);
    echo.alpha = 0;
    root.addChild(echo);
    timeline
      .to(echo, { prop: "alpha", from: 0, to: 0, start: 0, duration: 0, ease: linear })
      .to(echo, { prop: "alpha", from: 0.42, to: 0, start: emitAt, duration: 1.05, ease: outQuad })
      .to(echo, { prop: "scale.x", from: 1, to: 1.55, start: emitAt, duration: 1.05, ease: outCubic })
      .to(echo, { prop: "scale.y", from: 1, to: 1.55, start: emitAt, duration: 1.05, ease: outCubic });
  }

  // The held echo: expands a little and stays as part of the end frame.
  const heldEcho = makeOutline(fonts, joined, fs, lineHeight, accent, strokeW);
  heldEcho.position.set(cx, cy);
  heldEcho.alpha = 0;
  root.addChild(heldEcho);
  timeline
    .to(heldEcho, { prop: "alpha", from: 0, to: 0, start: 0, duration: 0, ease: linear })
    .to(heldEcho, { prop: "alpha", from: 0, to: 0.32, start: HOLD_ECHO_AT, duration: 0.5, ease: outQuad })
    .to(heldEcho, { prop: "scale.x", from: 1, to: 1.12, start: HOLD_ECHO_AT, duration: 0.6, ease: outExpo })
    .to(heldEcho, { prop: "scale.y", from: 1, to: 1.12, start: HOLD_ECHO_AT, duration: 0.6, ease: outExpo });

  // --- The crisp fill headline lands once, then pulses with each emission ---
  const main = makeText(fonts, {
    text: joined,
    role: "display",
    weight: 700,
    size: fs,
    color: textColor,
    align: "center",
    anchor: 0.5,
    lineHeight,
  });
  main.position.set(cx, cy);
  main.alpha = 0;
  root.addChild(main);
  timeline
    .to(main, { prop: "alpha", from: 0, to: 1, start: LAND_AT, duration: 0.3, ease: outQuad })
    .to(main, { prop: "scale.x", from: 1.6, to: 1, start: LAND_AT, duration: 0.55, ease: outQuint })
    .to(main, { prop: "scale.y", from: 1.6, to: 1, start: LAND_AT, duration: 0.55, ease: outQuint });
  for (const emitAt of EMITS) {
    timeline
      .to(main, { prop: "scale.x", from: 1, to: 1.035, start: emitAt, duration: 0.12, ease: outQuad })
      .to(main, { prop: "scale.y", from: 1, to: 1.035, start: emitAt, duration: 0.12, ease: outQuad })
      .to(main, { prop: "scale.x", from: 1.035, to: 1, start: emitAt + 0.12, duration: 0.3, ease: outQuad })
      .to(main, { prop: "scale.y", from: 1.035, to: 1, start: emitAt + 0.12, duration: 0.3, ease: outQuad });
  }

  const blockH = main.height;

  // --- Beat dots under the headline, pulsing with each emission ---
  const dotsY = cy + blockH / 2 + fs * 0.55;
  if (showDots) {
    const gap = fs * 0.44;
    const r = Math.max(4, fs * 0.052);
    EMITS.forEach((emitAt, i) => {
      const dot = new Graphics().circle(0, 0, r).fill(accent);
      dot.position.set(cx + (i - 1) * gap, dotsY);
      dot.alpha = 0;
      root.addChild(dot);
      timeline
        .to(dot, { prop: "alpha", from: 0, to: 0.9, start: 0.75, duration: 0.3, ease: outQuad })
        .to(dot, { prop: "scale.x", from: 1, to: 1.6, start: emitAt, duration: 0.14, ease: outQuad })
        .to(dot, { prop: "scale.y", from: 1, to: 1.6, start: emitAt, duration: 0.14, ease: outQuad })
        .to(dot, { prop: "scale.x", from: 1.6, to: 1, start: emitAt + 0.14, duration: 0.35, ease: outQuad })
        .to(dot, { prop: "scale.y", from: 1.6, to: 1, start: emitAt + 0.14, duration: 0.35, ease: outQuad });
    });
  }

  // --- Subline ---
  if (subline.length > 0) {
    const subSize = Math.max(15, Math.round(fs * 0.2));
    const subY = dotsY + fs * 0.55;
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 500,
      size: subSize,
      color: textColor,
      anchor: 0.5,
    });
    sub.position.set(cx, subY);
    sub.alpha = 0;
    root.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.9, start: 3.2, duration: 0.5, ease: outQuad })
      .to(sub, { prop: "y", from: subY + 12, to: subY, start: 3.2, duration: 0.55, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const echoZoom: TemplateDefinition = {
  id: "echo-zoom",
  name: "Echo Zoom",
  tagline: "Outlined copies of the headline ripple outward on a steady beat.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.8,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Turn it up", maxLength: 28, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Louder every time", maxLength: 48, optional: true },
    { key: "showDots", type: "toggle", label: "Beat dots", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Echoes", default: "", optional: true },
  ],
  build,
};
