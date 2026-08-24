import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuint,
  makeOutBack,
  safeZone,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { groupThousands, parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Largest size <= size0 at which `text` fits `maxWidth` (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

interface Kpi {
  prefix: string;
  suffix: string;
  target: number;
  isStatic: boolean;
  raw: string;
}

/** Split a KPI string like "12,480", "$2,400" or "1,200 pts" into an animatable number. */
function parseKpi(raw: string): Kpi {
  const trimmed = raw.trim();
  const m = /^(\D*)(\d[\d,]*)(.*)$/.exec(trimmed);
  if (!m) return { prefix: "", suffix: "", target: 0, isStatic: true, raw: trimmed };
  return { prefix: m[1] ?? "", suffix: m[3] ?? "", target: parseTargetNumber(m[2] ?? ""), isStatic: false, raw: trimmed };
}

const fmtKpi = (k: Kpi, p: number): string =>
  k.isStatic ? k.raw : k.prefix + groupThousands(Math.round(k.target * p)) + k.suffix;

// Only the full-frame `bg` rect is tied to the background field (blanked by
// transparent export); the pill uses its own palette-only `cardBg` (with a soft
// shadow) so the KPI survives as overlay content over footage. `positive` /
// `negative` / `deltaText` are fixed, contrast-checked colors for the delta
// chip, so the change stays legible regardless of the brand accent.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#EEF1F6", cardBg: "#FFFFFF", textColor: "#0B0B0F", accent: "#2E5BD6", positive: "#0F7A3B", negative: "#B0242E", deltaText: "#FFFFFF" } },
  { id: "paper", name: "Paper", colors: { background: "#F4F1EA", cardBg: "#FFFFFF", textColor: "#17130D", accent: "#B31232", positive: "#0F7A3B", negative: "#B0242E", deltaText: "#FFFFFF" } },
  { id: "mint", name: "Mint", colors: { background: "#E7F5EE", cardBg: "#FFFFFF", textColor: "#0B1F16", accent: "#046A4E", positive: "#0F7A3B", negative: "#B0242E", deltaText: "#FFFFFF" } },
  { id: "ink", name: "Ink", colors: { background: "#0D0D11", cardBg: "#1B1B22", textColor: "#FFFFFF", accent: "#7CC4FF", positive: "#1F9E57", negative: "#D64B54", deltaText: "#0B0B0F" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F6"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#0B0B0F"));
  const accent = str(values.accent, pc("accent", "#2E5BD6"));
  const positive = pc("positive", "#0F7A3B");
  const negative = pc("negative", "#B0242E");
  const deltaText = pc("deltaText", "#FFFFFF");

  const valueRaw = str(values.value, "12,480");
  const label = str(values.label, "New followers");
  const deltaRaw = str(values.delta, "+18%");
  const showDelta = values.showDelta !== false && deltaRaw.length > 0;
  const showAccent = values.showAccent !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const kpi = parseKpi(valueRaw);

  // Delta chip: sign drives the triangle direction and the chip color.
  const isNeg = deltaRaw.trim().startsWith("-");
  const deltaMag = deltaRaw.trim().replace(/^[+-]\s*/, "");
  const deltaColor = isNeg ? negative : positive;

  const padX = Math.round(minDim * 0.03);
  const padY = Math.round(minDim * 0.024);
  const rowGap = Math.round(minDim * 0.006);
  const stripeW = showAccent ? Math.max(4, Math.round(minDim * 0.008)) : 0;
  const stripeGap = showAccent ? Math.round(minDim * 0.018) : 0;

  // Budget the number/label column against the frame width (minus paddings,
  // stripe and a reserved delta chip).
  const numberSize = Math.round(minDim * 0.058);
  const labelSize0 = Math.round(minDim * 0.026);

  const deltaTextSize = Math.round(minDim * 0.024);
  const deltaPadX = Math.round(minDim * 0.016);
  const deltaPadY = Math.round(minDim * 0.01);
  const triW = Math.round(deltaTextSize * 0.72);
  const triGap = Math.round(deltaTextSize * 0.4);
  const deltaMagW = showDelta ? fonts.measure(deltaMag, { family: fonts.family("body"), weight: 700, size: deltaTextSize }) : 0;
  const deltaChipW = showDelta ? deltaPadX * 2 + triW + triGap + deltaMagW : 0;
  const deltaChipH = showDelta ? deltaTextSize + deltaPadY * 2 : 0;
  const deltaGap = showDelta ? Math.round(minDim * 0.026) : 0;

  const outerMaxW = w - zone.left - zone.right;
  const colMaxW = Math.max(80, outerMaxW - padX * 2 - stripeW - stripeGap - deltaChipW - deltaGap);

  const finalNumStr = fmtKpi(kpi, 1);
  const numSize = fitSize(fonts, finalNumStr, "display", 700, numberSize, colMaxW);
  const labelSize = fitSize(fonts, label, "body", 600, labelSize0, colMaxW);
  const numW = fonts.measure(finalNumStr, { family: fonts.family("display"), weight: 700, size: numSize });
  const labelW = fonts.measure(label, { family: fonts.family("body"), weight: 600, size: labelSize });
  const colW = Math.max(numW, labelW);

  const contentH = numSize + rowGap + labelSize;
  const pillH = padY * 2 + Math.max(contentH, deltaChipH);
  const pillW = padX * 2 + stripeW + stripeGap + colW + deltaGap + deltaChipW;
  const pillRadius = Math.round(pillH * 0.24);

  const marginBottom = Math.round(minDim * 0.03);
  const pillCenterX = zone.left + pillW / 2;
  const pillCenterY = h - zone.bottom - marginBottom - pillH / 2;

  const pill = new Container();
  pill.position.set(pillCenterX, pillCenterY);
  pill.alpha = 0;
  root.addChild(pill);

  // Soft shadow + pill surface.
  const e = Math.round(pillH * 0.03);
  const off = Math.round(pillH * 0.05);
  pill.addChild(
    new Graphics()
      .roundRect(-pillW / 2 - e, -pillH / 2 - e + off, pillW + e * 2, pillH + e * 2, pillRadius + e)
      .fill({ color: "#000000", alpha: 0.16 }),
  );
  pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillRadius).fill(cardBg));

  let cursorX = -pillW / 2 + padX;
  if (showAccent) {
    const stripeH = Math.max(contentH, deltaChipH);
    pill.addChild(new Graphics().roundRect(cursorX, -stripeH / 2, stripeW, stripeH, stripeW / 2).fill(accent));
    cursorX += stripeW + stripeGap;
  }

  const colLeft = cursorX;
  const numCenterY = -contentH / 2 + numSize / 2;
  const labelCenterY = contentH / 2 - labelSize / 2;

  const numberText = makeText(fonts, {
    text: fmtKpi(kpi, 0),
    role: "display",
    weight: 700,
    size: numSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  numberText.position.set(colLeft, numCenterY);
  pill.addChild(numberText);

  const labelText = makeText(fonts, {
    text: label,
    role: "body",
    weight: 600,
    size: labelSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  labelText.alpha = 0.68;
  labelText.position.set(colLeft, labelCenterY);
  pill.addChild(labelText);

  // --- Delta chip (pops after the count settles). ---
  const countStart = 0.5;
  const countDur = 1.0;
  const countEnd = countStart + countDur;
  let deltaChip: Container | undefined;
  if (showDelta) {
    deltaChip = new Container();
    const chipCX = pillW / 2 - padX - deltaChipW / 2;
    deltaChip.position.set(chipCX, numCenterY);
    deltaChip.scale.set(0);
    pill.addChild(deltaChip);
    deltaChip.addChild(new Graphics().roundRect(-deltaChipW / 2, -deltaChipH / 2, deltaChipW, deltaChipH, deltaChipH / 2).fill(deltaColor));

    const triCX = -deltaChipW / 2 + deltaPadX + triW / 2;
    const th = triW * 0.86;
    const tri = new Graphics();
    if (isNeg) {
      tri.poly([-triW / 2, -th / 2, triW / 2, -th / 2, 0, th / 2]).fill(deltaText);
    } else {
      tri.poly([0, -th / 2, triW / 2, th / 2, -triW / 2, th / 2]).fill(deltaText);
    }
    tri.position.set(triCX, 0);
    deltaChip.addChild(tri);

    const magText = makeText(fonts, {
      text: deltaMag,
      role: "body",
      weight: 700,
      size: deltaTextSize,
      color: deltaText,
      anchor: { x: 0, y: 0.5 },
    });
    magText.position.set(triCX + triW / 2 + triGap, 0);
    deltaChip.addChild(magText);

    timeline
      .to(deltaChip, { prop: "scale.x", from: 0, to: 1, start: countEnd, duration: 0.45, ease: makeOutBack(2) })
      .to(deltaChip, { prop: "scale.y", from: 0, to: 1, start: countEnd, duration: 0.45, ease: makeOutBack(2) });
  }

  // --- Pill entrance: rise + fade in as one unit, then the number counts up. ---
  const restY = pillCenterY;
  const fromY = restY + minDim * 0.05;
  pill.position.y = fromY;
  timeline
    .to(pill, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outExpo })
    .to(pill, { prop: "position.y", from: fromY, to: restY, start: 0, duration: 0.55, ease: outQuint });

  const update = (t: number): void => {
    const p = clamp01((t - countStart) / countDur);
    numberText.text = fmtKpi(kpi, outExpo(p));
  };

  return { timeline, duration: 4.2, update };
}

export const metricBar: TemplateDefinition = {
  id: "metric-bar",
  name: "Metric Bar",
  tagline: "A lower-third pill counts up one KPI with a delta chip.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { value: "display", label: "body", delta: "body" },
  palettes: PALETTES,
  fields: [
    { key: "value", type: "text", label: "Value", default: "12,480", maxLength: 14, shrinkToFit: true },
    { key: "label", type: "text", label: "Label", default: "New followers", maxLength: 30, shrinkToFit: true },
    { key: "delta", type: "text", label: "Delta", default: "+18%", maxLength: 10, optional: true, shrinkToFit: true },
    { key: "showDelta", type: "toggle", label: "Delta chip", default: true },
    { key: "showAccent", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
