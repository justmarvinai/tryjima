import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outCubic,
  spring,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};
const DEG = Math.PI / 180;

const DEFAULT_FILES = ["Logos", "Colors", "Fonts"];
const CARD_INK = "#101014";
const CARD_BG = "#FFFFFF";
const SKELETON = "#D8DCE2";

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF3EE", textColor: "#2A0F06", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "ocean", name: "Ocean", colors: { background: "#E8F4FF", textColor: "#0B2447", accent: "#2E7DF6", onAccent: "#FFFFFF" } },
  { id: "forest", name: "Forest", colors: { background: "#EDF7EF", textColor: "#0C2A16", accent: "#1E9E5A", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
];

interface FolderCfg {
  titleYF: number;
  fanYF: number;
  folderYF: number;
}

const FOLDER: Record<Aspect, FolderCfg> = {
  "1:1": { titleYF: 0.12, fanYF: 0.42, folderYF: 0.72 },
  "4:5": { titleYF: 0.11, fanYF: 0.42, folderYF: 0.72 },
  "9:16": { titleYF: 0.13, fanYF: 0.42, folderYF: 0.68 },
  "16:9": { titleYF: 0.12, fanYF: 0.42, folderYF: 0.72 },
};

function hexToRgb(h: string): { r: number; g: number; b: number } {
  const s = h.replace("#", "");
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Blend hex `a` toward hex `b` by `t` (0..1). Pure, deterministic. */
function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const ch = (x: number, y: number): string =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(A.r, B.r)}${ch(A.g, B.g)}${ch(A.b, B.b)}`;
}

function fileList(values: Values): string[] {
  return asItems(values.files, DEFAULT_FILES).slice(0, 4);
}

function computeDuration(values: Values): number {
  return 1.0 + fileList(values).length * 0.5 + 2.0;
}

/** Crisp-fit helper: re-make one size smaller if it would overflow. */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

function makeFileCard(
  fonts: TemplateContext["fonts"],
  label: string,
  cardW: number,
  cardH: number,
  accent: string,
): Container {
  const card = new Container();
  const r = cardH * 0.1;
  // Soft drop shadow for depth.
  card.addChild(
    new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.04, cardW, cardH, r).fill({ color: "#000000", alpha: 0.06 }),
  );
  // Body.
  card.addChild(
    new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r).fill(CARD_BG).stroke({ color: "#000000", alpha: 0.06, width: 1 }),
  );
  // Colored top strip.
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH * 0.2, r).fill(accent));
  // File label.
  const label0 = fitText(
    fonts,
    { text: label, role: "body", weight: 600, size: Math.round(cardW * 0.12), color: CARD_INK, anchor: 0.5, align: "center" },
    cardW * 0.72,
  );
  label0.position.set(0, -cardH / 2 + cardH * 0.34);
  card.addChild(label0);
  // Skeleton lines.
  card.addChild(new Graphics().roundRect(-cardW * 0.35, cardH * 0.02, cardW * 0.7, cardH * 0.06, cardH * 0.03).fill(SKELETON));
  card.addChild(new Graphics().roundRect(-cardW * 0.35, cardH * 0.18, cardW * 0.48, cardH * 0.06, cardH * 0.03).fill(SKELETON));
  return card;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF3EE"));
  const textColor = str(values.textColor, pc("textColor", "#2A0F06"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const title = str(values.title, "Your brand kit");
  const files = fileList(values);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const w = size.width;
  const h = size.height;
  const cfg = FOLDER[ctx.aspect];
  const folderW = Math.min(w * 0.42, h * 0.5);
  const folderH = folderW * 0.72;
  const folderX = w / 2;
  const folderCenterY = h * cfg.folderYF;
  const folderTop = folderCenterY - folderH / 2;
  const folderBottom = folderCenterY + folderH / 2;
  const fanCenterY = h * cfg.fanYF;

  const backColor = accent;
  const tabColor = mixHex(accent, "#000000", 0.14);
  const flapColor = mixHex(accent, "#FFFFFF", 0.24);

  const timeline = new JimaTimeline();

  // Folder tab (top-left), behind the back panel so it reads as attached.
  const tabW = folderW * 0.36;
  const tabH = folderH * 0.16;
  const tab = new Graphics().roundRect(folderX - folderW / 2, folderTop - tabH, tabW, tabH, tabH * 0.35).fill(tabColor);
  tab.alpha = 0;
  root.addChild(tab);

  // Back panel.
  const back = new Graphics().roundRect(folderX - folderW / 2, folderTop, folderW, folderH, folderH * 0.09).fill(backColor);
  back.alpha = 0;
  root.addChild(back);

  timeline
    .to(tab, { prop: "alpha", from: 0, to: 1, start: 0.0, duration: 0.4, ease: outQuad })
    .to(back, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.4, ease: outQuad });

  // File cards — start hidden in the pocket (behind the flap), fan out above.
  const cardW = folderW * 0.58;
  const cardH = folderH * 1.05;
  const spreadStep = cardW * 0.84;
  const rotStep = 6 * DEG;
  const mid = (files.length - 1) / 2;
  const startX = folderX;
  const startY = folderCenterY - folderH * 0.05;

  files.forEach((label, i) => {
    const card = makeFileCard(fonts, label, cardW, cardH, accent);
    const finalX = folderX + (i - mid) * spreadStep;
    const finalY = fanCenterY + Math.abs(i - mid) * cardH * 0.04;
    const finalRot = (i - mid) * rotStep;
    card.position.set(startX, startY);
    card.rotation = 0;
    card.scale.set(0.85);
    card.alpha = 0;
    root.addChild(card);

    const start = 0.9 + i * 0.5;
    timeline
      .to(card, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
      .to(card, { prop: "x", from: startX, to: finalX, start, duration: 0.7, ease: spring(0.55) })
      .to(card, { prop: "y", from: startY, to: finalY, start, duration: 0.7, ease: spring(0.55) })
      .to(card, { prop: "rotation", from: 0, to: finalRot, start, duration: 0.7, ease: outCubic })
      .to(card, { prop: "scale.x", from: 0.85, to: 1, start, duration: 0.7, ease: spring(0.55) })
      .to(card, { prop: "scale.y", from: 0.85, to: 1, start, duration: 0.7, ease: spring(0.55) });
  });

  // Front flap — pivots at its bottom edge and swings open at t≈0.7.
  const flap = new Container();
  flap.position.set(folderX, folderBottom);
  const flapH = folderH * 0.62;
  flap.addChild(new Graphics().roundRect(-folderW / 2, -flapH, folderW, flapH, folderH * 0.09).fill(flapColor));
  flap.alpha = 0;
  root.addChild(flap);
  timeline
    .to(flap, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.4, ease: outQuad })
    .to(flap, { prop: "rotation", from: 0, to: 17 * DEG, start: 0.7, duration: 0.5, ease: outCubic })
    .to(flap, { prop: "y", from: folderBottom, to: folderBottom + folderH * 0.03, start: 0.7, duration: 0.5, ease: outCubic });

  // Title above.
  const titleSize = Math.round(w * (ctx.aspect === "16:9" ? 0.05 : 0.062));
  const titleY = h * cfg.titleYF;
  const titleText = fitText(
    fonts,
    { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
    w * 0.86,
  );
  titleText.position.set(w / 2, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 18, to: titleY, start: 0.1, duration: 0.6, ease: outExpo });

  return { timeline, duration: computeDuration(values) };
}

export const folderOpen: TemplateDefinition = {
  id: "folder-open",
  name: "Folder Open",
  tagline: "A folder opens and your files fan out.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Your brand kit", maxLength: 40, shrinkToFit: true },
    { key: "files", type: "textlist", label: "Files", default: DEFAULT_FILES, minItems: 2, maxItems: 4, maxLength: 22 },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
