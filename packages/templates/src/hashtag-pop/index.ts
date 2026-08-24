import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  shrinkToFit,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const DEG = Math.PI / 180;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);
const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const DEFAULT_TAGS = ["#viral", "#trending", "#fyp"];
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};
const normTag = (s: string): string => {
  const t = s.trim();
  return t.startsWith("#") ? t : `#${t}`;
};

const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "dark", name: "Dark", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "candy", name: "Candy", colors: { background: "#FFF4FA", textColor: "#3A0A28", accent: "#FF2E9E" } },
  { id: "grape-night", name: "Grape night", colors: { background: "#14101F", textColor: "#FFFFFF", accent: "#6B4FE0" } },
];

/** WCAG-2 relative luminance of a #rrggbb color (0..1). */
function relLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
function contrastOf(l1: number, l2: number): number {
  return l1 >= l2 ? (l1 + 0.05) / (l2 + 0.05) : (l2 + 0.05) / (l1 + 0.05);
}
/** Whichever of near-black / white actually contrasts best against a fill (WCAG-checked, not assumed). */
function bestTextOn(bgHex: string): string {
  const L = relLuminance(bgHex);
  return contrastOf(L, 1) >= contrastOf(L, relLuminance("#101014")) ? "#FFFFFF" : "#101014";
}

interface ChipBox {
  text: string;
  width: number;
  cx: number;
  cy: number;
}

/** Greedy-wrap fixed-width chips into centered rows, itself centered as a block. */
function packChips(items: { text: string; width: number }[], maxWidth: number, gapX: number, rowH: number): ChipBox[] {
  const lines: { items: { text: string; width: number }[]; width: number }[] = [];
  let current: { text: string; width: number }[] = [];
  let currentWidth = 0;
  for (const it of items) {
    const add = current.length === 0 ? it.width : currentWidth + gapX + it.width;
    if (add <= maxWidth || current.length === 0) {
      current.push(it);
      currentWidth = add;
    } else {
      lines.push({ items: current, width: currentWidth });
      current = [it];
      currentWidth = it.width;
    }
  }
  if (current.length) lines.push({ items: current, width: currentWidth });

  const totalH = lines.length * rowH;
  const top = -totalH / 2;
  const boxes: ChipBox[] = [];
  lines.forEach((line, li) => {
    const lineY = top + li * rowH + rowH / 2;
    let cursor = -line.width / 2;
    for (const it of line.items) {
      boxes.push({ text: it.text, width: it.width, cx: cursor + it.width / 2, cy: lineY });
      cursor += it.width + gapX;
    }
  });
  return boxes;
}

interface Particle {
  g: Graphics;
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  t0: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = bestTextOn(accent);
  const showBurst = values.showBurst !== false;
  const tags = asItems(values.tags, DEFAULT_TAGS).slice(0, 6).map(normTag);

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const safe = safeRect(ctx.aspect);
  const cx = size.width / 2;
  const cy = safe.y + safe.height / 2;

  const family = fonts.family("display");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight: 700, size: sz });

  const maxRowW = Math.min(safe.width * 0.94, minDim * 0.92);
  const baseFont = Math.round(minDim * 0.05);
  const maxChipTextW = maxRowW - Math.round(baseFont * 1.24);

  // Shrink uniformly to the worst-case tag so every chip shares one font size.
  let chipFont = baseFont;
  for (const tag of tags) {
    const fit = shrinkToFit(tag, measure, { maxWidth: maxChipTextW, baseSize: chipFont, minSize: Math.round(baseFont * 0.55) });
    chipFont = Math.min(chipFont, fit);
  }
  const padX = Math.round(chipFont * 0.62);
  const padY = Math.round(chipFont * 0.42);
  const chipH = chipFont + padY * 2;
  const gapX = Math.round(chipFont * 0.42);
  const rowH = chipH + Math.round(chipFont * 0.36);

  const items = tags.map((text) => ({ text, width: measure(text, chipFont) + padX * 2 }));
  const boxes = packChips(items, maxRowW, gapX, rowH);

  const particles: Particle[] = [];
  const BURST_LIFE = 0.45;
  const BURST_GRAV = 1.2 * minDim;

  boxes.forEach((box, i) => {
    const isEven = i % 2 === 0;
    const fillColor = isEven ? accent : textColor;
    const onColor = isEven ? onAccent : bg;
    const worldX = cx + box.cx;
    const worldY = cy + box.cy;

    const chip = new Container();
    chip.addChild(new Graphics().roundRect(-box.width / 2, -chipH / 2, box.width, chipH, chipH / 2).fill(fillColor));
    chip.addChild(makeText(fonts, { text: box.text, role: "display", weight: 700, size: chipFont, color: onColor, anchor: 0.5 }));
    chip.position.set(worldX, worldY);

    const start = 0.15 + i * 0.14;
    const rot0 = rng.pick([-1, 1]) * rng.range(6, 12) * DEG;
    chip.alpha = 0;
    chip.scale.set(0);
    chip.rotation = rot0;
    root.addChild(chip);
    timeline
      .to(chip, { prop: "alpha", from: 0, to: 1, start, duration: 0.18, ease: outQuad })
      .to(chip, { prop: "scale.x", from: 0, to: 1, start, duration: 0.55, ease: makeOutBack(1.8) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start, duration: 0.55, ease: makeOutBack(1.8) })
      .to(chip, { prop: "rotation", from: rot0, to: 0, start, duration: 0.55, ease: makeOutBack(1.6) });

    if (showBurst) {
      const t0 = start + 0.08;
      const sparkColor = isEven ? textColor : accent;
      for (let k = 0; k < 4; k++) {
        const s = minDim * rng.range(0.008, 0.018);
        const g = new Graphics().circle(0, 0, s).fill(rng.pick([accent, sparkColor]));
        g.position.set(worldX, worldY);
        g.visible = false;
        root.addChild(g);
        const a = rng.range(0, Math.PI * 2);
        const speed = rng.range(0.3, 0.55) * minDim;
        particles.push({ g, x0: worldX, y0: worldY, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, t0 });
      }
    }
  });

  // A single soft spark icon behind the cluster, marking the initial "pop".
  if (showBurst) {
    const spark = makeIcon("bolt", minDim * 0.1, { color: accent });
    spark.position.set(cx, cy);
    spark.alpha = 0;
    spark.scale.set(0.4);
    root.addChild(spark);
    timeline
      .to(spark, { prop: "alpha", from: 0, to: 0.8, start: 0.02, duration: 0.14, ease: outQuad })
      .to(spark, { prop: "alpha", from: 0.8, to: 0, start: 0.3, duration: 0.35, ease: outQuad })
      .to(spark, { prop: "scale.x", from: 0.4, to: 1.4, start: 0.02, duration: 0.5, ease: outQuad })
      .to(spark, { prop: "scale.y", from: 0.4, to: 1.4, start: 0.02, duration: 0.5, ease: outQuad });
  }

  const update = (t: number): void => {
    for (const p of particles) {
      const tau = t - p.t0;
      if (tau < 0 || tau > BURST_LIFE) {
        p.g.visible = false;
        continue;
      }
      p.g.visible = true;
      p.g.x = p.x0 + p.vx * tau;
      p.g.y = p.y0 + p.vy * tau + 0.5 * BURST_GRAV * tau * tau;
      p.g.alpha = 1 - clamp01(tau / BURST_LIFE);
    }
  };

  return { timeline, duration: 3.8, update };
}

export const hashtagPop: TemplateDefinition = {
  id: "hashtag-pop",
  name: "Hashtag Pop",
  tagline: "A cluster of hashtag chips burst in and settle with a spring stagger.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "tags", type: "textlist", label: "Hashtags", default: DEFAULT_TAGS, minItems: 2, maxItems: 6, maxLength: 24 },
    { key: "showBurst", type: "toggle", label: "Burst sparks", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
