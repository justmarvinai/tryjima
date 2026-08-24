import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outExpo,
  outQuad,
  outQuint,
  spring,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

interface Pt {
  x: number;
  y: number;
}

/** n points evenly spaced along a centered rounded-rect path, starting at top-center, clockwise. */
function perimeterPoints(W: number, H: number, r: number, n: number): Pt[] {
  const sw = Math.max(0, W - 2 * r);
  const sh = Math.max(0, H - 2 * r);
  const arc = (Math.PI / 2) * r;
  const total = 2 * sw + 2 * sh + 4 * arc;
  const arcAt =
    (cx0: number, cy0: number, a0: number) =>
    (u: number): Pt => ({
      x: cx0 + Math.cos(a0 + (u * Math.PI) / 2) * r,
      y: cy0 + Math.sin(a0 + (u * Math.PI) / 2) * r,
    });
  const segs: { len: number; at: (u: number) => Pt }[] = [
    { len: sw, at: (u) => ({ x: -W / 2 + r + u * sw, y: -H / 2 }) },
    { len: arc, at: arcAt(W / 2 - r, -H / 2 + r, -Math.PI / 2) },
    { len: sh, at: (u) => ({ x: W / 2, y: -H / 2 + r + u * sh }) },
    { len: arc, at: arcAt(W / 2 - r, H / 2 - r, 0) },
    { len: sw, at: (u) => ({ x: W / 2 - r - u * sw, y: H / 2 }) },
    { len: arc, at: arcAt(-W / 2 + r, H / 2 - r, Math.PI / 2) },
    { len: sh, at: (u) => ({ x: -W / 2, y: H / 2 - r - u * sh }) },
    { len: arc, at: arcAt(-W / 2 + r, -H / 2 + r, Math.PI) },
  ];
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    let d = (sw / 2 + (i / n) * total) % total;
    let placed = false;
    for (const s of segs) {
      if (d <= s.len + 1e-6) {
        pts.push(s.at(s.len <= 0 ? 0 : Math.min(1, d / s.len)));
        placed = true;
        break;
      }
      d -= s.len;
    }
    if (!placed) pts.push(segs[0]!.at(0));
  }
  return pts;
}

// A theater-marquee sign: a banded frame studded with bulbs. Bulbs pop in
// around the border, run a classic every-third chase, the title slams into the
// plate, and the chase settles to a gentle twinkle. The title always sits on
// the light inner plate (>= 4.5:1 in every palette).
const PALETTES: Palette[] = [
  { id: "matinee", name: "Matinee", colors: { background: "#FAF3E7", plate: "#FFFBF1", frame: "#C9402F", bulb: "#FFC53D", textColor: "#33150E" } },
  { id: "boulevard", name: "Boulevard", colors: { background: "#EEF2F9", plate: "#FFFFFF", frame: "#23408F", bulb: "#FFD25E", textColor: "#16264D" } },
  { id: "candy", name: "Candy", colors: { background: "#FCEFF4", plate: "#FFFFFF", frame: "#D6336C", bulb: "#FFB84D", textColor: "#3A0F22" } },
  { id: "midnight", name: "Midnight", colors: { background: "#141020", plate: "#201A33", frame: "#6C5CE7", bulb: "#FFD166", textColor: "#FBF6E8" } },
];

const CHASE_START = 1.4;
const CHASE_END = 2.75;
const CHASE_RATE = 9; // discrete steps/sec — floor(t * rate) keeps it pure in t
const TWINKLE_MIX = 0.45;
const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FAF3E7"));
  const plate = pc("plate", "#FFFBF1");
  const frame = str(values.accent, pc("frame", "#C9402F"));
  const bulbCol = str(values.bulbColor, pc("bulb", "#FFC53D"));
  const textColor = str(values.textColor, pc("textColor", "#33150E"));
  const title = str(values.title, "The Big Show");
  const subtitle = str(values.subtitle, "opening night");
  const showGlow = on(values.showGlow);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const plateCy = zone.y + zone.height * 0.47;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const plateW = zone.width * (ctx.aspect === "16:9" ? 0.62 : 0.92);
  const plateH = Math.min(zone.height * 0.52, plateW * (ctx.aspect === "16:9" ? 0.42 : 0.62));
  const r = minDim * 0.05;
  const bandW = minDim * 0.058;

  // --- The whole sign pops in as one unit ---
  const sign = new Container();
  sign.position.set(cx, plateCy);
  sign.alpha = 0;
  sign.scale.set(0.85);
  root.addChild(sign);
  timeline
    .to(sign, { prop: "alpha", from: 0, to: 1, start: 0.08, duration: 0.3, ease: outQuad })
    .to(sign, { prop: "scale.x", from: 0.85, to: 1, start: 0.08, duration: 0.55, ease: spring(0.55) })
    .to(sign, { prop: "scale.y", from: 0.85, to: 1, start: 0.08, duration: 0.55, ease: spring(0.55) });

  const e = minDim * 0.016;
  sign.addChild(
    new Graphics()
      .roundRect(-plateW / 2 - e, -plateH / 2 - e + e * 1.6, plateW + 2 * e, plateH + 2 * e, r + e)
      .fill({ color: "#000000", alpha: 0.14 }),
  );
  sign.addChild(new Graphics().roundRect(-plateW / 2, -plateH / 2, plateW, plateH, r).fill(frame));
  const ipW = plateW - 2 * bandW;
  const ipH = plateH - 2 * bandW;
  const ipR = Math.max(6, r - bandW * 0.7);
  sign.addChild(new Graphics().roundRect(-ipW / 2, -ipH / 2, ipW, ipH, ipR).fill(plate));
  const pin = minDim * 0.012;
  sign.addChild(
    new Graphics()
      .roundRect(-ipW / 2 + pin, -ipH / 2 + pin, ipW - 2 * pin, ipH - 2 * pin, Math.max(4, ipR - pin))
      .stroke({ color: frame, alpha: 0.3, width: 2 }),
  );

  // --- Bulbs on the band centerline ---
  const innerW = plateW - bandW;
  const innerH = plateH - bandW;
  const rB = Math.max(8, r - bandW / 2);
  const per = 2 * (innerW - 2 * rB) + 2 * (innerH - 2 * rB) + Math.PI * 2 * rB;
  let n = Math.round(per / (minDim * 0.078));
  n = Math.max(12, Math.min(36, n));
  n = Math.round(n / 3) * 3;
  const pts = perimeterPoints(innerW, innerH, rB, n);
  const bulbR = minDim * 0.0155;

  const bulbs: { lit: Graphics; glow: Sprite | null; phase: number }[] = [];
  pts.forEach((p, i) => {
    const bulb = new Container();
    bulb.position.set(p.x, p.y);
    bulb.scale.set(0);
    sign.addChild(bulb);

    let glow: Sprite | null = null;
    if (showGlow) {
      glow = new Sprite(radialGlowTexture());
      glow.anchor.set(0.5);
      glow.tint = bulbCol;
      glow.width = bulbR * 6;
      glow.height = bulbR * 6;
      glow.alpha = 0.6;
      bulb.addChild(glow);
    }
    // Off-state glass + socket rim (visible when the bulb is dim).
    bulb.addChild(
      new Graphics()
        .circle(0, 0, bulbR)
        .fill({ color: bulbCol, alpha: 0.22 })
        .circle(0, 0, bulbR)
        .stroke({ color: "#000000", alpha: 0.25, width: 1.5 }),
    );
    const lit = new Graphics()
      .circle(0, 0, bulbR)
      .fill(bulbCol)
      .circle(0, 0, bulbR * 0.42)
      .fill({ color: "#FFFFFF", alpha: 0.9 });
    bulb.addChild(lit);
    bulbs.push({ lit, glow, phase: rng.next() });

    const st = 0.45 + (i / n) * 0.75;
    timeline
      .to(bulb, { prop: "scale.x", from: 0, to: 1, start: st, duration: 0.32, ease: makeOutBack(2.4) })
      .to(bulb, { prop: "scale.y", from: 0, to: 1, start: st, duration: 0.32, ease: makeOutBack(2.4) });
  });

  // --- Title slams into the plate mid-chase ---
  const maxW = ipW - minDim * 0.05;
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(Math.min(ipH * 0.34, w * (ctx.aspect === "16:9" ? 0.055 : 0.07))), maxW);
  const hasSub = subtitle.length > 0;
  const subSize = Math.max(18, Math.round(titleSize * 0.3));
  const lockGap = subSize * 0.9;
  const lockH = titleSize + (hasSub ? lockGap + subSize : 0);

  const titleY = -lockH / 2 + titleSize / 2;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(0, titleY);
  titleText.alpha = 0;
  titleText.scale.set(2.3);
  sign.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 1.75, duration: 0.12, ease: outQuad })
    .to(titleText, { prop: "scale.x", from: 2.3, to: 1, start: 1.75, duration: 0.38, ease: outExpo })
    .to(titleText, { prop: "scale.y", from: 2.3, to: 1, start: 1.75, duration: 0.38, ease: outExpo })
    .to(titleText, { prop: "scale.x", from: 1, to: 1.045, start: 2.2, duration: 0.12, ease: outQuad })
    .to(titleText, { prop: "scale.x", from: 1.045, to: 1, start: 2.32, duration: 0.22, ease: outQuad })
    .to(titleText, { prop: "scale.y", from: 1, to: 1.045, start: 2.2, duration: 0.12, ease: outQuad })
    .to(titleText, { prop: "scale.y", from: 1.045, to: 1, start: 2.32, duration: 0.22, ease: outQuad });

  if (hasSub) {
    const subFit = fitSize(fonts, subtitle, "body", 600, subSize, maxW * 0.9);
    const subY = lockH / 2 - subSize / 2;
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 600, size: subFit, color: textColor, anchor: 0.5, align: "center", letterSpacing: 2 });
    subText.position.set(0, subY + 14);
    subText.alpha = 0;
    sign.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.85, start: 2.1, duration: 0.4, ease: outQuad })
      .to(subText, { prop: "y", from: subY + 14, to: subY, start: 2.1, duration: 0.45, ease: outQuint });
  }

  // --- Bulb brightness: pop lit -> chase -> gentle twinkle (pure in t) ---
  const stepsAtEnd = Math.floor((CHASE_END - CHASE_START) * CHASE_RATE);
  const chaseLit = (i: number, step: number): number => ((((i - step) % 3) + 3) % 3 === 0 ? 1 : 0.16);
  const update = (t: number): void => {
    for (let i = 0; i < bulbs.length; i++) {
      const b = bulbs[i]!;
      let lum: number;
      if (t < CHASE_START) {
        lum = 1;
      } else if (t < CHASE_END) {
        lum = chaseLit(i, Math.floor((t - CHASE_START) * CHASE_RATE));
      } else {
        const base = chaseLit(i, stepsAtEnd);
        const tw = 0.8 + 0.2 * (0.5 + 0.5 * Math.sin((t * 0.55 + b.phase) * Math.PI * 2));
        const mix = Math.min(1, (t - CHASE_END) / TWINKLE_MIX);
        lum = base + (tw - base) * mix;
      }
      b.lit.alpha = lum;
      if (b.glow) b.glow.alpha = lum * 0.6;
    }
  };

  return { timeline, duration: DURATION, update };
}

export const marqueeBulbs: TemplateDefinition = {
  id: "marquee-bulbs",
  name: "Marquee Bulbs",
  tagline: "Marquee bulbs chase around a showbiz frame as your title slams in.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "The Big Show", maxLength: 24, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "opening night", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "showGlow", type: "toggle", label: "Bulb glow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Frame", default: "", optional: true },
    { key: "bulbColor", type: "color", label: "Bulbs", default: "", optional: true },
  ],
  build,
};
