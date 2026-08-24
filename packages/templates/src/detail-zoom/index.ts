import { Container, Graphics, Sprite, FillGradient } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  outExpo,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

function calloutList(values: Values): string[] {
  const raw = values.callouts;
  if (Array.isArray(raw)) {
    const arr = raw.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length >= 2) return arr.slice(0, 3);
  }
  return DEFAULT_CALLOUTS;
}

const DEFAULT_CALLOUTS = ["Golden light", "The ridgeline", "Still water"];

// Scene colors are baked per palette (this is a photo, not UI chrome); accent +
// chip drive the callout overlay, which the color fields recolor.
const PALETTES: Palette[] = [
  { id: "sunrise", name: "Sunrise", colors: { skyTop: "#FFE0A3", skyMid: "#FF9E7A", skyBot: "#E8657E", ridge: "#6E3D63", ridge2: "#8A4E74", fore: "#3C2440", sun: "#FFF3D6", accent: "#FF4D1C", chip: "#17131B", chipText: "#FFFFFF" } },
  { id: "dusk", name: "Dusk", colors: { skyTop: "#33235F", skyMid: "#6A4A9E", skyBot: "#C86B9E", ridge: "#221A42", ridge2: "#3A2A63", fore: "#140E2A", sun: "#FFD9A0", accent: "#FF7A9C", chip: "#0E0C1A", chipText: "#FFFFFF" } },
  { id: "forest", name: "Forest dawn", colors: { skyTop: "#D2EAD2", skyMid: "#8FCBA0", skyBot: "#5AA6C9", ridge: "#2E5E52", ridge2: "#3E7A66", fore: "#1C3A32", sun: "#FBFCE0", accent: "#12A66A", chip: "#10201A", chipText: "#FFFFFF" } },
  { id: "coast", name: "Coast", colors: { skyTop: "#C4E8F5", skyMid: "#7EC0E8", skyBot: "#4E86C9", ridge: "#2A4E7A", ridge2: "#3A6296", fore: "#16324E", sun: "#FFF6D6", accent: "#2E7DF6", chip: "#0E1A2C", chipText: "#FFFFFF" } },
];

interface Feature {
  fx: number;
  fy: number;
  dir: [number, number];
}
const FEATURES: Feature[] = [
  { fx: 0.76, fy: 0.26, dir: [-1, 0.15] },
  { fx: 0.5, fy: 0.5, dir: [0.95, -0.75] },
  { fx: 0.3, fy: 0.72, dir: [1, -0.05] },
];

const ZOOM = 1.12;

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

/** Draw the layered scenic "photo" into `wrap`, bled beyond the frame so the zoom never reveals edges. */
function drawScene(wrap: Container, w: number, h: number, bleed: number, pc: (k: string, d: string) => string): void {
  const x0 = -bleed;
  const x1 = w + bleed;
  const skyGrad = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: pc("skyTop", "#FFE0A3") },
      { offset: 0.5, color: pc("skyMid", "#FF9E7A") },
      { offset: 1, color: pc("skyBot", "#E8657E") },
    ],
    textureSpace: "local",
  });
  wrap.addChild(new Graphics().rect(x0, -bleed, x1 - x0, h + bleed * 2).fill(skyGrad));

  // Sun: a soft glow + a solid disc at the first feature point.
  const sunX = w * FEATURES[0]!.fx;
  const sunY = h * FEATURES[0]!.fy;
  const glow = new Sprite(radialGlowTexture());
  glow.anchor.set(0.5);
  glow.tint = pc("sun", "#FFF3D6");
  glow.width = glow.height = Math.max(w, h) * 0.7;
  glow.alpha = 0.75;
  glow.position.set(sunX, sunY);
  wrap.addChild(glow);
  wrap.addChild(new Graphics().circle(sunX, sunY, Math.min(w, h) * 0.075).fill(pc("sun", "#FFF3D6")));

  // Back ridge.
  wrap.addChild(
    new Graphics()
      .poly([x0, h * 0.58, w * 0.2, h * 0.42, w * 0.42, h * 0.54, w * 0.62, h * 0.4, w * 0.85, h * 0.52, x1, h * 0.46, x1, h + bleed, x0, h + bleed])
      .fill(pc("ridge2", "#8A4E74")),
  );
  // Front ridge (its central peak is the middle feature).
  wrap.addChild(
    new Graphics()
      .poly([x0, h * 0.68, w * 0.16, h * 0.58, w * 0.36, h * 0.66, w * 0.5, h * 0.5, w * 0.68, h * 0.64, w * 0.88, h * 0.58, x1, h * 0.64, x1, h + bleed, x0, h + bleed])
      .fill(pc("ridge", "#6E3D63")),
  );
  // Foreground + a still-water band near the third feature.
  wrap.addChild(
    new Graphics()
      .poly([x0, h * 0.82, w * 0.5, h * 0.76, x1, h * 0.84, x1, h + bleed, x0, h + bleed])
      .fill(pc("fore", "#3C2440")),
  );
  wrap.addChild(new Graphics().ellipse(w * 0.3, h * 0.86, w * 0.26, h * 0.05).fill({ color: pc("sun", "#FFF3D6"), alpha: 0.14 }));
}

interface Pulse {
  ring: Graphics;
  startT: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pcRaw = (k: string, d: string): string => palette.colors[k] ?? d;
  const skyTopOverride = str(values.background, "");
  const pc = (k: string, d: string): string => (k === "skyTop" && skyTopOverride ? skyTopOverride : pcRaw(k, d));
  const accent = str(values.accent, pcRaw("accent", "#FF4D1C"));
  const chip = pcRaw("chip", "#17131B");
  const chipText = str(values.textColor, pcRaw("chipText", "#FFFFFF"));
  const title = str(values.title, "Sunrise ridge");
  const callouts = calloutList(values);
  const showDots = values.showDots !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const safe = safeRect(ctx.aspect);
  const bleed = Math.max(w, h) * 0.08;

  const timeline = new JimaTimeline();
  const DUR = 4.5;

  // Ken Burns wrapper: scales about the frame center, so a zoom-in never bares edges.
  const photoWrap = new Container();
  photoWrap.pivot.set(cx, cy);
  photoWrap.position.set(cx, cy);
  root.addChild(photoWrap);
  drawScene(photoWrap, w, h, bleed, pc);
  timeline
    .to(photoWrap, { prop: "scale.x", from: 1, to: ZOOM, start: 0, duration: DUR * 0.82, ease: outCubic })
    .to(photoWrap, { prop: "scale.y", from: 1, to: ZOOM, start: 0, duration: DUR * 0.82, ease: outCubic });

  // Feature anchors resolved at the FINAL zoom, so dots land on features at the hold.
  const anchor = (f: Feature): { x: number; y: number } => ({
    x: cx + (f.fx * w - cx) * ZOOM,
    y: cy + (f.fy * h - cy) * ZOOM,
  });

  // --- Title chip (top-left) ---
  if (title.length > 0) {
    const tFont = Math.round(minDim * 0.036);
    const label = fitText(fonts, { text: title, role: "display", weight: 700, size: tFont, color: chipText, anchor: { x: 0, y: 0.5 } }, safe.width * 0.7);
    const dotR = tFont * 0.28;
    const padX = tFont * 0.9;
    const innerW = dotR * 2 + tFont * 0.5 + label.width;
    const pillW = innerW + padX * 2;
    const pillH = tFont * 2.0;
    const t = new Container();
    t.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2 + pillH * 0.08, pillW, pillH, pillH / 2).fill({ color: 0x000000, alpha: 0.22 }));
    t.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(chip));
    t.addChild(new Graphics().circle(-innerW / 2 + dotR, 0, dotR).fill(accent));
    label.position.set(-innerW / 2 + dotR * 2 + tFont * 0.5, 0);
    t.addChild(label);
    t.position.set(safe.x + pillW / 2, safe.y + pillH / 2);
    t.alpha = 0;
    t.scale.set(0.8);
    root.addChild(t);
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outQuad })
      .to(t, { prop: "scale.x", from: 0.8, to: 1, start: 0.3, duration: 0.5, ease: makeOutBack(1.7) })
      .to(t, { prop: "scale.y", from: 0.8, to: 1, start: 0.3, duration: 0.5, ease: makeOutBack(1.7) });
  }

  // --- Callouts (dot + pulse + leader line + label pill) ---
  const pulses: Pulse[] = [];
  const dotR = Math.max(9, minDim * 0.012);
  const lineW = Math.max(2, minDim * 0.004);
  const calloutDist = minDim * 0.18;

  callouts.forEach((text, i) => {
    const f = FEATURES[i] ?? FEATURES[0]!;
    const p = anchor(f);
    const len = Math.hypot(f.dir[0], f.dir[1]) || 1;
    const ux = f.dir[0] / len;
    const uy = f.dir[1] / len;

    const pillFont = Math.round(minDim * 0.03);
    const labelText = fitText(fonts, { text, role: "display", weight: 700, size: pillFont, color: chipText, anchor: { x: 0, y: 0.5 } }, minDim * 0.34);
    const padX = pillFont * 0.85;
    const pillW = labelText.width + padX * 2 + pillFont * 1.1;
    const pillH = pillFont * 2.0;

    const idealX = p.x + ux * calloutDist;
    const idealY = p.y + uy * calloutDist;
    const clampedX = Math.min(Math.max(idealX, safe.x + pillW / 2), safe.x + safe.width - pillW / 2);
    const clampedY = Math.min(Math.max(idealY, safe.y + pillH / 2), safe.y + safe.height - pillH / 2);

    const start = 1.05 + i * 0.66;

    if (showDots) {
      const ddx = clampedX - p.x;
      const ddy = clampedY - p.y;
      const dist = Math.max(1, Math.hypot(ddx, ddy));
      const lineAngle = Math.atan2(ddy, ddx);
      const lineLen = Math.max(0, dist - pillH * 0.6);

      const line = new Graphics().rect(0, -lineW / 2, lineLen, lineW).fill({ color: "#FFFFFF", alpha: 0.9 });
      line.position.set(p.x, p.y);
      line.rotation = lineAngle;
      line.scale.set(0, 1);
      line.alpha = 0;
      root.addChild(line);
      timeline
        .to(line, { prop: "alpha", from: 0, to: 1, start: start + 0.1, duration: 0.15, ease: outQuad })
        .to(line, { prop: "scale.x", from: 0, to: 1, start: start + 0.1, duration: 0.35, ease: outExpo });

      const ring = new Graphics().circle(0, 0, dotR).stroke({ color: accent, width: Math.max(1.5, dotR * 0.18) });
      ring.position.set(p.x, p.y);
      ring.alpha = 0;
      root.addChild(ring);
      pulses.push({ ring, startT: start + 0.1 });

      const dot = new Container();
      dot.addChild(new Graphics().circle(0, 0, dotR * 1.7).fill({ color: "#FFFFFF", alpha: 0.9 }));
      dot.addChild(new Graphics().circle(0, 0, dotR).fill(accent));
      dot.position.set(p.x, p.y);
      dot.alpha = 0;
      dot.scale.set(0);
      root.addChild(dot);
      timeline
        .to(dot, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
        .to(dot, { prop: "scale.x", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(2) })
        .to(dot, { prop: "scale.y", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(2) });
    }

    const pill = new Container();
    pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2 + pillH * 0.06, pillW, pillH, pillH / 2).fill({ color: 0x000000, alpha: 0.2 }));
    pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(chip));
    pill.addChild(new Graphics().circle(-pillW / 2 + padX * 0.6, 0, pillFont * 0.22).fill(accent));
    labelText.position.set(-pillW / 2 + padX * 0.6 + pillFont * 0.55, 0);
    pill.addChild(labelText);
    pill.position.set(clampedX, clampedY);
    pill.alpha = 0;
    pill.scale.set(0.75);
    root.addChild(pill);
    const pillStart = showDots ? start + 0.28 : start;
    timeline
      .to(pill, { prop: "alpha", from: 0, to: 1, start: pillStart, duration: 0.35, ease: outQuad })
      .to(pill, { prop: "scale.x", from: 0.75, to: 1, start: pillStart, duration: 0.45, ease: makeOutBack(1.8) })
      .to(pill, { prop: "scale.y", from: 0.75, to: 1, start: pillStart, duration: 0.45, ease: makeOutBack(1.8) });
  });

  const PULSE_PERIOD = 1.3;
  const update = (t: number): void => {
    for (const p of pulses) {
      const tau = t - p.startT;
      if (tau <= 0) {
        p.ring.alpha = 0;
        continue;
      }
      const phase = (tau % PULSE_PERIOD) / PULSE_PERIOD;
      const env = Math.min(1, tau / 0.3);
      const s = 1 + phase * 1.4;
      p.ring.scale.set(s, s);
      p.ring.alpha = (1 - phase) * 0.5 * env;
    }
  };

  return { timeline, duration: DUR, update };
}

export const detailZoom: TemplateDefinition = {
  id: "detail-zoom",
  name: "Detail Zoom",
  tagline: "A photo slowly zooms while labeled callouts point out details.",
  category: "photo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.9,
  fontRoles: { title: "display", callouts: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Sunrise ridge", maxLength: 26, optional: true, shrinkToFit: true },
    { key: "callouts", type: "textlist", label: "Callouts", default: DEFAULT_CALLOUTS, minItems: 2, maxItems: 3, maxLength: 22 },
    { key: "showDots", type: "toggle", label: "Callout dots", default: true },
    { key: "background", type: "color", label: "Sky", default: "", optional: true },
    { key: "textColor", type: "color", label: "Label text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
