import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outExpo,
  outQuad,
  safeZone,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { groupThousands } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);
const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (a.length) return a;
  }
  return fb;
};

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
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
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", cardColor: "#F6F6F8", goodColor: "#17A34A", badColor: "#E1483D" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", cardColor: "#FFFFFF", goodColor: "#17A34A", badColor: "#E1483D" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D", cardColor: "#1C1C22", goodColor: "#3DDC84", badColor: "#FF5C5C" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF", cardColor: "#FFFFFF", goodColor: "#17A34A", badColor: "#E1483D" } },
];

const DEFAULT_KPIS = ["Revenue | $48,200 | +12%", "Orders | 1,204 | +6%", "Refunds | 38 | -3%", "Visitors | 22,900 | +18%"];

interface Kpi {
  label: string;
  prefix: string;
  target: number;
  decimals: number;
  suffix: string;
  deltaText: string;
  up: boolean;
}

/** Parse "label | value | delta" — value keeps any prefix/suffix around its numeric core. */
function parseKpi(raw: string): Kpi {
  const parts = raw.split("|");
  const label = (parts[0] ?? "").trim();
  const valuePart = (parts[1] ?? "0").trim();
  const deltaPart = (parts[2] ?? "").trim();
  const m = valuePart.match(/\d[\d,]*(\.\d+)?/);
  let prefix = valuePart;
  let suffix = "";
  let decimals = 0;
  let target = 0;
  if (m) {
    const numStr = m[0];
    const idx = m.index ?? 0;
    prefix = valuePart.slice(0, idx);
    suffix = valuePart.slice(idx + numStr.length);
    const dot = numStr.indexOf(".");
    decimals = dot >= 0 ? numStr.length - dot - 1 : 0;
    target = Number(numStr.replace(/,/g, ""));
  }
  const up = !deltaPart.startsWith("-");
  return { label: label.length ? label : raw.trim(), prefix, target, decimals, suffix, deltaText: deltaPart, up };
}

function resolveKpis(values: Values): Kpi[] {
  const raw = asList(values.kpis, DEFAULT_KPIS);
  const items = raw.length >= 4 ? raw.slice(0, 4) : DEFAULT_KPIS;
  return items.map(parseKpi);
}

/** Format a mid-count value, preserving decimals (mirrors three-stats). */
function formatValue(value: number, decimals: number): string {
  if (decimals > 0) {
    const factor = Math.pow(10, decimals);
    const rounded = Math.round(value * factor) / factor;
    const whole = Math.floor(rounded);
    const frac = Math.round((rounded - whole) * factor);
    return `${groupThousands(whole)}.${String(frac).padStart(decimals, "0")}`;
  }
  return groupThousands(value);
}

const START0 = 0.4;
const EACH = 0.16;
const POP_DUR = 0.6;
const COUNT_DUR = 1.3;
const HOLD = 1.2;
const DURATION = START0 + 3 * EACH + 0.15 + COUNT_DUR + 0.28 + HOLD;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const cardColor = pc("cardColor", "#F6F6F8");
  const goodColor = pc("goodColor", "#17A34A");
  const badColor = pc("badColor", "#E1483D");
  const titleRaw = str(values.title, "");
  const showTrend = values.showTrend !== false;
  const showStripe = values.accentStripe !== false;

  const kpis = resolveKpis(values);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const insets = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  const hasTitle = titleRaw.length > 0;
  const titleY = insets.top + minDim * 0.055;
  const gridTop = hasTitle ? titleY + minDim * 0.095 : insets.top + minDim * 0.02;
  const gridBottom = h - insets.bottom;

  if (hasTitle) {
    const titleSize = fitSize(fonts, titleRaw, "display", 700, Math.round(minDim * 0.052), w * 0.86);
    const titleText = makeText(fonts, { text: titleRaw, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
    titleText.position.set(w / 2, titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
      .to(titleText, { prop: "y", from: titleY - 14, to: titleY, start: 0, duration: 0.5, ease: outExpo });
  }

  // --- 2x2 grid geometry (always two columns, two rows) ---
  const gap = minDim * 0.045;
  const gridW = w - insets.left - insets.right;
  const gridH = gridBottom - gridTop;
  const tileW = (gridW - gap) / 2;
  const tileH = (gridH - gap) / 2;
  const c0x = insets.left + tileW / 2;
  const c1x = insets.left + tileW + gap + tileW / 2;
  const r0y = gridTop + tileH / 2;
  const r1y = gridTop + tileH + gap + tileH / 2;
  const positions = [
    { x: c0x, y: r0y },
    { x: c1x, y: r0y },
    { x: c0x, y: r1y },
    { x: c1x, y: r1y },
  ];

  const r = Math.min(tileW, tileH) * 0.09;
  const padX = tileW * 0.13;
  const counters: { kpi: Kpi; text: Text; start: number }[] = [];

  kpis.forEach((kpi, i) => {
    const pos = positions[i]!;
    const card = new Container();
    card.position.set(pos.x, pos.y);

    card.addChild(new Graphics().roundRect(-tileW / 2, -tileH / 2 + tileH * 0.04, tileW, tileH, r).fill({ color: "#000000", alpha: 0.06 }));
    card.addChild(new Graphics().roundRect(-tileW / 2, -tileH / 2, tileW, tileH, r).fill(cardColor));

    if (showStripe) {
      const stripeW = Math.max(4, tileW * 0.016);
      card.addChild(
        new Graphics().roundRect(-tileW / 2, -tileH / 2 + r * 0.6, stripeW, tileH - r * 1.2, stripeW / 2).fill(accent),
      );
    }

    const labelSize = Math.max(9, Math.round(Math.min(tileW, tileH) * 0.088));
    const labelText = fitText(
      fonts,
      { text: kpi.label, role: "body", weight: 600, size: labelSize, color: textColor, anchor: { x: 0, y: 0 } },
      tileW - padX * 2,
    );
    labelText.position.set(-tileW / 2 + padX, -tileH * 0.3);
    card.addChild(labelText);

    const fullStr = kpi.prefix + formatValue(kpi.target, kpi.decimals) + kpi.suffix;
    const baseNumSize = Math.round(Math.min(tileW, tileH) * 0.24);
    const numSize = fitSize(fonts, fullStr, "display", 700, baseNumSize, tileW - padX * 2);
    const numText = makeText(fonts, {
      text: kpi.prefix + "0" + kpi.suffix,
      role: "display",
      weight: 700,
      size: numSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    numText.position.set(-tileW / 2 + padX, -tileH * 0.02);
    card.addChild(numText);

    if (showTrend) {
      const triSize = Math.min(tileW, tileH) * 0.075;
      const arrowColor = kpi.up ? goodColor : badColor;
      const tri = new Graphics();
      if (kpi.up) tri.poly([0, -triSize * 0.5, triSize * 0.48, triSize * 0.42, -triSize * 0.48, triSize * 0.42]).fill(arrowColor);
      else tri.poly([0, triSize * 0.5, triSize * 0.48, -triSize * 0.42, -triSize * 0.48, -triSize * 0.42]).fill(arrowColor);
      tri.position.set(-tileW / 2 + padX + triSize * 0.5, tileH * 0.3);
      card.addChild(tri);

      if (kpi.deltaText.length > 0) {
        const deltaSize = Math.max(9, Math.round(labelSize * 0.96));
        const deltaText = fitText(
          fonts,
          { text: kpi.deltaText, role: "body", weight: 600, size: deltaSize, color: textColor, anchor: { x: 0, y: 0.5 } },
          tileW - padX * 2 - triSize * 1.4,
        );
        deltaText.position.set(-tileW / 2 + padX + triSize * 1.3, tileH * 0.3);
        card.addChild(deltaText);
      }
    }

    card.alpha = 0;
    card.scale.set(0);
    root.addChild(card);

    const start = START0 + i * EACH;
    timeline
      .to(card, { prop: "alpha", from: 0, to: 1, start, duration: 0.32, ease: outQuad })
      .to(card, { prop: "scale.x", from: 0, to: 1, start, duration: POP_DUR, ease: makeOutBack(1.5) })
      .to(card, { prop: "scale.y", from: 0, to: 1, start, duration: POP_DUR, ease: makeOutBack(1.5) });

    const countStart = start + 0.15;
    const countEnd = countStart + COUNT_DUR;
    timeline
      .to(numText, { prop: "scale.x", from: 1, to: 1.06, start: countEnd, duration: 0.1, ease: outQuad })
      .to(numText, { prop: "scale.x", from: 1.06, to: 1, start: countEnd + 0.1, duration: 0.18, ease: outQuad })
      .to(numText, { prop: "scale.y", from: 1, to: 1.06, start: countEnd, duration: 0.1, ease: outQuad })
      .to(numText, { prop: "scale.y", from: 1.06, to: 1, start: countEnd + 0.1, duration: 0.18, ease: outQuad });

    counters.push({ kpi, text: numText, start: countStart });
  });

  const update = (t: number): void => {
    for (const c of counters) {
      const p = outExpo(clamp01((t - c.start) / COUNT_DUR));
      c.text.text = c.kpi.prefix + formatValue(c.kpi.target * p, c.kpi.decimals) + c.kpi.suffix;
    }
  };

  return { timeline, duration: DURATION, update };
}

export const kpiTiles: TemplateDefinition = {
  id: "kpi-tiles",
  name: "KPI Tiles",
  tagline: "A 2x2 grid of metric tiles pop in and count up with trends.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.7,
  fontRoles: { number: "display", label: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "This month", maxLength: 28, optional: true, shrinkToFit: true },
    { key: "kpis", type: "textlist", label: "KPIs (label | value | delta)", default: DEFAULT_KPIS, minItems: 4, maxItems: 4, maxLength: 32 },
    { key: "showTrend", type: "toggle", label: "Trend arrows", default: true },
    { key: "accentStripe", type: "toggle", label: "Accent stripe", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
