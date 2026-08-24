import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  makeOutBack,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type Values,
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
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}

// Dates + labels ride textColor on light `cardBg` (≥ 4.5:1 everywhere); the
// accent only colors the spine, dots and connectors (no text on them).
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", cardBg: "#F5F1EC" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", cardBg: "#FFFFFF" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#17A34A", cardBg: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D", cardBg: "#1D1D24" } },
];

interface Milestone {
  date: string;
  label: string;
}

const DEFAULT_MILESTONES = ["Q1|Kickoff", "Q2|Beta launch", "Q3|Public release", "Q4|Scale up"];

function parseMilestone(raw: string, fallback: string): Milestone {
  const idx = raw.indexOf("|");
  const date = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const label = (idx >= 0 ? raw.slice(idx + 1) : "").trim();
  return { date: date.length ? date : "—", label: label.length ? label : fallback };
}

function milestonesOf(values: Values): Milestone[] {
  return asList(values.milestones, DEFAULT_MILESTONES).slice(0, 5).map((r, i) => parseMilestone(r, `Milestone ${i + 1}`));
}

const SPINE_START = 0.4;
const SPINE_DUR = 1.15;
const CARD_DUR = 0.5;
const HOLD = 0.9;

function computeDuration(values: Values): number {
  const n = Math.max(1, milestonesOf(values).length);
  const lastStart = SPINE_START + (n - 1) / n * SPINE_DUR + 0.2;
  return lastStart + CARD_DUR + HOLD;
}

function titleFrac(aspect: Aspect): number {
  return aspect === "9:16" ? 0.125 : aspect === "16:9" ? 0.1 : 0.095;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const cardBg = pc("cardBg", "#F5F1EC");

  const title = str(values.title, "Product roadmap");
  const milestones = milestonesOf(values);
  const n = milestones.length;
  const showConnectors = values.showConnectors !== false;
  const showDots = values.showDots !== false;
  const showAccentBar = values.accentBar !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const safe = safeRect(ctx.aspect);

  // --- Title (+ accent underline) ---
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.05), safe.width);
  const titleY = h * titleFrac(ctx.aspect);
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(w / 2, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 14, to: titleY, start: 0, duration: 0.5, ease: outQuint });

  if (showAccentBar) {
    const ruleW = titleSize * 1.5;
    const ruleH = Math.max(3, titleSize * 0.09);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(w / 2 - ruleW / 2, titleY + titleSize * 0.72);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
  }

  // --- Spine geometry ---
  const spineX = w / 2;
  const spineTop = titleY + titleSize * 0.9 + minDim * 0.04;
  const spineBottom = safe.y + safe.height - minDim * 0.02;
  const spineH = spineBottom - spineTop;
  const yOf = (i: number): number => spineTop + (i + 0.5) * (spineH / n);
  const spineW = Math.max(3, minDim * 0.007);
  const dotR = minDim * 0.02;
  const connLen = minDim * 0.045;

  // Spine (draws top → bottom).
  const spine = new Container();
  spine.position.set(spineX, spineTop);
  spine.scale.set(1, 0);
  spine.addChild(new Graphics().roundRect(-spineW / 2, 0, spineW, spineH, spineW / 2).fill({ color: accent, alpha: 0.5 }));
  root.addChild(spine);
  timeline.to(spine, { prop: "scale.y", from: 0, to: 1, start: SPINE_START, duration: SPINE_DUR, ease: outQuad });

  const cardGap = dotR + connLen;
  const cardMaxW = safe.width / 2 - cardGap - minDim * 0.01;
  const cardW = Math.min(cardMaxW, minDim * 0.42);
  const dateFont = Math.round(minDim * 0.03);
  const labelFont = Math.round(minDim * 0.036);
  const cardPad = minDim * 0.028;
  const cardH = dateFont * 1.1 + minDim * 0.01 + labelFont * 1.15 + cardPad * 2;
  const radius = cardH * 0.2;

  milestones.forEach((m, i) => {
    const y = yOf(i);
    const right = i % 2 === 0;
    const start = SPINE_START + (i / n) * SPINE_DUR + 0.15;

    // Connector.
    if (showConnectors) {
      const dir = right ? 1 : -1;
      const conn = new Container();
      conn.position.set(spineX + dir * dotR, y);
      conn.scale.set(0, 1);
      conn.addChild(new Graphics().roundRect(right ? 0 : -connLen, -spineW / 2, connLen, spineW, spineW / 2).fill(accent));
      root.addChild(conn);
      timeline.to(conn, { prop: "scale.x", from: 0, to: 1, start: start + 0.05, duration: 0.3, ease: outExpo });
    }

    // Card.
    const dir = right ? 1 : -1;
    const cardCX = spineX + dir * (cardGap + cardW / 2);
    const card = new Container();
    card.position.set(cardCX, y);
    card.scale.set(0);
    root.addChild(card);

    const shOff = Math.round(cardH * 0.06);
    card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + shOff, cardW, cardH, radius).fill({ color: "#000000", alpha: 0.12 }));
    card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius).fill(cardBg));

    const dSize = fitSize(fonts, m.date, "display", 700, dateFont, cardW - cardPad * 2);
    const dateText = makeText(fonts, { text: m.date, role: "display", weight: 700, size: dSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    dateText.alpha = 0.72;
    dateText.position.set(-cardW / 2 + cardPad, -cardH / 2 + cardPad + dSize * 0.5);
    card.addChild(dateText);

    const lSize = fitSize(fonts, m.label, "display", 700, labelFont, cardW - cardPad * 2);
    const labelText = makeText(fonts, { text: m.label, role: "display", weight: 700, size: lSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    labelText.position.set(-cardW / 2 + cardPad, cardH / 2 - cardPad - lSize * 0.55);
    card.addChild(labelText);

    timeline
      .to(card, { prop: "scale.x", from: 0, to: 1, start: start + 0.15, duration: CARD_DUR, ease: makeOutBack(1.7) })
      .to(card, { prop: "scale.y", from: 0, to: 1, start: start + 0.15, duration: CARD_DUR, ease: makeOutBack(1.7) });

    // Dot on the spine (on top).
    if (showDots) {
      const dot = new Container();
      dot.position.set(spineX, y);
      dot.scale.set(0);
      dot.addChild(new Graphics().circle(0, 0, dotR).fill(accent));
      dot.addChild(new Graphics().circle(0, 0, dotR * 0.42).fill(bg));
      root.addChild(dot);
      timeline
        .to(dot, { prop: "scale.x", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(2.2) })
        .to(dot, { prop: "scale.y", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(2.2) });
    }
  });

  return { timeline, duration: computeDuration(values) };
}

export const roadmap: TemplateDefinition = {
  id: "roadmap",
  name: "Roadmap",
  tagline: "A spine draws downward, dropping dated milestone cards to each side.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.5,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", milestones: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Product roadmap", maxLength: 28, optional: true, shrinkToFit: true },
    {
      key: "milestones",
      type: "textlist",
      label: "Milestones (date | label)",
      default: DEFAULT_MILESTONES,
      minItems: 3,
      maxItems: 5,
      maxLength: 24,
      help: 'One per line as "date | label", e.g. "Q2 | Beta launch".',
    },
    { key: "showConnectors", type: "toggle", label: "Connectors", default: true },
    { key: "showDots", type: "toggle", label: "Milestone dots", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
