import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  inOutCubic,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

/** Stroke the first `len` px of a polyline (flat [x0,y0,…]) into g. */
function strokePartial(
  g: Graphics,
  pts: number[],
  len: number,
  style: { color: string; width: number },
): void {
  if (len <= 0 || pts.length < 4) return;
  g.moveTo(pts[0]!, pts[1]!);
  let remaining = len;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i]!;
    const y0 = pts[i + 1]!;
    const x1 = pts[i + 2]!;
    const y1 = pts[i + 3]!;
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (seg <= remaining) {
      g.lineTo(x1, y1);
      remaining -= seg;
    } else {
      const u = seg === 0 ? 0 : remaining / seg;
      g.lineTo(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u);
      break;
    }
  }
  g.stroke({ color: style.color, width: style.width, cap: "round", join: "round" });
}

interface Course {
  name: string;
  dish: string;
}

function parseCourse(raw: string): Course {
  const bar = raw.indexOf("|");
  if (bar === -1) return { name: "", dish: raw.trim() };
  return { name: raw.slice(0, bar).trim(), dish: raw.slice(bar + 1).trim() };
}

const DEFAULT_COURSES = [
  "First|Burrata & heirloom tomatoes",
  "Second|Truffle mushroom risotto",
  "Dessert|Lemon olive-oil cake",
];

function coursesOf(values: Values): Course[] {
  return asList(values.courses, DEFAULT_COURSES).slice(0, 3).map(parseCourse);
}

// Dish lines use textColor on cardBg; course names + borders use accent on
// cardBg — both >= 4.5:1 in every palette below.
const PALETTES: Palette[] = [
  { id: "ivory", name: "Ivory", colors: { background: "#EFE9DD", cardBg: "#FBF8F1", textColor: "#241F17", accent: "#8A6B2F" } },
  { id: "noir", name: "Noir", colors: { background: "#14120F", cardBg: "#1E1B16", textColor: "#F4EFE6", accent: "#D8B85A" } },
  { id: "sage", name: "Sage", colors: { background: "#E9EFE6", cardBg: "#F7FAF4", textColor: "#1F2B20", accent: "#3F6B4A" } },
  { id: "burgundy", name: "Burgundy", colors: { background: "#F5EBE8", cardBg: "#FDF8F5", textColor: "#2E1218", accent: "#7C2438" } },
];

const COURSE_START = 1.0;
const COURSE_STAGGER = 0.55;
const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EFE9DD"));
  const cardBg = pc("cardBg", "#FBF8F1");
  const textColor = str(values.textColor, pc("textColor", "#241F17"));
  const accent = str(values.accent, pc("accent", "#8A6B2F"));

  const kickerRaw = str(values.kicker, "MENU").toUpperCase();
  const courses = coursesOf(values);
  const footerRaw = str(values.footer, "August 22 · The Rose Hall");
  const showBorder = values.showBorder !== false;
  const showFlourish = values.showFlourish !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeRect(ctx.aspect);
  const cx = w / 2;
  const cy = zone.y + zone.height / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Menu card ---
  const cardH = Math.min(zone.height * 0.94, minDim * 0.88);
  const cardW = Math.min(cardH * 0.72, zone.width * 0.86);
  const card = new Container();
  card.position.set(cx, cy);
  card.alpha = 0;
  card.scale.set(0.97);
  root.addChild(card);

  const e = Math.round(cardH * 0.01);
  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2 - e, -cardH / 2 - e + cardH * 0.018, cardW + e * 2, cardH + e * 2, 6)
      .fill({ color: "#000000", alpha: 0.14 }),
  );
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 4).fill(cardBg));

  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.45, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.97, to: 1, start: 0.05, duration: 0.6, ease: outQuint })
    .to(card, { prop: "scale.y", from: 0.97, to: 1, start: 0.05, duration: 0.6, ease: outQuint });

  // --- Thin double border, drawn around from top-center ---
  const borders: { g: Graphics; pts: number[]; total: number; start: number; width: number }[] = [];
  if (showBorder) {
    const insets: [number, number][] = [
      [cardW * 0.045, Math.max(2, minDim * 0.0032)],
      [cardW * 0.045 + cardW * 0.02, Math.max(1.5, minDim * 0.0018)],
    ];
    insets.forEach(([inset, lw], bi) => {
      const bw = cardW - inset * 2;
      const bh = cardH - inset * 2;
      const x0 = -bw / 2;
      const x1 = bw / 2;
      const y0 = -bh / 2;
      const y1 = bh / 2;
      const pts = [0, y0, x1, y0, x1, y1, x0, y1, x0, y0, 0, y0];
      const g = new Graphics();
      card.addChild(g);
      borders.push({ g, pts, total: (bw + bh) * 2, start: 0.25 + bi * 0.2, width: lw });
    });
  }

  // --- Vertical layout (computed, then centered in the card) ---
  const innerW = cardW * 0.78;
  const kickerSize = fitSize(fonts, kickerRaw, "serif", 600, Math.round(minDim * 0.033), innerW * 0.8);
  const nameSize = Math.round(minDim * 0.021);
  const dishSize0 = Math.round(minDim * 0.034);
  const footerSize = Math.round(minDim * 0.022);
  const flourishH = minDim * 0.013;
  const gapKF = minDim * 0.02;
  const gapA = minDim * 0.046;
  const gapN = minDim * 0.009;
  const gapS = minDim * 0.021;
  const gapB = minDim * 0.05;

  interface TextItem {
    kind: "text";
    h: number;
    text: string;
    role: FontRole;
    weight: number;
    size: number;
    color: string;
    ls: number;
    alphaTo: number;
    at: number;
    rise: number;
  }
  interface FlourishItem {
    kind: "flourish";
    h: number;
    at: number;
  }
  interface SpacerItem {
    kind: "spacer";
    h: number;
  }
  type Item = TextItem | FlourishItem | SpacerItem;

  const items: Item[] = [];
  items.push({ kind: "text", h: kickerSize, text: kickerRaw, role: "serif", weight: 600, size: kickerSize, color: textColor, ls: Math.round(kickerSize * 0.42), alphaTo: 1, at: 0.55, rise: -8 });
  if (showFlourish) {
    items.push({ kind: "spacer", h: gapKF });
    items.push({ kind: "flourish", h: flourishH, at: 0.75 });
  }
  items.push({ kind: "spacer", h: gapA });
  courses.forEach((c, i) => {
    const at = COURSE_START + COURSE_STAGGER * i;
    if (c.name.length > 0) {
      items.push({ kind: "text", h: nameSize, text: c.name.toUpperCase(), role: "body", weight: 700, size: nameSize, color: accent, ls: 3, alphaTo: 1, at, rise: 8 });
    }
    if (c.name.length > 0 && c.dish.length > 0) items.push({ kind: "spacer", h: gapN });
    if (c.dish.length > 0) {
      const ds = fitSize(fonts, c.dish, "serif", 500, dishSize0, innerW);
      items.push({ kind: "text", h: ds, text: c.dish, role: "serif", weight: 500, size: ds, color: textColor, ls: 0, alphaTo: 1, at: at + 0.16, rise: 8 });
    }
    if (i < courses.length - 1) {
      items.push({ kind: "spacer", h: gapS });
      if (showFlourish) items.push({ kind: "flourish", h: flourishH, at: at + 0.38 });
      items.push({ kind: "spacer", h: gapS });
    }
  });
  items.push({ kind: "spacer", h: gapB });
  const footFit = fitSize(fonts, footerRaw, "body", 500, footerSize, innerW);
  items.push({ kind: "text", h: footFit, text: footerRaw, role: "body", weight: 500, size: footFit, color: textColor, ls: 1, alphaTo: 0.78, at: 2.75, rise: 8 });

  const totalH = items.reduce((acc, r) => acc + r.h, 0);
  let yCursor = -totalH / 2;

  for (const item of items) {
    if (item.kind === "text") {
      const ty = yCursor + item.h / 2;
      const node = makeText(fonts, {
        text: item.text,
        role: item.role,
        weight: item.weight,
        size: item.size,
        color: item.color,
        anchor: 0.5,
        align: "center",
        letterSpacing: item.ls,
      });
      // Wide tracking adds a trailing gap after the last glyph; nudge to re-center.
      node.position.set(item.ls > 1 ? item.ls / 2 : 0, ty);
      node.alpha = 0;
      card.addChild(node);
      timeline
        .to(node, { prop: "alpha", from: 0, to: item.alphaTo, start: item.at, duration: 0.45, ease: outQuad })
        .to(node, { prop: "y", from: ty + item.rise, to: ty, start: item.at, duration: 0.5, ease: outQuint });
    } else if (item.kind === "flourish") {
      const fy = yCursor + item.h / 2;
      const node = new Container();
      node.position.set(0, fy);
      node.scale.set(0);
      card.addChild(node);
      const s = flourishH / 2;
      const lineW = innerW * 0.16;
      const gap = s * 3.2;
      const gEl = new Graphics();
      gEl.poly([0, -s, s, 0, 0, s, -s, 0]).fill(accent);
      gEl.roundRect(-gap - lineW, -1.1, lineW, 2.2, 1.1).fill({ color: accent, alpha: 0.55 });
      gEl.roundRect(gap, -1.1, lineW, 2.2, 1.1).fill({ color: accent, alpha: 0.55 });
      node.addChild(gEl);
      timeline
        .to(node, { prop: "scale.x", from: 0, to: 1, start: item.at, duration: 0.45, ease: makeOutBack(1.7) })
        .to(node, { prop: "scale.y", from: 0, to: 1, start: item.at, duration: 0.45, ease: makeOutBack(1.7) });
    }
    yCursor += item.h;
  }

  const update = (t: number): void => {
    for (const b of borders) {
      b.g.clear();
      const p = inOutCubic(clamp01((t - b.start) / 0.85));
      if (p > 0) strokePartial(b.g, b.pts, b.total * p, { color: accent, width: b.width });
    }
  };

  return { timeline, duration: DURATION, update };
}

export const eventMenu: TemplateDefinition = {
  id: "event-menu",
  name: "Event Menu",
  tagline: "A stationery menu card draws its double border and serves each course in turn.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.5,
  fontRoles: { kicker: "serif", courses: "serif", footer: "body" },
  palettes: PALETTES,
  fields: [
    { key: "kicker", type: "text", label: "Heading", default: "MENU", maxLength: 14, shrinkToFit: true },
    {
      key: "courses",
      type: "textlist",
      label: "Courses",
      default: DEFAULT_COURSES,
      minItems: 2,
      maxItems: 3,
      maxLength: 40,
      help: 'One per line as "Course|Dish", e.g. "First|Burrata & heirloom tomatoes".',
    },
    { key: "footer", type: "text", label: "Date / venue", default: "August 22 · The Rose Hall", maxLength: 34, shrinkToFit: true },
    { key: "showBorder", type: "toggle", label: "Double border", default: true },
    { key: "showFlourish", type: "toggle", label: "Flourish diamonds", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
