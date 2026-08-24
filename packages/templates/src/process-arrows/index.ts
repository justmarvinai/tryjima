import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  spring,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (a.length) return a;
  }
  return fb;
};

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

/** Create text; if it would overflow `maxWidth`, re-make one size smaller (crisp). */
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number): Text {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFFFFF", textColor: "#151016", accent: "#FF4D1C", cardColor: "#F7F3EF" } },
  { id: "grape", name: "Grape", colors: { background: "#F4F1FF", textColor: "#241452", accent: "#7C5CFF", cardColor: "#FFFFFF" } },
  { id: "ocean", name: "Ocean", colors: { background: "#EEF4FF", textColor: "#0B1F4D", accent: "#2E7DF6", cardColor: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FAF5EA", accent: "#D8F34D", cardColor: "#1C1C22" } },
];

const DEFAULT_STEPS = ["Discover", "Design", "Build", "Launch"];

function resolveSteps(values: Values): string[] {
  const raw = asList(values.steps, DEFAULT_STEPS).slice(0, 4);
  return raw.length >= 3 ? raw : DEFAULT_STEPS;
}

const CARD0 = 0.4;
const CARD_EACH = 0.62;
const POP_DUR = 0.5;
const ACTIVE_SCALE = 1.14;
const REST_SCALE = 1.0;
const DEACT_DUR = 0.36;
const HOLD = 1.15;

function computeDuration(values: Values): number {
  const n = resolveSteps(values).length;
  const lastStart = CARD0 + (n - 1) * CARD_EACH;
  return lastStart + POP_DUR + HOLD;
}

interface RowConfig {
  marginX: number;
  titleY: number;
  rowCY: number;
}

function rowConfig(aspect: Aspect, w: number, h: number): RowConfig {
  switch (aspect) {
    case "16:9":
      return { marginX: w * 0.06, titleY: h * 0.14, rowCY: h * 0.58 };
    case "4:5":
      return { marginX: w * 0.055, titleY: h * 0.1, rowCY: h * 0.5 };
    case "9:16":
      return { marginX: w * 0.05, titleY: h * 0.145, rowCY: h * 0.44 };
    default:
      return { marginX: w * 0.06, titleY: h * 0.12, rowCY: h * 0.56 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#151016"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const cardColor = pc("cardColor", "#F7F3EF");
  const showNumbers = values.showNumbers !== false;
  const showAccentBar = values.accentBar !== false;
  const titleRaw = str(values.title, "Our process");
  const steps = resolveSteps(values);
  const n = steps.length;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  const cfg = rowConfig(ctx.aspect, w, h);
  const marginX = cfg.marginX;
  const availW = w - marginX * 2;
  const cellW = availW / n;
  const cardW = cellW * 0.72;
  const cardH = Math.min(minDim * 0.34, Math.max(cellW * 1.05, minDim * 0.22));
  const rowCY = cfg.rowCY;

  // --- Title + accent underline ---
  const titleSize = fitSize(fonts, titleRaw, "display", 700, Math.round(minDim * 0.054), w * 0.86);
  const titleText = makeText(fonts, { text: titleRaw, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(w / 2, cfg.titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: cfg.titleY - 14, to: cfg.titleY, start: 0, duration: 0.5, ease: outExpo });

  if (showAccentBar) {
    const ruleW = titleSize * 1.6;
    const ruleH = Math.max(3, titleSize * 0.09);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(w / 2 - ruleW / 2, cfg.titleY + titleSize * 0.82);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
  }

  // --- Bold chevrons in the gaps, behind the cards ---
  const gapW = cellW - cardW;
  const chevArm = Math.min(gapW * 0.42, minDim * 0.075);
  const chevStroke = Math.max(8, chevArm * 0.62);
  for (let i = 0; i < n - 1; i++) {
    const gx = marginX + cellW * (i + 1);
    const chev = new Graphics()
      .poly([-chevArm * 0.5, -chevArm, chevArm * 0.5, 0, -chevArm * 0.5, chevArm], false)
      .stroke({ color: accent, width: chevStroke, cap: "round", join: "round" });
    chev.position.set(gx, rowCY);
    chev.alpha = 0;
    chev.scale.set(0.5);
    root.addChild(chev);
    const start = CARD0 + i * CARD_EACH + POP_DUR * 0.55;
    timeline
      .to(chev, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
      .to(chev, { prop: "scale.x", from: 0.5, to: 1, start, duration: 0.36, ease: makeOutBack(2) })
      .to(chev, { prop: "scale.y", from: 0.5, to: 1, start, duration: 0.36, ease: makeOutBack(2) });
  }

  // --- Numbered step cards; the active one enlarges as the flow progresses ---
  const r = Math.min(cardW, cardH) * 0.12;
  steps.forEach((step, i) => {
    const cx = marginX + cellW * (i + 0.5);
    const cardC = new Container();
    cardC.position.set(cx, rowCY);

    cardC.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.04, cardW, cardH, r).fill({ color: "#000000", alpha: 0.07 }));
    cardC.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r).fill(cardColor));

    const activeRing = new Graphics()
      .roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r)
      .stroke({ color: accent, width: Math.max(3, minDim * 0.012) });
    activeRing.alpha = 0;
    cardC.addChild(activeRing);

    if (showNumbers) {
      const numSize = Math.round(cardH * 0.34);
      const numText = makeText(fonts, { text: String(i + 1), role: "display", weight: 700, size: numSize, color: textColor, anchor: 0.5, align: "center" });
      numText.position.set(0, -cardH * 0.16);
      cardC.addChild(numText);
    }

    const labelSize = Math.max(10, Math.round(cardH * 0.108));
    const labelY = showNumbers ? cardH * 0.24 : 0;
    const labelText = fitText(
      fonts,
      { text: step, role: "body", weight: 600, size: labelSize, color: textColor, anchor: 0.5, align: "center" },
      cardW * 0.82,
    );
    labelText.position.set(0, labelY);
    cardC.addChild(labelText);

    cardC.alpha = 0;
    cardC.scale.set(0);
    root.addChild(cardC);

    const s = CARD0 + i * CARD_EACH;
    timeline
      .to(cardC, { prop: "alpha", from: 0, to: 1, start: s, duration: 0.3, ease: outQuad })
      .to(cardC, { prop: "scale.x", from: 0, to: ACTIVE_SCALE, start: s, duration: POP_DUR, ease: spring(0.5) })
      .to(cardC, { prop: "scale.y", from: 0, to: ACTIVE_SCALE, start: s, duration: POP_DUR, ease: spring(0.5) });
    timeline.to(activeRing, { prop: "alpha", from: 0, to: 1, start: s, duration: 0.26, ease: outQuad });

    const isLast = i === n - 1;
    if (!isLast) {
      const deactStart = CARD0 + (i + 1) * CARD_EACH;
      timeline
        .to(cardC, { prop: "scale.x", from: ACTIVE_SCALE, to: REST_SCALE, start: deactStart, duration: DEACT_DUR, ease: outQuad })
        .to(cardC, { prop: "scale.y", from: ACTIVE_SCALE, to: REST_SCALE, start: deactStart, duration: DEACT_DUR, ease: outQuad })
        .to(activeRing, { prop: "alpha", from: 1, to: 0, start: deactStart, duration: DEACT_DUR, ease: outQuad });
    }
  });

  return { timeline, duration: computeDuration(values) };
}

export const processArrows: TemplateDefinition = {
  id: "process-arrows",
  name: "Process Arrows",
  tagline: "Numbered steps hand off emphasis behind bold chevron arrows.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", stepNumber: "display", stepLabel: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Our process", maxLength: 36, shrinkToFit: true },
    { key: "steps", type: "textlist", label: "Steps", default: DEFAULT_STEPS, minItems: 3, maxItems: 4, maxLength: 20 },
    { key: "showNumbers", type: "toggle", label: "Step numbers", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
