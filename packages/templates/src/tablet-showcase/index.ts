import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  spring,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type Rng,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

// Neutral device-chrome tones (fixed regardless of palette).
const BEZEL = "#17181D";
const SCREEN_BG = "#FFFFFF";
const STRIP_BG = "#FFFFFF";

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF4EE", accent: "#FF4D1C", textColor: "#101014", muted: "#8A8F98" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", accent: "#7C5CFF", textColor: "#241452", muted: "#9891B0" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", accent: "#2E5BD6", textColor: "#0F1B2A", muted: "#8895A8" } },
  { id: "mint", name: "Mint", colors: { background: "#E9F7EF", accent: "#12B76A", textColor: "#06301F", muted: "#7FA891" } },
];

interface TCfg {
  orient: "portrait" | "landscape";
  /** Device height (portrait) or width (landscape) as a fraction of that canvas dimension. */
  sizeF: number;
  cyF: number;
  capYF: number;
  capF: number;
}

const TCFG: Record<Aspect, TCfg> = {
  "1:1": { orient: "portrait", sizeF: 0.58, cyF: 0.44, capYF: 0.86, capF: 0.038 },
  "4:5": { orient: "portrait", sizeF: 0.56, cyF: 0.42, capYF: 0.88, capF: 0.038 },
  "9:16": { orient: "portrait", sizeF: 0.5, cyF: 0.4, capYF: 0.74, capF: 0.042 },
  "16:9": { orient: "landscape", sizeF: 0.46, cyF: 0.46, capYF: 0.86, capF: 0.028 },
};

interface ScreenRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  sr: number;
}

/** A slim, near-bezel-less tablet body; returns its screen rect. */
function drawTablet(parent: Container, w: number, h: number): ScreenRect {
  const bodyR = Math.min(w, h) * 0.075;
  const bezel = Math.min(w, h) * 0.032;
  parent.addChild(new Graphics().roundRect(-w / 2, -h / 2 + h * 0.02, w, h, bodyR).fill({ color: 0x000000, alpha: 0.18 }));
  parent.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, bodyR).fill(BEZEL));
  const sx = -w / 2 + bezel;
  const sy = -h / 2 + bezel;
  const sw = w - 2 * bezel;
  const sh = h - 2 * bezel;
  const sr = Math.max(2, bodyR - bezel * 0.4);
  parent.addChild(new Graphics().roundRect(sx, sy, sw, sh, sr).fill(SCREEN_BG));
  parent.addChild(new Graphics().circle(0, -h / 2 + bezel * 0.5, Math.max(2, bezel * 0.15)).fill("#565961"));
  return { sx, sy, sw, sh, sr };
}

/** A tablet "home screen": a grid of app icons + a dock, with a few gaps for realism. */
function placeholderHome(rect: ScreenRect, accent: string, muted: string, rng: Rng): Container {
  const { sx, sy, sw, sh } = rect;
  const c = new Container();
  const pad = sw * 0.09;
  const dockH = sh * 0.15;
  const gridTop = sy + sh * 0.09;
  const gridBottom = sy + sh - dockH - sh * 0.06;
  const cols = 4;
  const rows = 4;
  const cellW = (sw - pad * 2) / cols;
  const cellH = (gridBottom - gridTop) / rows;
  const iconSide = Math.min(cellW, cellH) * 0.56;

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      if (rng.next() < 0.14) continue; // a few empty slots for a natural-looking grid
      const cx = sx + pad + col * cellW + cellW / 2;
      const cy = gridTop + r * cellH + cellH / 2;
      const useAccent = rng.next() < 0.35;
      const tone = useAccent ? accent : muted;
      const a = useAccent ? 0.85 : 0.3;
      c.addChild(new Graphics().roundRect(cx - iconSide / 2, cy - iconSide / 2, iconSide, iconSide, iconSide * 0.28).fill({ color: tone, alpha: a }));
    }
  }

  const dockW = sw * 0.72;
  const dockY = sy + sh - dockH * 0.92;
  c.addChild(new Graphics().roundRect(sx + (sw - dockW) / 2, dockY, dockW, dockH * 0.72, dockH * 0.36).fill({ color: 0x000000, alpha: 0.055 }));
  const n = 4;
  const dIconSide = dockH * 0.5;
  const gap = dockW / n;
  for (let i = 0; i < n; i++) {
    const dx = sx + (sw - dockW) / 2 + gap * i + gap / 2;
    c.addChild(
      new Graphics()
        .roundRect(dx - dIconSide / 2, dockY + dockH * 0.36 - dIconSide / 2, dIconSide, dIconSide, dIconSide * 0.3)
        .fill({ color: accent, alpha: i === 1 ? 0.9 : 0.4 }),
    );
  }
  return c;
}

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF4EE"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const muted = pc("muted", "#8A8F98");
  const caption = str(values.caption, "Everything, on one screen");
  const showShadow = values.showShadow !== false;

  const w = size.width;
  const h = size.height;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const L = TCFG[ctx.aspect];
  const cx = w / 2;
  const cy = h * L.cyF;
  let deviceW: number;
  let deviceH: number;
  if (L.orient === "portrait") {
    deviceH = h * L.sizeF;
    deviceW = deviceH * 0.75;
  } else {
    deviceW = w * L.sizeF;
    deviceH = deviceW * 0.75;
  }

  const timeline = new JimaTimeline();

  // Ground contact shadow — stays flat while the device tilts in above it.
  if (showShadow) {
    const shadow = new Graphics().ellipse(0, 0, deviceW * 0.42, deviceW * 0.07).fill({ color: 0x000000, alpha: 0.16 });
    shadow.position.set(cx, cy + deviceH / 2 + deviceW * 0.02);
    shadow.alpha = 0;
    root.addChild(shadow);
    timeline.to(shadow, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.5, ease: outQuad });
  }

  // floatWrap: continuous idle drift (owns y + rotation exclusively, via update
  // only, starting after the entrance settles). tiltGroup: the one-shot
  // "rotate in from a tilt to face-on" entrance (owns skew/scale/rotation/alpha
  // exclusively, via timeline tweens only) — no property is written twice.
  const floatWrap = new Container();
  floatWrap.position.set(cx, cy);
  root.addChild(floatWrap);

  const tiltGroup = new Container();
  floatWrap.addChild(tiltGroup);

  const TILT_SKEW_X = 0.26;
  const TILT_SKEW_Y = -0.15;
  const TILT_ROT = -5 * DEG;
  const TILT_SCALE_X = 0.82;
  tiltGroup.alpha = 0;
  tiltGroup.skew.set(TILT_SKEW_X, TILT_SKEW_Y);
  tiltGroup.rotation = TILT_ROT;
  tiltGroup.scale.set(TILT_SCALE_X, 1);

  const rect = drawTablet(tiltGroup, deviceW, deviceH);

  const tex = images.screen ?? null;
  let screenContent: Container;
  if (tex) {
    const holder = new Container();
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const cover = Math.max(rect.sw / tex.width, rect.sh / tex.height);
    sprite.scale.set(cover);
    sprite.position.set(rect.sx + rect.sw / 2, rect.sy + rect.sh / 2);
    holder.addChild(sprite);
    screenContent = holder;
  } else {
    screenContent = placeholderHome(rect, accent, muted, rng);
  }
  const mask = new Graphics().roundRect(rect.sx, rect.sy, rect.sw, rect.sh, rect.sr).fill(0xffffff);
  tiltGroup.addChild(screenContent, mask);
  screenContent.mask = mask;

  const TILT_START = 0.22;
  const TILT_DUR = 0.85;
  timeline
    .to(tiltGroup, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.3, ease: outQuad })
    .to(tiltGroup, { prop: "skew.x", from: TILT_SKEW_X, to: 0, start: TILT_START, duration: TILT_DUR, ease: spring(0.6) })
    .to(tiltGroup, { prop: "skew.y", from: TILT_SKEW_Y, to: 0, start: TILT_START, duration: TILT_DUR, ease: spring(0.6) })
    .to(tiltGroup, { prop: "rotation", from: TILT_ROT, to: 0, start: TILT_START, duration: TILT_DUR - 0.05, ease: spring(0.6) })
    .to(tiltGroup, { prop: "scale.x", from: TILT_SCALE_X, to: 1, start: TILT_START, duration: TILT_DUR, ease: spring(0.6) });

  const SETTLED = TILT_START + TILT_DUR;

  // --- Caption strip below the tablet ---
  if (caption.length > 0) {
    const capY = h * L.capYF;
    const capSize = Math.round(w * L.capF);
    const label = fitText(
      fonts,
      { text: caption, role: "body", weight: 600, size: capSize, color: textColor, anchor: 0.5, align: "center" },
      w * 0.7,
    );
    const stripPadX = capSize * 1.0;
    const stripH = capSize * 2.15;
    const stripW = Math.min(w * 0.86, label.width + stripPadX * 2);
    const strip = new Container();
    strip.addChild(new Graphics().roundRect(-stripW / 2, -stripH / 2 + stripH * 0.08, stripW, stripH, stripH / 2).fill({ color: 0x000000, alpha: 0.1 }));
    strip.addChild(new Graphics().roundRect(-stripW / 2, -stripH / 2, stripW, stripH, stripH / 2).fill(STRIP_BG));
    label.position.set(0, 0);
    strip.addChild(label);
    strip.position.set(cx, capY);
    strip.scale.set(0.9);
    strip.alpha = 0;
    root.addChild(strip);
    const CAP_START = SETTLED + 0.35;
    timeline
      .to(strip, { prop: "alpha", from: 0, to: 1, start: CAP_START, duration: 0.45, ease: outQuad })
      .to(strip, { prop: "scale.x", from: 0.9, to: 1, start: CAP_START, duration: 0.5, ease: spring(0.55) })
      .to(strip, { prop: "scale.y", from: 0.9, to: 1, start: CAP_START, duration: 0.5, ease: spring(0.55) })
      .to(strip, { prop: "y", from: capY + 14, to: capY, start: CAP_START, duration: 0.5, ease: outQuint });
  }

  // Gentle idle drift once settled (pure in t).
  const FLOAT_AT = SETTLED + 0.5;
  const PERIOD = 3.4;
  const amp = h * 0.008;
  const update = (t: number): void => {
    const tau = t - FLOAT_AT;
    if (tau <= 0) {
      floatWrap.y = cy;
      floatWrap.rotation = 0;
      return;
    }
    const env = Math.min(1, tau / 1.0);
    floatWrap.y = cy + Math.sin((tau / PERIOD) * Math.PI * 2) * amp * env;
    floatWrap.rotation = Math.sin((tau / (PERIOD * 1.25)) * Math.PI * 2) * 0.005 * env;
  };

  return { timeline, duration: 4.0, update };
}

export const tabletShowcase: TemplateDefinition = {
  id: "tablet-showcase",
  name: "Tablet Showcase",
  tagline: "A tablet rotates in from an angle to face you dead-on.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { caption: "body" },
  palettes: PALETTES,
  fields: [
    { key: "screen", type: "image", label: "Screen", default: "", optional: true, help: "Fills the tablet screen; shows a home-screen mock when empty." },
    { key: "caption", type: "text", label: "Caption strip", default: "Everything, on one screen", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showShadow", type: "toggle", label: "Contact shadow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
