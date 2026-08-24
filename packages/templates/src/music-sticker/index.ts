import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Rough perceived luminance of a #rrggbb color (0..1). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** A small stylized eighth-note glyph, centered near (0,0). */
function noteGlyph(size: number, color: string): Graphics {
  const s = size;
  return new Graphics()
    .ellipse(-0.16 * s, 0.3 * s, 0.24 * s, 0.17 * s)
    .fill(color)
    .rect(0.06 * s, -0.42 * s, 0.08 * s, 0.72 * s)
    .fill(color)
    .poly([0.14 * s, -0.42 * s, 0.4 * s, -0.26 * s, 0.4 * s, -0.04 * s, 0.14 * s, -0.2 * s])
    .fill(color);
}

const PALETTES: Palette[] = [
  { id: "midnight", name: "Midnight", colors: { background: "#0B0B10", pillBg: "#1C1C22", textColor: "#FFFFFF", accent: "#FF4D1C", muted: "#A9AFB9" } },
  { id: "sunset", name: "Sunset", colors: { background: "#2A0820", pillBg: "#3D1230", textColor: "#FFFFFF", accent: "#FF8A3D", muted: "#D8B8CE" } },
  { id: "daylight", name: "Daylight", colors: { background: "#FFFFFF", pillBg: "#F1F1F4", textColor: "#101014", accent: "#7C5CFF", muted: "#63666F" } },
  { id: "mint", name: "Mint", colors: { background: "#EAFBF3", pillBg: "#FFFFFF", textColor: "#08221A", accent: "#12B886", muted: "#4C6359" } },
];

const ENTRANCE_START = 0.08;
const ENTRANCE_DUR = 0.55;
const SPIN_START = ENTRANCE_START + ENTRANCE_DUR;
const SPIN_SPEED = 1.2; // rad/sec
const MARQUEE_SPEED = 68; // px/sec
const EQ_N = 4;
const DURATION = 4.2;

interface EqBar {
  node: Container;
  minH: number;
  maxH: number;
  phase: number;
  freq: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0B0B10"));
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const pillBg = pc("pillBg", "#1C1C22");
  const muted = pc("muted", "#A9AFB9");
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";

  const title = str(values.title, "Golden Hour");
  const artist = str(values.artist, "Wave Culture");
  const showEq = on(values.showEq);
  const showGlow = on(values.showGlow);

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;
  const cy = safe.y + safe.height / 2;

  const pillH = minDim * 0.155;
  const pillW = Math.min(safe.width * 0.86, minDim * 0.92);
  const pad = pillH * 0.14;
  const discR = pillH * 0.5 - pad;
  const discCx = -pillW / 2 + pad + discR;
  const eqW = pillH * 0.5;
  const eqRight = pillW / 2 - pillH * 0.12;
  const textGapDisc = pillH * 0.18;
  const textGapEq = pillH * 0.16;
  const textLeft = discCx + discR + textGapDisc;
  const textRight = eqRight - eqW - textGapEq;
  const textWindowW = Math.max(minDim * 0.1, textRight - textLeft);

  // --- Soft glow behind the disc ---
  if (showGlow) {
    const glow = new Sprite(radialGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = accent;
    glow.width = glow.height = discR * 2.8;
    glow.alpha = 0;
    glow.position.set(cx + discCx, cy);
    root.addChild(glow);
    timeline.to(glow, { prop: "alpha", from: 0, to: 0.4, start: 0.1, duration: DURATION - 0.1, ease: outQuad });
  }

  // --- Pill (background capsule) ---
  const pill = new Container();
  pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2 + pillH * 0.04, pillW, pillH, pillH / 2).fill({ color: "#000000", alpha: 0.14 }));
  pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(pillBg));

  // --- Spinning album art (image or a vinyl-style placeholder) ---
  const discHolder = new Container();
  discHolder.position.set(discCx, 0);
  const tex = images.albumArt ?? null;
  if (tex) {
    const holder = new Container();
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const cover = (2 * discR) / Math.min(tex.width, tex.height);
    sprite.scale.set(cover);
    const mask = new Graphics().circle(0, 0, discR).fill(0xffffff);
    holder.addChild(sprite, mask);
    sprite.mask = mask;
    discHolder.addChild(holder);
  } else {
    discHolder.addChild(new Graphics().circle(0, 0, discR).fill(muted));
    for (let ring = 1; ring <= 3; ring++) {
      const rr = discR * (0.32 + ring * 0.19);
      discHolder.addChild(new Graphics().circle(0, 0, rr).stroke({ color: textColor, width: Math.max(1, discR * 0.012), alpha: 0.16 }));
    }
    const labelR = discR * 0.42;
    discHolder.addChild(new Graphics().circle(0, 0, labelR).fill(accent));
    discHolder.addChild(noteGlyph(labelR * 0.95, onAccent));
    discHolder.addChild(new Graphics().circle(0, 0, labelR * 0.14).fill(pillBg));
  }
  discHolder.addChild(new Graphics().circle(0, 0, discR).stroke({ color: "#FFFFFF", width: Math.max(1, discR * 0.03), alpha: 0.14 }));
  pill.addChild(discHolder);

  // --- Song title + artist marquee line (scrolls only if it overflows) ---
  const textSize = Math.round(pillH * 0.22);

  function buildLine(): { node: Container; width: number } {
    const c = new Container();
    const t = makeText(fonts, { text: title, role: "display", weight: 700, size: textSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    t.position.set(0, 0);
    c.addChild(t);
    const sep = makeText(fonts, { text: "   •   ", role: "body", weight: 500, size: textSize, color: muted, anchor: { x: 0, y: 0.5 } });
    sep.position.set(t.width, 0);
    c.addChild(sep);
    const a = makeText(fonts, { text: artist, role: "body", weight: 500, size: textSize, color: muted, anchor: { x: 0, y: 0.5 } });
    a.position.set(t.width + sep.width, 0);
    c.addChild(a);
    return { node: c, width: t.width + sep.width + a.width };
  }

  let reel: Container | null = null;
  let loopWidth = 0;
  const lineA = buildLine();
  if (lineA.width <= textWindowW) {
    lineA.node.position.set(textLeft + (textWindowW - lineA.width) / 2, 0);
    pill.addChild(lineA.node);
  } else {
    const gap = pillH * 0.9;
    const lineB = buildLine();
    lineB.node.position.set(lineA.width + gap, 0);
    const reelC = new Container();
    reelC.addChild(lineA.node, lineB.node);
    const windowHolder = new Container();
    windowHolder.position.set(textLeft, 0);
    const mask = new Graphics().rect(0, -pillH / 2, textWindowW, pillH).fill(0xffffff);
    windowHolder.addChild(reelC, mask);
    reelC.mask = mask;
    pill.addChild(windowHolder);
    reel = reelC;
    loopWidth = lineA.width + gap;
  }

  // --- Equalizer bars ---
  const eqBars: EqBar[] = [];
  if (showEq) {
    const barGap = eqW * 0.14;
    const barW = (eqW - barGap * (EQ_N - 1)) / EQ_N;
    const baselineY = pillH * 0.26;
    const maxBarH = pillH * 0.46;
    const eqLeftX = eqRight - eqW;
    for (let i = 0; i < EQ_N; i++) {
      const barX = eqLeftX + barW / 2 + i * (barW + barGap);
      const holder = new Container();
      holder.addChild(new Graphics().roundRect(-barW / 2, -1, barW, 1, barW * 0.4).fill(accent));
      holder.position.set(barX, baselineY);
      const minH = maxBarH * 0.2;
      holder.scale.y = minH;
      pill.addChild(holder);
      eqBars.push({ node: holder, minH, maxH: maxBarH, phase: rng.range(0, Math.PI * 2), freq: 1.5 + i * 0.33 });
    }
  }

  pill.position.set(cx, cy);
  pill.alpha = 0;
  pill.scale.set(0.7);
  root.addChild(pill);
  timeline
    .to(pill, { prop: "alpha", from: 0, to: 1, start: ENTRANCE_START, duration: 0.32, ease: outQuad })
    .to(pill, { prop: "scale.x", from: 0.7, to: 1, start: ENTRANCE_START, duration: ENTRANCE_DUR, ease: makeOutBack(1.6) })
    .to(pill, { prop: "scale.y", from: 0.7, to: 1, start: ENTRANCE_START, duration: ENTRANCE_DUR, ease: makeOutBack(1.6) });

  const scrollNeeded = reel !== null;
  const capturedReel = reel;
  const update = (t: number): void => {
    discHolder.rotation = t >= SPIN_START ? (t - SPIN_START) * SPIN_SPEED : 0;
    if (scrollNeeded && capturedReel) {
      capturedReel.x = t >= SPIN_START ? -(((t - SPIN_START) * MARQUEE_SPEED) % loopWidth) : 0;
    }
    if (showEq) {
      for (const bar of eqBars) {
        const tau = t - SPIN_START;
        const s = tau <= 0 ? 0 : (Math.sin(tau * bar.freq * Math.PI * 2 + bar.phase) + 1) / 2;
        bar.node.scale.y = bar.minH + (bar.maxH - bar.minH) * clamp01(s);
      }
    }
  };

  return { timeline, duration: DURATION, update };
}

export const musicSticker: TemplateDefinition = {
  id: "music-sticker",
  name: "Music Sticker",
  tagline: "A spinning album disc, scrolling title, and a dancing equalizer.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { title: "display", artist: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Song title", default: "Golden Hour", maxLength: 30 },
    { key: "artist", type: "text", label: "Artist", default: "Wave Culture", maxLength: 30 },
    { key: "albumArt", type: "image", label: "Album art", default: "", optional: true },
    { key: "showEq", type: "toggle", label: "Equalizer", default: true },
    { key: "showGlow", type: "toggle", label: "Glow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Title color", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
