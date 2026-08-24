import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  makeOutBack,
  inOutQuad,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { arcPoints, dashedPath } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
  letterSpacing = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size,
    ...(letterSpacing ? { letterSpacing } : {}),
  });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "runway-navy", name: "Runway navy", colors: { background: "#EAF0FB", cardColor: "#0B1A33", textColor: "#FFFFFF", accent: "#FFB020" } },
  { id: "redeye", name: "Red-eye ink", colors: { background: "#14131A", cardColor: "#1D1B24", textColor: "#F5F1E6", accent: "#6FE7DC" } },
  { id: "sunrise", name: "Sunrise coral", colors: { background: "#FFF3EC", cardColor: "#FFFFFF", textColor: "#2A1200", accent: "#C93813" } },
  { id: "mint-cloud", name: "Mint cloud", colors: { background: "#EAF7F1", cardColor: "#FFFFFF", textColor: "#0B2A1E", accent: "#0C7A50" } },
];

interface L {
  pw: number;
  ph: number;
  cy: number;
}

function layout(aspect: Aspect, w: number, h: number): L {
  const f: Record<Aspect, { pw: number; ph: number; cy: number }> = {
    "1:1": { pw: 0.82, ph: 0.48, cy: 0.46 },
    "4:5": { pw: 0.84, ph: 0.48, cy: 0.42 },
    "9:16": { pw: 0.86, ph: 0.5, cy: 0.38 },
    "16:9": { pw: 0.56, ph: 0.36, cy: 0.46 },
  };
  const b = f[aspect];
  return { pw: w * b.pw, ph: w * b.ph, cy: h * b.cy };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EAF0FB"));
  const cardColor = pc("cardColor", "#0B1A33");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FFB020"));
  const showPlane = values.showPlane !== false;

  const fromCode = str(values.fromCode, "NYC").toUpperCase();
  const toCode = str(values.toCode, "LON").toUpperCase();
  const dateVal = str(values.date, "12 SEP");
  const gateVal = str(values.gate, "B12");
  const seatVal = str(values.seat, "14A");

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const { pw, ph, cy } = layout(ctx.aspect, w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- The card assembly — flips open along its vertical axis ---
  const pass = new Container();
  pass.position.set(cx, cy);
  pass.scale.set(0, 1);
  pass.alpha = 0.5;
  root.addChild(pass);

  const radius = ph * 0.07;
  pass.addChild(new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, radius).fill(cardColor));

  const pad = pw * 0.07;
  const contentLeft = -pw / 2 + pad;
  const contentRight = pw / 2 - pad;
  const contentW = contentRight - contentLeft;

  // Eyebrow.
  const eyebrowY = -ph / 2 + ph * 0.115;
  const eyebrowSize = Math.round(ph * 0.05);
  const eyebrow = makeText(fonts, { text: "BOARDING PASS", role: "body", weight: 600, size: eyebrowSize, color: accent, anchor: { x: 0, y: 0.5 }, letterSpacing: 3 });
  eyebrow.position.set(contentLeft, eyebrowY);
  eyebrow.alpha = 0;
  pass.addChild(eyebrow);

  // FROM / TO codes.
  const codesY = -ph * 0.03;
  const codeSize = fitSize(fonts, `${fromCode}${toCode}`, "mono", 700, Math.round(ph * 0.15), contentW * 0.32);
  const fromText = makeText(fonts, { text: fromCode, role: "mono", weight: 700, size: codeSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  fromText.position.set(contentLeft, codesY);
  fromText.alpha = 0;
  pass.addChild(fromText);
  const toText = makeText(fonts, { text: toCode, role: "mono", weight: 700, size: codeSize, color: textColor, anchor: { x: 1, y: 0.5 } });
  toText.position.set(contentRight, codesY);
  toText.alpha = 0;
  pass.addChild(toText);

  // Dashed route arc between the codes (bulges upward), plane travels it.
  const gap = ph * 0.07;
  const arcXL = contentLeft + fromText.width + gap;
  const arcXR = Math.max(arcXL + ph * 0.2, contentRight - toText.width - gap);
  const d = (arcXR - arcXL) / 2;
  const midX = (arcXL + arcXR) / 2;
  const bulge = ph * 0.1;
  const Rc = (d * d + bulge * bulge) / (2 * bulge);
  const centerY = codesY - bulge + Rc;
  const aL = Math.atan2(bulge - Rc, -d);
  const aR = Math.atan2(bulge - Rc, d);

  const arcG = new Graphics();
  dashedPath(arcG, arcPoints(midX, centerY, Rc, aL, aR, 56), {
    dash: 8,
    gap: 7,
    width: Math.max(2, minDim * 0.004),
    color: accent,
    cap: "round",
  });
  arcG.alpha = 0;
  pass.addChild(arcG);

  // Plane (optional) — pure function of t, flies from origin to destination.
  const planeSize = ph * 0.11;
  const plane = showPlane ? makeIcon("plane", planeSize, { color: accent }) : null;
  if (plane) {
    plane.visible = false;
    pass.addChild(plane);
  }
  const flyStart = 1.0;
  const flyEnd = 2.3;

  // Divider rule under the codes.
  const dividerY = ph * 0.11;
  const divider = new Graphics().roundRect(0, 0, contentW, Math.max(2, ph * 0.006), 1).fill({ color: textColor, alpha: 0.16 });
  divider.position.set(contentLeft, dividerY);
  divider.scale.set(0, 1);
  pass.addChild(divider);

  // --- DATE / GATE / SEAT grid ---
  const cols: { key: string; val: string }[] = [
    { key: "DATE", val: dateVal },
    { key: "GATE", val: gateVal },
    { key: "SEAT", val: seatVal },
  ];
  const colW = contentW / cols.length;
  const labelY = ph * 0.21;
  const valueY = ph * 0.35;
  const labelSize = Math.round(ph * 0.052);
  const valueSize = Math.round(ph * 0.088);

  const gridHolders: Container[] = cols.map((col, i) => {
    const colCx = contentLeft + colW * (i + 0.5);
    const holder = new Container();
    holder.alpha = 0;

    const lblSize = fitSize(fonts, col.key, "body", 600, labelSize, colW * 0.86, 1.5);
    const lbl = makeText(fonts, { text: col.key, role: "body", weight: 600, size: lblSize, color: accent, anchor: 0.5, letterSpacing: 1.5 });
    lbl.position.set(colCx, labelY);
    holder.addChild(lbl);

    const valSize = fitSize(fonts, col.val, "display", 700, valueSize, colW * 0.86);
    const val = makeText(fonts, { text: col.val, role: "display", weight: 700, size: valSize, color: textColor, anchor: 0.5 });
    val.position.set(colCx, valueY);
    holder.addChild(val);

    pass.addChild(holder);
    return holder;
  });

  // --- Timeline ---
  const flipDur = 0.5;
  timeline
    .to(pass, { prop: "scale.x", from: 0, to: 1, start: 0, duration: flipDur, ease: makeOutBack(1.6) })
    .to(pass, { prop: "alpha", from: 0.5, to: 1, start: 0, duration: 0.22, ease: outQuad })
    .to(pass, { prop: "scale.x", from: 1, to: 1.04, start: flipDur, duration: 0.12, ease: outQuad })
    .to(pass, { prop: "scale.x", from: 1.04, to: 1, start: flipDur + 0.12, duration: 0.16, ease: outQuad });

  timeline
    .to(eyebrow, { prop: "alpha", from: 0, to: 1, start: 0.55, duration: 0.3, ease: outQuad })
    .to(fromText, { prop: "alpha", from: 0, to: 1, start: 0.65, duration: 0.35, ease: outQuad })
    .to(fromText, { prop: "x", from: contentLeft - ph * 0.08, to: contentLeft, start: 0.65, duration: 0.4, ease: outExpo })
    .to(toText, { prop: "alpha", from: 0, to: 1, start: 0.75, duration: 0.35, ease: outQuad })
    .to(toText, { prop: "x", from: contentRight + ph * 0.08, to: contentRight, start: 0.75, duration: 0.4, ease: outExpo })
    .to(arcG, { prop: "alpha", from: 0, to: 1, start: 0.95, duration: 0.4, ease: outQuad })
    .to(divider, { prop: "scale.x", from: 0, to: 1, start: 0.95, duration: 0.4, ease: outExpo });

  const gridStart = 1.6;
  const gridStagger = 0.15;
  gridHolders.forEach((holder, i) => {
    const start = gridStart + i * gridStagger;
    timeline
      .to(holder, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(holder, { prop: "y", from: 14, to: 0, start, duration: 0.45, ease: outQuint });
  });

  const update = (t: number): void => {
    if (!plane) return;
    if (t < flyStart) {
      plane.visible = false;
      return;
    }
    plane.visible = true;
    const u = clamp01((t - flyStart) / (flyEnd - flyStart));
    const a = aL + (aR - aL) * inOutQuad(u);
    plane.x = midX + Math.cos(a) * Rc;
    plane.y = centerY + Math.sin(a) * Rc;
    plane.rotation = Math.atan2(Math.cos(a), -Math.sin(a)) + Math.PI / 4;
    plane.alpha = clamp01((t - flyStart) / 0.25);
  };

  return { timeline, duration: 3.6, update };
}

export const boardingPass: TemplateDefinition = {
  id: "boarding-pass",
  name: "Boarding Pass",
  tagline: "A boarding pass flips open as a plane traces the route.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.5,
  palettes: PALETTES,
  fields: [
    { key: "fromCode", type: "text", label: "From", default: "NYC", maxLength: 4 },
    { key: "toCode", type: "text", label: "To", default: "LON", maxLength: 4 },
    { key: "date", type: "text", label: "Date", default: "12 SEP", maxLength: 16 },
    { key: "gate", type: "text", label: "Gate", default: "B12", maxLength: 8 },
    { key: "seat", type: "text", label: "Seat", default: "14A", maxLength: 8 },
    { key: "showPlane", type: "toggle", label: "Plane on route", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
