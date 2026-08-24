import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon, type IconName } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "cream-ink", name: "Cream + ink", colors: { background: "#FFF6EA", textColor: "#241407", accent: "#FF4D1C" } },
  { id: "ink-night", name: "Ink night", colors: { background: "#15111B", textColor: "#FFFFFF", accent: "#FF6A3D" } },
  { id: "blush", name: "Blush", colors: { background: "#FFEDF3", textColor: "#3A0A1E", accent: "#FF2E7A" } },
  { id: "sage", name: "Sage", colors: { background: "#EFF6EE", textColor: "#122417", accent: "#2F9E63" } },
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
    size = Math.max(14, Math.floor(size * (maxWidth / widest)));
  }
  return { lines: packed, size };
}

function fontFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.1;
    case "9:16":
      return 0.15;
    case "4:5":
      return 0.135;
    case "1:1":
      return 0.14;
  }
}

const PARTICLE_KINDS: IconName[] = ["heart", "star"];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#FFF6EA"));
  const textColor = str(values.textColor, pcol("textColor", "#241407"));
  const accent = str(values.accent, pcol("accent", "#FF4D1C"));
  const message = str(values.message, "Thank you!");
  const handle = str(values.handle, "@yourbrand");
  const showHearts = on(values.showHearts);

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const DUR = 4.2;

  // --- Background (full-frame, first child so transparent export can blank it) ---
  const bgRect = new Graphics().rect(-W / 2, -H / 2, W, H).fill(bg);
  bgRect.position.set(W / 2, H / 2);
  bgRect.label = "bg";
  bgRect.scale.set(1.02);
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  timeline
    .to(bgRect, { prop: "scale.x", from: 1.02, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(bgRect, { prop: "scale.y", from: 1.02, to: 1, start: 0, duration: 0.4, ease: outQuad });

  // --- Floating hearts / sparkles (ambient, decorative — toggleable) ---
  interface Particle {
    g: Graphics;
    x: number;
    delay: number;
    period: number;
    sway: number;
    swayFreq: number;
    phase: number;
    peakAlpha: number;
  }
  const particles: Particle[] = [];
  if (showHearts) {
    const N = 14;
    for (let i = 0; i < N; i++) {
      const kind = rng.pick(PARTICLE_KINDS);
      const s = minDim * rng.range(0.022, 0.042);
      const color = rng.pick([accent, textColor]);
      const g = makeIcon(kind, s, { color });
      g.alpha = 0;
      root.addChild(g);
      particles.push({
        g,
        x: W * rng.range(0.16, 0.84),
        delay: rng.range(0, 1.4),
        period: rng.range(2.0, 3.1),
        sway: minDim * rng.range(0.015, 0.032),
        swayFreq: rng.range(0.7, 1.3),
        phase: rng.range(0, Math.PI * 2),
        peakAlpha: rng.range(0.4, 0.7),
      });
    }
  }
  // Spawn/rise band for the particle update — computed once regardless of the
  // toggle so `update` stays a single pure function of t (an empty `particles`
  // array makes it a no-op when hearts are off).
  const spawnBottom = H * 0.8;
  const spawnTop = H * 0.16;
  const rise = spawnBottom - spawnTop;
  const update = (t: number): void => {
    for (const p of particles) {
      const local = t - p.delay;
      if (local < 0) {
        p.g.alpha = 0;
        continue;
      }
      const age = local % p.period;
      const u = age / p.period;
      const y = spawnBottom - u * rise;
      const x = p.x + Math.sin(u * Math.PI * 2 * p.swayFreq + p.phase) * p.sway;
      const envelope = u < 0.12 ? u / 0.12 : u > 0.78 ? Math.max(0, (1 - u) / 0.22) : 1;
      p.g.position.set(x, y);
      p.g.alpha = p.peakAlpha * envelope;
    }
  };

  // --- Layout band (respects the 9:16 platform safe zone) ---
  const bandTop = ctx.aspect === "9:16" ? 220 : H * 0.08;
  const bandBottom = ctx.aspect === "9:16" ? H - 400 : H * 0.94;
  const bandCy = (bandTop + bandBottom) / 2;

  const msgSize0 = Math.round(W * fontFrac(ctx.aspect));
  const maxWidth = W * (ctx.aspect === "16:9" ? 0.62 : 0.82);
  const { lines, size: msgSize } = wrapAndFit(fonts, message, "display", 700, msgSize0, maxWidth, 2);
  const msgLH = Math.round(msgSize * 1.08);
  const msgBlockH = lines.length * msgLH;

  const hasHandle = handle.length > 0;
  const handleSize = Math.round(msgSize * 0.26);
  const gap = msgSize * 0.5;
  const handleBlockH = hasHandle ? handleSize * 1.3 : 0;
  const totalH = msgBlockH + (hasHandle ? gap : 0) + handleBlockH;
  const blockTop = bandCy - totalH / 2;
  const msgCy = blockTop + msgBlockH / 2;

  const content = new Container();
  content.label = "content";
  root.addChild(content);

  // --- "Thank you" — one block, scales + rises in ---
  const msgText = makeText(fonts, {
    text: lines.join("\n"),
    role: "display",
    weight: 700,
    size: msgSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
    lineHeight: msgLH,
  });
  const popStart = 0.12;
  const popDur = 0.75;
  const msgYFrom = msgCy + msgSize * 0.5;
  msgText.position.set(W / 2, msgYFrom);
  msgText.alpha = 0;
  msgText.scale.set(0.55);
  content.addChild(msgText);
  timeline
    .to(msgText, { prop: "alpha", from: 0, to: 1, start: popStart, duration: 0.35, ease: outQuad })
    .to(msgText, { prop: "scale.x", from: 0.55, to: 1, start: popStart, duration: popDur, ease: spring(0.42) })
    .to(msgText, { prop: "scale.y", from: 0.55, to: 1, start: popStart, duration: popDur, ease: spring(0.42) })
    .to(msgText, { prop: "y", from: msgYFrom, to: msgCy, start: popStart, duration: popDur, ease: spring(0.42) });

  // --- Handle / sign-off (optional) ---
  if (hasHandle) {
    const handleY = blockTop + msgBlockH + gap + handleBlockH / 2;
    const handleYFrom = handleY + 16;
    const handleText = makeText(fonts, {
      text: handle,
      role: "body",
      weight: 600,
      size: handleSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: Math.max(1, Math.round(handleSize * 0.04)),
    });
    handleText.position.set(W / 2, handleYFrom);
    handleText.alpha = 0;
    content.addChild(handleText);
    timeline
      .to(handleText, { prop: "alpha", from: 0, to: 1, start: 0.55, duration: 0.45, ease: outQuad })
      .to(handleText, { prop: "y", from: handleYFrom, to: handleY, start: 0.55, duration: 0.55, ease: outQuint });
  }

  return { timeline, duration: DUR, update };
}

export const thankYou: TemplateDefinition = {
  id: "thank-you",
  name: "Thank You",
  tagline: "A warm thank-you card — text rises in as hearts float up.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { message: "display", handle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "message", type: "text", label: "Message", default: "Thank you!", maxLength: 30, shrinkToFit: true },
    { key: "handle", type: "text", label: "Handle / sign-off", default: "@yourbrand", maxLength: 24, optional: true },
    { key: "showHearts", type: "toggle", label: "Floating hearts", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
