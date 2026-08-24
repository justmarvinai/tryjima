import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  makeOutBack,
  spring,
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
const DEG = Math.PI / 180;

// Shrink a font size so `text` fits within `maxWidth` (never grows it).
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
  letterSpacing = 0,
): number {
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size,
    ...(letterSpacing ? { letterSpacing } : {}),
  });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "sky", name: "Sky", colors: { background: "#EAF4FF", textColor: "#0B2447", accent: "#2E7DF6" } },
  { id: "sunset", name: "Sunset", colors: { background: "#FFF1E8", textColor: "#3A1500", accent: "#FF4D1C" } },
  { id: "ink", name: "Ink", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "paper", name: "Paper", colors: { background: "#FAF5EA", textColor: "#2A1A5E", accent: "#7C5CFF" } },
];

interface L {
  destY: number;
  codesY: number;
  arcY: number;
  datesY: number;
  stampY: number;
  xL: number;
  xR: number;
}

function layout(aspect: Aspect, w: number, h: number): L {
  const f: Record<Aspect, { destY: number; codesY: number; arcY: number; datesY: number; stampY: number; xl: number; xr: number }> = {
    "1:1": { destY: 0.3, codesY: 0.43, arcY: 0.62, datesY: 0.82, stampY: 0.12, xl: 0.18, xr: 0.82 },
    "4:5": { destY: 0.3, codesY: 0.42, arcY: 0.62, datesY: 0.82, stampY: 0.12, xl: 0.18, xr: 0.82 },
    "9:16": { destY: 0.3, codesY: 0.41, arcY: 0.58, datesY: 0.74, stampY: 0.15, xl: 0.18, xr: 0.82 },
    "16:9": { destY: 0.26, codesY: 0.42, arcY: 0.66, datesY: 0.84, stampY: 0.12, xl: 0.18, xr: 0.82 },
  };
  const b = f[aspect];
  return {
    destY: h * b.destY,
    codesY: h * b.codesY,
    arcY: h * b.arcY,
    datesY: h * b.datesY,
    stampY: h * b.stampY,
    xL: w * b.xl,
    xR: w * b.xr,
  };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EAF4FF"));
  const textColor = str(values.textColor, pc("textColor", "#0B2447"));
  const accent = str(values.accent, pc("accent", "#2E7DF6"));
  const showStamp = values.stamp !== false;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const L = layout(ctx.aspect, w, h);

  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  // --- Postmark stamp (corner) ---
  if (showStamp) {
    const stampR = minDim * 0.072;
    const stamp = new Container();
    stamp.position.set(w * 0.8, L.stampY);
    stamp.addChild(new Graphics().star(0, 0, 16, stampR, stampR * 0.86).fill(accent));
    stamp.addChild(new Graphics().circle(0, 0, stampR * 0.72).fill(bg));
    const st1 = makeText(fonts, { text: "AIR", role: "display", weight: 700, size: Math.round(stampR * 0.42), color: accent, anchor: 0.5 });
    st1.position.set(0, -stampR * 0.22);
    const st2 = makeText(fonts, { text: "MAIL", role: "display", weight: 700, size: Math.round(stampR * 0.34), color: accent, anchor: 0.5 });
    st2.position.set(0, stampR * 0.26);
    stamp.addChild(st1);
    stamp.addChild(st2);
    stamp.scale.set(0);
    stamp.rotation = -14 * DEG;
    root.addChild(stamp);
    timeline
      .to(stamp, { prop: "scale.x", from: 0, to: 1, start: 0.5, duration: 0.7, ease: spring(0.5) })
      .to(stamp, { prop: "scale.y", from: 0, to: 1, start: 0.5, duration: 0.7, ease: spring(0.5) });
  }

  // --- Destination ---
  const destRaw = str(values.destination, "Barcelona");
  const destSize = fitSize(fonts, destRaw, "display", 700, Math.round(minDim * 0.115), w * 0.82);
  const dest = makeText(fonts, { text: destRaw, role: "display", weight: 700, size: destSize, color: textColor, anchor: 0.5, align: "center" });
  dest.position.set(cx, L.destY);
  dest.alpha = 0;
  root.addChild(dest);
  timeline
    .to(dest, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.5, ease: outQuad })
    .to(dest, { prop: "scale.x", from: 1.18, to: 1, start: 0.3, duration: 0.6, ease: outExpo })
    .to(dest, { prop: "scale.y", from: 1.18, to: 1, start: 0.3, duration: 0.6, ease: outExpo });

  // --- From -> To code row (mono, plane between) ---
  const fromCode = str(values.fromCode, "NYC");
  const toCode = str(values.toCode, "BCN");
  const codeSize = Math.round(minDim * 0.052);
  const cw1 = fonts.measure(fromCode, { family: fonts.family("mono"), weight: 700, size: codeSize });
  const cw2 = fonts.measure(toCode, { family: fonts.family("mono"), weight: 700, size: codeSize });
  const sepSize = codeSize * 1.1;
  const cgap = codeSize * 0.55;
  const total = cw1 + cgap + sepSize + cgap + cw2;
  const startX = -total / 2;
  const codes = new Container();
  codes.position.set(cx, L.codesY);
  const t1 = makeText(fonts, { text: fromCode, role: "mono", weight: 700, size: codeSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  t1.position.set(startX, 0);
  const sep = makeIcon("plane", sepSize, { color: accent });
  sep.position.set(startX + cw1 + cgap + sepSize / 2, 0);
  sep.rotation = 6 * DEG;
  const t2 = makeText(fonts, { text: toCode, role: "mono", weight: 700, size: codeSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  t2.position.set(startX + cw1 + cgap + sepSize + cgap, 0);
  codes.addChild(t1);
  codes.addChild(sep);
  codes.addChild(t2);
  codes.alpha = 0;
  root.addChild(codes);
  timeline
    .to(codes, { prop: "alpha", from: 0, to: 1, start: 0.7, duration: 0.5, ease: outQuad })
    .to(codes, { prop: "y", from: L.codesY + 16, to: L.codesY, start: 0.7, duration: 0.6, ease: outExpo });

  // --- Dashed flight arc (origin dot -> pin) ---
  const d = (L.xR - L.xL) / 2;
  const midX = (L.xL + L.xR) / 2;
  const bulge = (L.xR - L.xL) * 0.16;
  const Rc = (d * d + bulge * bulge) / (2 * bulge);
  const centerY = L.arcY - bulge + Rc;
  const aL = Math.atan2(bulge - Rc, -d);
  const aR = Math.atan2(bulge - Rc, d);
  const arcG = new Graphics();
  dashedPath(arcG, arcPoints(midX, centerY, Rc, aL, aR, 72), {
    dash: 14,
    gap: 10,
    width: Math.max(3, minDim * 0.008),
    color: accent,
    cap: "round",
  });
  arcG.alpha = 0;
  root.addChild(arcG);
  timeline.to(arcG, { prop: "alpha", from: 0, to: 1, start: 1.0, duration: 0.6, ease: outQuad });

  // Origin dot (left).
  const dotR = minDim * 0.02;
  const dot = new Container();
  dot.position.set(L.xL, L.arcY);
  dot.addChild(new Graphics().circle(0, 0, dotR).fill(accent));
  dot.addChild(new Graphics().circle(0, 0, dotR * 0.45).fill(bg));
  dot.scale.set(0);
  root.addChild(dot);
  timeline
    .to(dot, { prop: "scale.x", from: 0, to: 1, start: 1.0, duration: 0.5, ease: makeOutBack(2.4) })
    .to(dot, { prop: "scale.y", from: 0, to: 1, start: 1.0, duration: 0.5, ease: makeOutBack(2.4) });

  // Destination pin (right) — drops as the plane arrives.
  const pinSize = minDim * 0.12;
  const pinRest = L.arcY - pinSize * 0.5; // tip lands on the arc endpoint
  const pinC = new Container();
  pinC.addChild(makeIcon("pin", pinSize, { color: accent, holeColor: bg }));
  pinC.position.set(L.xR, pinRest);
  pinC.alpha = 0;
  root.addChild(pinC);
  timeline
    .to(pinC, { prop: "alpha", from: 0, to: 1, start: 2.9, duration: 0.3, ease: outQuad })
    .to(pinC, { prop: "y", from: pinRest - minDim * 0.16, to: pinRest, start: 2.9, duration: 0.6, ease: makeOutBack(2) });

  // Plane flying along the arc (pure function of t).
  const planeSize = minDim * 0.07;
  const plane = makeIcon("plane", planeSize, { color: accent });
  plane.visible = false;
  root.addChild(plane);
  const flyStart = 1.2;
  const flyEnd = 3.2;

  // --- Dates ---
  const dates = str(values.dates, "JUN 12 – JUN 20");
  const dateSize = fitSize(fonts, dates, "body", 500, Math.round(minDim * 0.032), w * 0.8, 4);
  const dt = makeText(fonts, { text: dates, role: "body", weight: 500, size: dateSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 4 });
  dt.position.set(cx, L.datesY);
  dt.alpha = 0;
  root.addChild(dt);
  timeline
    .to(dt, { prop: "alpha", from: 0, to: 0.7, start: 1.6, duration: 0.5, ease: outQuad })
    .to(dt, { prop: "y", from: L.datesY + 14, to: L.datesY, start: 1.6, duration: 0.6, ease: outExpo });

  const update = (t: number): void => {
    if (t < flyStart) {
      plane.visible = false;
      return;
    }
    plane.visible = true;
    const u = clamp01((t - flyStart) / (flyEnd - flyStart));
    const a = aL + (aR - aL) * inOutQuad(u);
    plane.x = midX + Math.cos(a) * Rc;
    plane.y = centerY + Math.sin(a) * Rc;
    // Tangent (increasing angle) is (-sin a, cos a); glyph nose points up-right.
    plane.rotation = Math.atan2(Math.cos(a), -Math.sin(a)) + Math.PI / 4;
    plane.alpha = clamp01((t - flyStart) / 0.25);
  };

  return { timeline, duration: 4.6, update };
}

export const travelPostcard: TemplateDefinition = {
  id: "travel-postcard",
  name: "Travel Postcard",
  tagline: "A boarding-pass postcard with a plane tracing its route.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.2,
  palettes: PALETTES,
  fields: [
    { key: "destination", type: "text", label: "Destination", default: "Barcelona", maxLength: 24, shrinkToFit: true },
    { key: "fromCode", type: "text", label: "From", default: "NYC", maxLength: 4 },
    { key: "toCode", type: "text", label: "To", default: "BCN", maxLength: 4 },
    { key: "dates", type: "text", label: "Dates", default: "JUN 12 – JUN 20", maxLength: 24 },
    { key: "stamp", type: "toggle", label: "Postmark stamp", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
