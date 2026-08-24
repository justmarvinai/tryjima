import { Container, Graphics, Sprite, FillGradient, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (a.length) return a;
  }
  return fb;
};

const BEZEL = "#16171C";
const SCREEN_BG = "#FFFFFF";
const UI_BLOCK = "#E7EAEF";
const UI_CARD = "#F1F3F6";
const SPEAKER = "#3A3C44";
const DEFAULT_LABELS = ["Home", "Explore", "Profile"];

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF4EE", accent: "#FF4D1C", textColor: "#101014", onAccent: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", accent: "#7C5CFF", textColor: "#241452", onAccent: "#FFFFFF" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", accent: "#2E5BD6", textColor: "#0F1B2A", onAccent: "#FFFFFF" } },
  { id: "mint", name: "Mint", colors: { background: "#E9F7EF", accent: "#12B76A", textColor: "#06301F", onAccent: "#FFFFFF" } },
];

interface ACfg {
  hF: number;
  cyF: number;
  offXF: number;
}

// Center-outward: phones sit a bit lower than center, leaving room above for
// their settle motion and below for the caption (verified clear of every
// aspect's safe zone at build time).
const ACFG: Record<Aspect, ACfg> = {
  "1:1": { hF: 0.44, cyF: 0.45, offXF: 0.225 },
  "4:5": { hF: 0.4, cyF: 0.43, offXF: 0.225 },
  "9:16": { hF: 0.34, cyF: 0.4, offXF: 0.21 },
  "16:9": { hF: 0.52, cyF: 0.44, offXF: 0.175 },
};

interface ScreenRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  sr: number;
}

/** A rounded phone body (shadow + bezel + screen + speaker); returns the screen rect. */
function drawPhoneBody(parent: Container, w: number, h: number): ScreenRect {
  const bodyR = w * 0.16;
  const bezel = w * 0.06;
  parent.addChild(new Graphics().roundRect(-w / 2, -h / 2 + h * 0.025, w, h, bodyR).fill({ color: 0x000000, alpha: 0.2 }));
  parent.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, bodyR).fill(BEZEL));
  const sx = -w / 2 + bezel;
  const sy = -h / 2 + bezel;
  const sw = w - 2 * bezel;
  const sh = h - 2 * bezel;
  const sr = Math.max(4, bodyR - bezel * 0.5);
  parent.addChild(new Graphics().roundRect(sx, sy, sw, sh, sr).fill(SCREEN_BG));
  const speakerW = w * 0.16;
  parent.addChild(new Graphics().roundRect(-speakerW / 2, -h / 2 + bezel * 0.5, speakerW, Math.max(3, w * 0.02), w * 0.01).fill(SPEAKER));
  return { sx, sy, sw, sh, sr };
}

/** A labeled UI mock shown when a screen has no image: header + label + skeleton rows. */
function placeholderScreen(fonts: FontRegistry, rect: ScreenRect, accent: string, onAccent: string, label: string): Container {
  const { sx, sy, sw, sh } = rect;
  const c = new Container();
  const headerH = sh * 0.16;
  c.addChild(new Graphics().rect(sx, sy, sw, headerH).fill(accent));
  const lbl = fitText(fonts, { text: label, role: "body", weight: 700, size: Math.round(headerH * 0.42), color: onAccent, anchor: { x: 0, y: 0.5 } }, sw * 0.78);
  lbl.position.set(sx + sw * 0.1, sy + headerH * 0.52);
  c.addChild(lbl);
  let y = sy + headerH + sh * 0.09;
  const rowH = sh * 0.045;
  for (const wdt of [0.7, 0.5, 0.62]) {
    c.addChild(new Graphics().roundRect(sx + sw * 0.1, y, sw * wdt, rowH, rowH * 0.5).fill(UI_BLOCK));
    y += sh * 0.09;
  }
  c.addChild(new Graphics().roundRect(sx + sw * 0.1, y + sh * 0.02, sw * 0.8, sh * 0.16, sh * 0.03).fill(UI_CARD));
  c.addChild(new Graphics().roundRect(sx + sw * 0.1, y + sh * 0.24, sw * 0.36, sh * 0.055, sh * 0.0275).fill(accent));
  return c;
}

/** A soft diagonal gradient "sheen" clipped to the screen rect — a glossy reflection. */
function makeSheen(rect: ScreenRect): Graphics {
  const { sx, sy, sw, sh, sr } = rect;
  const grad = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0.7, y: 1 },
    colorStops: [
      { offset: 0, color: "rgba(255,255,255,0)" },
      { offset: 0.35, color: "rgba(255,255,255,0.32)" },
      { offset: 0.55, color: "rgba(255,255,255,0.12)" },
      { offset: 1, color: "rgba(255,255,255,0)" },
    ],
    textureSpace: "local",
  });
  return new Graphics().roundRect(sx, sy, sw, sh, sr).fill(grad);
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

interface Slot {
  x: number;
  scale: number;
  finalRot: number;
  startRot: number;
  start: number;
  screenIndex: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF4EE"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const caption = str(values.caption, "One app. Every screen.");
  const labels = asList(values.labels, DEFAULT_LABELS).slice(0, 3);
  const showReflection = values.showReflection !== false;

  const w = size.width;
  const h = size.height;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const cfg = ACFG[ctx.aspect];
  const phoneH = h * cfg.hF;
  const phoneW = phoneH * 0.468;
  const cx = w / 2;
  const cy = h * cfg.cyF;
  const offX = w * cfg.offXF;
  const startY = cy + h * 0.14;

  const timeline = new JimaTimeline();

  const screens: (Texture | null)[] = [images.screen1 ?? null, images.screen2 ?? null, images.screen3 ?? null];

  // Left and right settle first (smaller, tilted outward); center rises last,
  // bigger and dead-on, and — added last — renders in front of both. Screen
  // fields stay in reading order (1=left, 2=center hero, 3=right).
  const slots: Slot[] = [
    { x: cx - offX, scale: 0.86, finalRot: 8 * DEG, startRot: 26 * DEG, start: 0.15, screenIndex: 0 },
    { x: cx + offX, scale: 0.86, finalRot: -8 * DEG, startRot: -26 * DEG, start: 0.32, screenIndex: 2 },
    { x: cx, scale: 1.15, finalRot: 0, startRot: 10 * DEG, start: 0.48, screenIndex: 1 },
  ];

  slots.forEach((slot) => {
    const riser = new Container();
    riser.position.set(slot.x, startY);
    riser.scale.set(slot.scale * 0.7);
    riser.rotation = slot.startRot;
    riser.alpha = 0;
    root.addChild(riser);

    const rect = drawPhoneBody(riser, phoneW, phoneH);

    const tex = screens[slot.screenIndex] ?? null;
    let content: Container;
    if (tex) {
      const holder = new Container();
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      const cover = Math.max(rect.sw / tex.width, rect.sh / tex.height);
      sprite.scale.set(cover);
      sprite.position.set(rect.sx + rect.sw / 2, rect.sy + rect.sh / 2);
      holder.addChild(sprite);
      content = holder;
    } else {
      content = placeholderScreen(fonts, rect, accent, onAccent, labels[slot.screenIndex] ?? `Screen ${slot.screenIndex + 1}`);
    }
    const mask = new Graphics().roundRect(rect.sx, rect.sy, rect.sw, rect.sh, rect.sr).fill(0xffffff);
    riser.addChild(content, mask);
    content.mask = mask;

    if (showReflection) {
      riser.addChild(makeSheen(rect));
    }

    timeline
      .to(riser, { prop: "alpha", from: 0, to: 1, start: slot.start, duration: 0.4, ease: outQuad })
      .to(riser, { prop: "y", from: startY, to: cy, start: slot.start, duration: 0.75, ease: outQuint })
      .to(riser, { prop: "scale.x", from: slot.scale * 0.7, to: slot.scale, start: slot.start, duration: 0.75, ease: makeOutBack(1.5) })
      .to(riser, { prop: "scale.y", from: slot.scale * 0.7, to: slot.scale, start: slot.start, duration: 0.75, ease: makeOutBack(1.5) })
      .to(riser, { prop: "rotation", from: slot.startRot, to: slot.finalRot, start: slot.start, duration: 0.75, ease: makeOutBack(1.4) });
  });

  // Caption below the row, clamped clear of each aspect's safe zone.
  if (caption.length > 0) {
    const botSafe = ctx.aspect === "9:16" ? 400 : Math.round(Math.min(w, h) * 0.06);
    const capSize = Math.round(w * (ctx.aspect === "16:9" ? 0.032 : 0.04));
    const capY = Math.min(h * 0.9, h - botSafe - capSize * 0.7);
    const capText = fitText(
      fonts,
      { text: caption, role: "body", weight: 600, size: capSize, color: textColor, anchor: 0.5, align: "center" },
      w * 0.82,
    );
    capText.position.set(cx, capY);
    capText.alpha = 0;
    root.addChild(capText);
    timeline
      .to(capText, { prop: "alpha", from: 0, to: 1, start: 1.35, duration: 0.5, ease: outQuad })
      .to(capText, { prop: "y", from: capY + 16, to: capY, start: 1.35, duration: 0.55, ease: outQuint });
  }

  return { timeline, duration: 4.0 };
}

export const appScreens: TemplateDefinition = {
  id: "app-screens",
  name: "App Screens",
  tagline: "Three app screens settle into a tilted row.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { caption: "body" },
  palettes: PALETTES,
  fields: [
    { key: "screen1", type: "image", label: "Screen 1", default: "", optional: true, help: "Fills the left phone; shows a labeled mock UI when empty." },
    { key: "screen2", type: "image", label: "Screen 2", default: "", optional: true, help: "Fills the center (hero) phone; shows a labeled mock UI when empty." },
    { key: "screen3", type: "image", label: "Screen 3", default: "", optional: true, help: "Fills the right phone; shows a labeled mock UI when empty." },
    { key: "labels", type: "textlist", label: "Screen labels", default: DEFAULT_LABELS, minItems: 3, maxItems: 3, maxLength: 14, help: "Header text on the placeholder mock for each screen." },
    { key: "caption", type: "text", label: "Caption", default: "One app. Every screen.", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showReflection", type: "toggle", label: "Screen reflection", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
