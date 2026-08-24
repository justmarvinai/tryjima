import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  safeRect,
  outQuad,
  outExpo,
  spring,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const DEFAULT_HOTSPOTS = ["Long battery life", "Water resistant", "Fast charging"];

function hotspotList(values: Values): string[] {
  const raw = values.hotspots;
  if (Array.isArray(raw)) {
    const arr = raw.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length >= 2) return arr.slice(0, 4);
  }
  return DEFAULT_HOTSPOTS;
}

const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#F6F4EF", textColor: "#17131B", accent: "#FF4D1C", chip: "#17131B", chipText: "#FFFFFF", muted: "#9A8F86", tile: "#ECE8E3" } },
  { id: "ocean", name: "Ocean", colors: { background: "#EAF2FB", textColor: "#0F1B2A", accent: "#2E5BD6", chip: "#0F1B2A", chipText: "#FFFFFF", muted: "#7C8CA3", tile: "#DCE7F5" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", textColor: "#241452", accent: "#7C5CFF", chip: "#241452", chipText: "#FFFFFF", muted: "#8A7FA8", tile: "#E8E1F7" } },
  { id: "ink", name: "Ink", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF6A3C", chip: "#24262C", chipText: "#FFFFFF", muted: "#6B7280", tile: "#1E2027" } },
];

interface HSCfg {
  imgHalfF: number;
  cxF: number;
  cyF: number;
  gapF: number;
  titleYF: number;
}

const HS: Record<Aspect, HSCfg> = {
  "1:1": { imgHalfF: 0.24, cxF: 0.5, cyF: 0.56, gapF: 0.13, titleYF: 0.085 },
  "4:5": { imgHalfF: 0.24, cxF: 0.5, cyF: 0.5, gapF: 0.14, titleYF: 0.075 },
  "9:16": { imgHalfF: 0.22, cxF: 0.5, cyF: 0.46, gapF: 0.12, titleYF: 0.145 },
  "16:9": { imgHalfF: 0.22, cxF: 0.5, cyF: 0.54, gapF: 0.12, titleYF: 0.1 },
};

/** A small "picture" glyph (frame + sun + mountains) for the empty hero slot. */
function imageGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.roundRect(-0.5 * s, -0.42 * s, s, 0.84 * s, 0.12 * s).stroke({ color, width: Math.max(2, 0.055 * s) });
  g.circle(-0.18 * s, -0.14 * s, 0.1 * s).fill(color);
  g.poly([-0.44 * s, 0.34 * s, -0.12 * s, -0.04 * s, 0.06 * s, 0.14 * s, 0.28 * s, -0.12 * s, 0.46 * s, 0.34 * s]).fill(color);
  return g;
}

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

/** The hero product tile: a rounded square, image (cover-fit + masked) or a designed placeholder. */
function makeHeroTile(
  tex: Texture | null,
  half: number,
  r: number,
  accent: string,
  muted: string,
  tileC: string,
  borderC: string,
): Container {
  const card = new Container();
  const d = half * 2;
  card.addChild(new Graphics().roundRect(-half, -half + d * 0.045, d, d, r).fill({ color: 0x000000, alpha: 0.14 }));
  card.addChild(new Graphics().roundRect(-half, -half, d, d, r).fill(tileC));
  if (tex) {
    const holder = new Container();
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const cover = Math.max(d / tex.width, d / tex.height);
    sprite.scale.set(cover);
    const maskG = new Graphics().roundRect(-half, -half, d, d, r).fill(0xffffff);
    holder.addChild(sprite, maskG);
    sprite.mask = maskG;
    card.addChild(holder);
  } else {
    const blobWrap = new Container();
    const blob = new Graphics().circle(half * 0.3, -half * 0.3, half * 0.55).fill({ color: accent, alpha: 0.16 });
    const blobMask = new Graphics().roundRect(-half, -half, d, d, r).fill(0xffffff);
    blobWrap.addChild(blob, blobMask);
    blob.mask = blobMask;
    card.addChild(blobWrap);
    card.addChild(imageGlyph(d * 0.32, muted));
  }
  card.addChild(new Graphics().roundRect(-half, -half, d, d, r).stroke({ color: borderC, width: Math.max(1, d * 0.005), alpha: 0.3 }));
  return card;
}

interface PulseNode {
  ring: Graphics;
  startT: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F6F4EF"));
  const textColor = str(values.textColor, pc("textColor", "#17131B"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const chipC = pc("chip", "#17131B");
  const chipTextC = pc("chipText", "#FFFFFF");
  const muted = pc("muted", "#9A8F86");
  const tileC = pc("tile", "#ECE8E3");
  const title = str(values.title, "");
  const hotspots = hotspotList(values);
  const showPulse = values.showPulse !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const cfg = HS[ctx.aspect];
  const cx = w * cfg.cxF;
  const cy = h * cfg.cyF;
  const imgHalf = minDim * cfg.imgHalfF;
  const gap = minDim * cfg.gapF;
  const calloutR = imgHalf + gap;
  const safe = safeRect(ctx.aspect);

  const timeline = new JimaTimeline();

  if (title.length > 0) {
    const titleSize = Math.round(minDim * 0.05);
    const titleY = h * cfg.titleYF;
    const t = fitText(
      fonts,
      { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
      w * 0.72,
    );
    t.position.set(cx, titleY);
    t.alpha = 0;
    root.addChild(t);
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.5, ease: outQuad })
      .to(t, { prop: "y", from: titleY - 14, to: titleY, start: 0.1, duration: 0.55, ease: outQuad });
  }

  const heroR = imgHalf * 0.09;
  const hero = makeHeroTile(images.image ?? null, imgHalf, heroR, accent, muted, tileC, textColor);
  hero.position.set(cx, cy);
  hero.alpha = 0;
  hero.scale.set(0.85);
  root.addChild(hero);
  timeline
    .to(hero, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.4, ease: outQuad })
    .to(hero, { prop: "scale.x", from: 0.85, to: 1, start: 0.15, duration: 0.7, ease: spring(0.5) })
    .to(hero, { prop: "scale.y", from: 0.85, to: 1, start: 0.15, duration: 0.7, ease: spring(0.5) });

  const n = hotspots.length;
  const dotR = Math.max(10, imgHalf * 0.1);
  const lineW = Math.max(2, imgHalf * 0.02);
  const pulses: PulseNode[] = [];

  hotspots.forEach((label, i) => {
    const angle = (-90 + i * (360 / n)) * DEG;
    const dotDist = imgHalf * 0.62;
    const dotX = cx + dotDist * Math.cos(angle);
    const dotY = cy + dotDist * Math.sin(angle);
    const idealX = cx + calloutR * Math.cos(angle);
    const idealY = cy + calloutR * Math.sin(angle);

    const pillFont = Math.round(minDim * 0.026);
    const labelText = fitText(
      fonts,
      { text: label, role: "display", weight: 700, size: pillFont, color: chipTextC, anchor: { x: 0, y: 0.5 } },
      minDim * 0.32,
    );
    const padX = pillFont * 0.85;
    const pillW = labelText.width + padX * 2 + pillFont * 1.1;
    const pillH = pillFont * 2.0;

    const clampedX = Math.min(Math.max(idealX, safe.x + pillW / 2), safe.x + safe.width - pillW / 2);
    const clampedY = Math.min(Math.max(idealY, safe.y + pillH / 2), safe.y + safe.height - pillH / 2);

    const ddx = clampedX - dotX;
    const ddy = clampedY - dotY;
    const dist = Math.max(1, Math.hypot(ddx, ddy));
    const lineAngle = Math.atan2(ddy, ddx);
    const lineLen = Math.max(0, dist - pillH * 0.7);

    const start = 0.85 + i * 0.42;

    // Numbered marker.
    const dot = new Container();
    dot.addChild(new Graphics().circle(0, 0, dotR).fill(accent));
    const numText = makeText(fonts, { text: String(i + 1), role: "display", weight: 700, size: Math.round(dotR * 1.1), color: chipTextC, anchor: 0.5 });
    dot.addChild(numText);
    dot.position.set(dotX, dotY);
    dot.scale.set(0);
    dot.alpha = 0;
    root.addChild(dot);
    timeline
      .to(dot, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
      .to(dot, { prop: "scale.x", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(2) })
      .to(dot, { prop: "scale.y", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(2) });

    // Pulse ring — decorative, gated by showPulse.
    if (showPulse) {
      const ring = new Graphics().circle(0, 0, dotR).stroke({ color: accent, width: Math.max(1.5, dotR * 0.16) });
      ring.position.set(dotX, dotY);
      ring.alpha = 0;
      root.addChild(ring);
      pulses.push({ ring, startT: start + 0.1 });
    }

    // Leader line, drawn from the dot outward.
    const line = new Graphics().rect(0, -lineW / 2, lineLen, lineW).fill(accent);
    line.position.set(dotX, dotY);
    line.rotation = lineAngle;
    line.scale.set(0, 1);
    line.alpha = 0;
    root.addChild(line);
    const lineStart = start + 0.12;
    timeline
      .to(line, { prop: "alpha", from: 0, to: 1, start: lineStart, duration: 0.15, ease: outQuad })
      .to(line, { prop: "scale.x", from: 0, to: 1, start: lineStart, duration: 0.35, ease: outExpo });

    // Callout pill.
    const pill = new Container();
    pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2 + pillH * 0.06, pillW, pillH, pillH / 2).fill({ color: 0x000000, alpha: 0.12 }));
    pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(chipC));
    pill.addChild(new Graphics().circle(-pillW / 2 + padX * 0.55, 0, pillFont * 0.22).fill(accent));
    labelText.position.set(-pillW / 2 + padX * 0.55 + pillFont * 0.55, 0);
    pill.addChild(labelText);
    pill.position.set(clampedX, clampedY);
    pill.alpha = 0;
    pill.scale.set(0.7);
    root.addChild(pill);
    const pillStart = start + 0.3;
    timeline
      .to(pill, { prop: "alpha", from: 0, to: 1, start: pillStart, duration: 0.35, ease: outQuad })
      .to(pill, { prop: "scale.x", from: 0.7, to: 1, start: pillStart, duration: 0.45, ease: makeOutBack(1.8) })
      .to(pill, { prop: "scale.y", from: 0.7, to: 1, start: pillStart, duration: 0.45, ease: makeOutBack(1.8) });
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
      const envelope = Math.min(1, tau / 0.3);
      const s = 1 + phase * 1.3;
      p.ring.scale.set(s, s);
      p.ring.alpha = (1 - phase) * 0.55 * envelope;
    }
  };

  return { timeline, duration: 4.2, update };
}

export const hotspotTour: TemplateDefinition = {
  id: "hotspot-tour",
  name: "Hotspot Tour",
  tagline: "A guided tour of numbered callouts around your product.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { title: "display", hotspots: "display" },
  palettes: PALETTES,
  fields: [
    { key: "image", type: "image", label: "Product image", default: "", optional: true },
    { key: "title", type: "text", label: "Title", default: "Product tour", maxLength: 28, optional: true, shrinkToFit: true },
    { key: "hotspots", type: "textlist", label: "Hotspots", default: DEFAULT_HOTSPOTS, minItems: 2, maxItems: 4, maxLength: 22 },
    { key: "showPulse", type: "toggle", label: "Pulse rings", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
