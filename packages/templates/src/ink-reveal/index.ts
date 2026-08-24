import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  spring,
  safeRect,
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
const on = (v: unknown): boolean => v !== false;

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// A vibrant ink blob splashes over an off-white page (with seeded droplets),
// then washes away to reveal the title. Stage stays light; the ink is the
// accent, so the held end frame is dark title on the background.
const PALETTES: Palette[] = [
  { id: "ink-rose", name: "Ink rose", colors: { background: "#FAF6F4", textColor: "#1A1013", accent: "#E0245E" } },
  { id: "ink-indigo", name: "Ink indigo", colors: { background: "#F3F3FB", textColor: "#141534", accent: "#4C39D6" } },
  { id: "ink-teal", name: "Ink teal", colors: { background: "#EEFAF8", textColor: "#0A2A28", accent: "#0E9C90" } },
  { id: "ink-plum", name: "Ink plum", colors: { background: "#FAF2F8", textColor: "#2A0F26", accent: "#B0329B" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.084 : aspect === "9:16" ? 0.114 : 0.102;
}

const BLOB_PEAK = 0.55;
const CLEAR_START = 0.85;
const TITLE_START = 0.95;
const DURATION = 4.2;

interface Droplet {
  g: Graphics;
  cos: number;
  sin: number;
  dist: number;
  delay: number;
  life: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FAF6F4"));
  const textColor = str(values.textColor, pc("textColor", "#1A1013"));
  const accent = str(values.accent, pc("accent", "#E0245E"));
  const title = str(values.title, "Fresh Ink");
  const subtitle = str(values.subtitle, "a bold new look");
  const showDroplets = on(values.showDroplets);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const centerY = zone.y + zone.height * 0.46;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Ink blob: an organic seeded splash ---
  const rx = minDim * 0.42;
  const ry = minDim * 0.32;
  const pts: number[] = [];
  const N = 30;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wob = 1 + rng.range(-0.16, 0.2);
    pts.push(Math.cos(a) * rx * wob, Math.sin(a) * ry * wob);
  }
  const blob = new Graphics().poly(pts).fill(accent);
  blob.position.set(cx, centerY);
  blob.scale.set(0);
  root.addChild(blob);
  timeline
    .to(blob, { prop: "scale.x", from: 0, to: 1.12, start: 0.1, duration: BLOB_PEAK - 0.1, ease: outExpo })
    .to(blob, { prop: "scale.y", from: 0, to: 1.12, start: 0.1, duration: BLOB_PEAK - 0.1, ease: outExpo })
    .to(blob, { prop: "scale.x", from: 1.12, to: 1.5, start: CLEAR_START, duration: 0.65, ease: outQuad })
    .to(blob, { prop: "scale.y", from: 1.12, to: 1.5, start: CLEAR_START, duration: 0.65, ease: outQuad })
    .to(blob, { prop: "alpha", from: 1, to: 0, start: CLEAR_START, duration: 0.6, ease: outQuad });

  // --- Seeded droplets thrown by the splash (pure f(t)) ---
  const droplets: Droplet[] = [];
  if (showDroplets) {
    for (let i = 0; i < 16; i++) {
      const r = minDim * rng.range(0.008, 0.026);
      const g = new Graphics().circle(0, 0, r).fill(accent);
      g.alpha = 0;
      root.addChild(g);
      const ang = rng.range(0, Math.PI * 2);
      droplets.push({
        g,
        cos: Math.cos(ang),
        sin: Math.sin(ang),
        dist: minDim * rng.range(0.22, 0.44),
        delay: rng.range(0, 0.14),
        life: rng.range(0.5, 0.85),
      });
    }
  }
  const dropStart = 0.32;
  const update = (t: number): void => {
    for (const d of droplets) {
      const tau = t - dropStart - d.delay;
      if (tau <= 0) {
        d.g.alpha = 0;
        continue;
      }
      const out = 1 - Math.pow(1 - Math.min(1, tau / 0.5), 3);
      const dist = d.dist * out;
      d.g.position.set(cx + d.cos * dist, centerY + d.sin * dist);
      const grow = Math.min(1, tau / 0.12);
      const fade = tau > d.life ? Math.max(0, 1 - (tau - d.life) / 0.4) : 1;
      d.g.alpha = fade * grow;
      d.g.scale.set(0.6 + 0.4 * out);
    }
  };

  // --- Title + subtitle (revealed once the ink clears) ---
  const maxW = zone.width * (ctx.aspect === "16:9" ? 0.6 : 0.84);
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), maxW);
  const hasSub = subtitle.length > 0;
  const subSize = Math.round(titleSize * 0.3);
  const lineGap = subSize * 1.05;
  const totalH = titleSize + (hasSub ? lineGap + subSize : 0);

  const content = new Container();
  content.position.set(cx, centerY);
  content.alpha = 0;
  content.scale.set(0.7);
  root.addChild(content);

  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(0, -totalH / 2 + titleSize / 2);
  content.addChild(titleText);

  timeline
    .to(content, { prop: "alpha", from: 0, to: 1, start: TITLE_START, duration: 0.4, ease: outQuad })
    .to(content, { prop: "scale.x", from: 0.7, to: 1, start: TITLE_START, duration: 0.7, ease: spring(0.42) })
    .to(content, { prop: "scale.y", from: 0.7, to: 1, start: TITLE_START, duration: 0.7, ease: spring(0.42) });

  if (hasSub) {
    const subY = totalH / 2 - subSize / 2;
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 2 });
    subText.position.set(0, subY + 12);
    subText.alpha = 0;
    content.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.82, start: TITLE_START + 0.45, duration: 0.45, ease: outQuad })
      .to(subText, { prop: "y", from: subY + 12, to: subY, start: TITLE_START + 0.45, duration: 0.5, ease: outQuint });
  }

  return { timeline, duration: DURATION, update };
}

export const inkReveal: TemplateDefinition = {
  id: "ink-reveal",
  name: "Ink Reveal",
  tagline: "An ink splash bursts with droplets, then clears to reveal the title.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.7,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Fresh Ink", maxLength: 26, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "a bold new look", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showDroplets", type: "toggle", label: "Droplets", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Ink", default: "", optional: true },
  ],
  build,
};
