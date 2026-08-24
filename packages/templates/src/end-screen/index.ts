import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { makePill } from "../shared/ui";

/** Create text, shrinking one size if it would overflow `maxWidth` (crisp). */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(12, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "signal-red", name: "Signal red", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#C2001F", onAccent: "#FFFFFF", muted: "#ECECEC" } },
  { id: "ink-ember", name: "Ink ember", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#CC4315", onAccent: "#FFFFFF", muted: "#26262C" } },
  { id: "violet-cream", name: "Violet cream", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#4A32D8", onAccent: "#FFFFFF", muted: "#E4DBFF" } },
  { id: "midnight-ember", name: "Midnight ember", colors: { background: "#141414", textColor: "#FFFFFF", accent: "#B33A12", onAccent: "#FFFFFF", muted: "#2A2A2A" } },
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

/** Vertical band the content centers in — respects the 9:16 platform safe zone. */
function bandFor(aspect: Aspect, h: number): { top: number; bottom: number } {
  if (aspect === "9:16") return { top: 220, bottom: h - 400 };
  return { top: h * 0.1, bottom: h * 0.92 };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#FFFFFF"));
  const textColor = str(values.textColor, pcol("textColor", "#101014"));
  const accent = str(values.accent, pcol("accent", "#C2001F"));
  const onAccent = pcol("onAccent", "#FFFFFF");
  const muted = pcol("muted", "#ECECEC");
  const title = str(values.title, "Thanks for watching");
  const cta = str(values.cta, "Subscribe");
  const showFrames = on(values.showFrames);

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const DUR = 4.5;

  const bgRect = new Graphics().rect(-W / 2, -H / 2, W, H).fill(bg);
  bgRect.position.set(W / 2, H / 2);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Vertical layout: title, (optional) two frames, CTA pill ---
  const band = bandFor(ctx.aspect, H);
  const bandH = band.bottom - band.top;

  const titleSize0 = Math.round(W * (ctx.aspect === "16:9" ? 0.052 : 0.075));
  const { lines, size: titleSize } = wrapAndFit(fonts, title, "display", 700, titleSize0, W * 0.8, 2);
  const titleLH = Math.round(titleSize * 1.14);
  const titleH = lines.length * titleLH;

  const frameW = minDim * (ctx.aspect === "9:16" ? 0.4 : 0.34);
  const frameH = frameW * 0.62;
  const frameGap = W * 0.045;

  const ctaH = minDim * 0.1;

  const gap1 = bandH * 0.09;
  const gap2 = bandH * 0.1;
  const contentH = titleH + gap1 + (showFrames ? frameH + gap2 : 0) + ctaH;
  const top0 = band.top + (bandH - contentH) / 2;

  const titleY = top0 + titleH / 2;
  const framesY = top0 + titleH + gap1 + frameH / 2;
  const ctaY = showFrames ? top0 + titleH + gap1 + frameH + gap2 + ctaH / 2 : top0 + titleH + gap1 + ctaH / 2;

  // --- Title ---
  const titleYFrom = titleY - 14;
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
  titleText.position.set(W / 2, titleYFrom);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleYFrom, to: titleY, start: 0.1, duration: 0.6, ease: outExpo });

  // --- Two thumbnail placeholder frames, sliding in from either side ---
  if (showFrames) {
    const sides: (1 | -1)[] = [-1, 1];
    sides.forEach((side, i) => {
      const fx = W / 2 + side * (frameW / 2 + frameGap / 2);
      const fromX = fx + side * minDim * 0.25;
      const frame = new Container();
      frame.position.set(fromX, framesY);
      frame.alpha = 0;
      frame.addChild(new Graphics().roundRect(-frameW / 2, -frameH / 2, frameW, frameH, frameW * 0.06).fill(muted));
      const discR = frameH * 0.24;
      frame.addChild(new Graphics().circle(0, 0, discR).fill({ color: accent, alpha: 0.92 }));
      const play = makeIcon("play", discR * 1.05, { color: onAccent });
      play.position.set(discR * 0.08, 0);
      frame.addChild(play);
      root.addChild(frame);

      const start = 0.4 + i * 0.12;
      timeline
        .to(frame, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
        .to(frame, { prop: "x", from: fromX, to: fx, start, duration: 0.55, ease: outExpo });
    });
  }

  // --- Subscribe pill: pops in, then pulses gently for the rest of the hold ---
  // The label is measured first (shrunk if a long/German CTA would overflow),
  // then the pill hugs it with a comfortable minimum width.
  const ctaLabel = fitText(
    fonts,
    { text: cta.toUpperCase(), role: "display", weight: 700, size: Math.round(ctaH * 0.38), color: onAccent, anchor: 0.5, letterSpacing: 1 },
    W * 0.56,
  );
  const ctaW = Math.max(frameW * 0.9, minDim * 0.34, ctaLabel.width + ctaH * 1.1);

  const pill = new Container();
  pill.addChild(makePill(ctaW, ctaH, accent));
  ctaLabel.position.set(0, 0);
  pill.addChild(ctaLabel);
  pill.position.set(W / 2, ctaY);
  pill.alpha = 0;
  pill.scale.set(0.7);
  root.addChild(pill);

  const ctaStart = showFrames ? 0.75 : 0.55;
  timeline
    .to(pill, { prop: "alpha", from: 0, to: 1, start: ctaStart, duration: 0.3, ease: outQuad })
    .to(pill, { prop: "scale.x", from: 0.7, to: 1, start: ctaStart, duration: 0.5, ease: spring(0.4) })
    .to(pill, { prop: "scale.y", from: 0.7, to: 1, start: ctaStart, duration: 0.5, ease: spring(0.4) });

  const pulseStart = ctaStart + 0.6;
  const pulses: [number, number][] = [
    [pulseStart, 1.07],
    [pulseStart + 0.35, 1.0],
    [pulseStart + 1.1, 1.07],
    [pulseStart + 1.45, 1.0],
    [pulseStart + 2.2, 1.07],
    [pulseStart + 2.55, 1.0],
  ];
  let prevScale = 1;
  for (const [start, to] of pulses) {
    if (start >= DUR - 0.3) break;
    timeline.to(pill, { prop: "scale.x", from: prevScale, to, start, duration: 0.32, ease: outQuad });
    timeline.to(pill, { prop: "scale.y", from: prevScale, to, start, duration: 0.32, ease: outQuad });
    prevScale = to;
  }

  return { timeline, duration: DUR };
}

export const endScreen: TemplateDefinition = {
  id: "end-screen",
  name: "End Screen",
  tagline: "A YouTube-style end card — title, pulsing subscribe, video slots.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { title: "display", cta: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Thanks for watching", maxLength: 40, shrinkToFit: true },
    { key: "cta", type: "text", label: "Button", default: "Subscribe", maxLength: 20 },
    { key: "showFrames", type: "toggle", label: "Video frames", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
