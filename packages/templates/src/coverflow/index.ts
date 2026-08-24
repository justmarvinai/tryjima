import { Container, Graphics, FillGradient, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outCubic,
  inOutCubic,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const wpx = fonts.measure(text, { family: fonts.family(role), weight, size });
  return wpx > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / wpx)) : size;
}

// Album-art gradient pairs — deterministic per card, one distinct look each.
const COVERS: [string, string][] = [
  ["#FF7A9C", "#FF4D6D"],
  ["#5B8CFF", "#3D5BFF"],
  ["#9F7AEA", "#7C5CFF"],
  ["#37B98C", "#12A66A"],
  ["#FFB05A", "#FF7A32"],
];

const DEFAULT_LABELS = ["Aurora", "Skyline", "Momentum", "Cascade", "Horizon"];

const PALETTES: Palette[] = [
  { id: "gallery", name: "Gallery", colors: { background: "#F4F4F7", textColor: "#14141A", accent: "#FF4D1C" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", textColor: "#0F1B2A", accent: "#2E5BD6" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", textColor: "#241452", accent: "#7C5CFF" } },
  { id: "ink", name: "Ink", colors: { background: "#101014", textColor: "#F4F4F7", accent: "#FF6A3C" } },
];

interface Cfg {
  cwF: number;
  ratio: number;
  cyF: number;
}
const CFG: Record<Aspect, Cfg> = {
  "1:1": { cwF: 0.33, ratio: 1.26, cyF: 0.45 },
  "4:5": { cwF: 0.34, ratio: 1.3, cyF: 0.43 },
  "9:16": { cwF: 0.36, ratio: 1.3, cyF: 0.43 },
  "16:9": { cwF: 0.19, ratio: 1.3, cyF: 0.46 },
};

function coverArt(cardW: number, cardH: number, r: number, c0: string, c1: string): Container {
  const c = new Container();
  const grad = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    colorStops: [
      { offset: 0, color: c0 },
      { offset: 1, color: c1 },
    ],
    textureSpace: "local",
  });
  c.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r).fill(grad));
  // Soft decorative shapes clipped to the cover.
  const clip = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r).fill(0xffffff);
  const shapes = new Container();
  shapes.addChild(new Graphics().circle(cardW * 0.24, -cardH * 0.26, cardW * 0.4).fill({ color: "#FFFFFF", alpha: 0.16 }));
  shapes.addChild(new Graphics().circle(-cardW * 0.3, cardH * 0.34, cardW * 0.26).fill({ color: "#000000", alpha: 0.1 }));
  shapes.addChild(new Graphics().circle(0, 0, cardW * 0.2).stroke({ color: "#FFFFFF", width: Math.max(2, cardW * 0.02), alpha: 0.55 }));
  c.addChild(shapes, clip);
  shapes.mask = clip;
  c.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r).stroke({ color: "#FFFFFF", width: Math.max(1, cardW * 0.006), alpha: 0.5 }));
  return c;
}

interface CardNode {
  container: Container;
  scrim: Graphics;
  index: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F4F7"));
  const textColor = str(values.textColor, pc("textColor", "#14141A"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const labels = asList(values.labels, DEFAULT_LABELS).slice(0, 5);
  const showLabels = values.showLabels !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const cfg = CFG[ctx.aspect];
  const cx = w / 2;
  const cy = h * cfg.cyF;
  const cardW = w * cfg.cwF;
  const cardH = cardW * cfg.ratio;
  const cardR = Math.min(cardW, cardH) * 0.07;

  const centerGap = cardW * 0.66;
  const sideGap = cardW * 0.34;

  const strip = new Container();
  strip.position.set(cx, cy);
  strip.sortableChildren = true;
  root.addChild(strip);

  const N = 5;
  const cards: CardNode[] = [];
  for (let i = 0; i < N; i++) {
    const container = new Container();
    container.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.05, cardW, cardH, cardR).fill({ color: 0x000000, alpha: 0.22 }));
    const pair = COVERS[i % COVERS.length]!;
    container.addChild(coverArt(cardW, cardH, cardR, pair[0], pair[1]));
    const scrim = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill({ color: "#0A0A10", alpha: 1 });
    scrim.alpha = 0;
    container.addChild(scrim);
    container.alpha = 0;
    strip.addChild(container);
    cards.push({ container, scrim, index: i });
  }

  // Optional labels under the center card; crossfade as the focus moves.
  const labelY = cy + cardH * 0.5 + minDim * 0.05;
  const labelNodes: Text[] = [];
  let ruleBar: Graphics | null = null;
  if (showLabels) {
    const lblSize = Math.round(minDim * 0.042);
    const ruleW = cardW * 0.34;
    ruleBar = new Graphics().roundRect(-ruleW / 2, 0, ruleW, Math.max(3, minDim * 0.006), minDim * 0.003).fill(accent);
    ruleBar.position.set(cx, labelY + lblSize * 0.7);
    ruleBar.alpha = 0;
    root.addChild(ruleBar);
    for (let i = 0; i < N; i++) {
      const label = labels[i] ?? `Track ${i + 1}`;
      const fs = fitSize(fonts, label, "display", 700, lblSize, cardW * 2.1);
      const t = makeText(fonts, { text: label, role: "display", weight: 700, size: fs, color: textColor, anchor: 0.5, align: "center" });
      t.position.set(cx, labelY);
      t.alpha = 0;
      root.addChild(t);
      labelNodes.push(t);
    }
  }

  const STEP_START = 1.2;
  const STEP_END = 2.5;

  const slotX = (offset: number): number => {
    const a = Math.abs(offset);
    const s = Math.sign(offset);
    return s * (centerGap * Math.min(a, 1) + sideGap * Math.max(0, a - 1));
  };

  const update = (t: number): void => {
    let focus = 1;
    if (t >= STEP_END) focus = 2;
    else if (t > STEP_START) focus = 1 + inOutCubic((t - STEP_START) / (STEP_END - STEP_START));

    for (const card of cards) {
      const offset = card.index - focus;
      const a = Math.abs(offset);
      const baseScale = a <= 1 ? 1 - 0.16 * a : Math.max(0.62, 0.84 - 0.05 * (a - 1));
      const xComp = 1 - Math.min(a, 1.6) * 0.12;
      const eStart = 0.12 + card.index * 0.07;
      const e = clamp01((t - eStart) / 0.55);
      const es = outCubic(e);

      card.container.x = slotX(offset);
      card.container.y = (1 - es) * cardH * 0.16;
      card.container.scale.set(baseScale * xComp, baseScale);
      card.container.skew.y = Math.sign(offset) * Math.min(a, 1.6) * 0.2;
      card.container.alpha = es;
      card.container.zIndex = Math.round(1000 - a * 100);
      card.scrim.alpha = Math.min(0.52, a * 0.32);
    }

    if (showLabels) {
      const globalIn = clamp01((t - 0.9) / 0.5);
      for (let i = 0; i < labelNodes.length; i++) {
        const node = labelNodes[i]!;
        node.alpha = clamp01(1 - Math.abs(i - focus) * 1.7) * globalIn;
      }
      if (ruleBar) ruleBar.alpha = globalIn * 0.9;
    }
  };

  // Cards + labels are driven entirely by the pure update(t); the timeline is
  // intentionally empty so seeking stays pixel-identical.
  const timeline = new JimaTimeline();
  return { timeline, duration: 3.6, update };
}

export const coverflow: TemplateDefinition = {
  id: "coverflow",
  name: "Coverflow",
  tagline: "A cover carousel eases one step to center the next card.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { labels: "display" },
  palettes: PALETTES,
  fields: [
    { key: "labels", type: "textlist", label: "Card labels", default: DEFAULT_LABELS, minItems: 5, maxItems: 5, maxLength: 18, help: "One label per card, shown under the centered card." },
    { key: "showLabels", type: "toggle", label: "Labels", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
