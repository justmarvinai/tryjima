import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  inQuad,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { makePill } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const DEG = Math.PI / 180;

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
  { id: "ember", name: "Ember", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "lime-ink", name: "Lime ink", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "berry", name: "Berry", colors: { background: "#1A0A14", textColor: "#FFFFFF", accent: "#FF2E9E" } },
  { id: "electric", name: "Electric", colors: { background: "#0A0A1E", textColor: "#FFFFFF", accent: "#2E7DF6" } },
];

interface L {
  headY: number;
  detailY: number;
  barY: number;
  ctaY: number;
}

function layout(aspect: Aspect, h: number): L {
  const f: Record<Aspect, { head: number; detail: number; bar: number; cta: number }> = {
    "1:1": { head: 0.38, detail: 0.52, bar: 0.66, cta: 0.8 },
    "4:5": { head: 0.36, detail: 0.49, bar: 0.64, cta: 0.8 },
    "9:16": { head: 0.4, detail: 0.52, bar: 0.63, cta: 0.73 },
    "16:9": { head: 0.34, detail: 0.52, bar: 0.66, cta: 0.82 },
  };
  const b = f[aspect];
  return { headY: h * b.head, detailY: h * b.detail, barY: h * b.bar, ctaY: h * b.cta };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#101014"));
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const showFlash = values.flash !== false;
  const showBolts = values.bolts !== false;
  const showUrgencyBar = values.urgencyBar !== false;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const L = layout(ctx.aspect, h);

  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  // --- Strike flash (behind content, spikes then clears) ---
  if (showFlash) {
    const flash = new Graphics().rect(0, 0, w, h).fill(accent);
    flash.alpha = 0;
    root.addChild(flash);
    timeline
      .to(flash, { prop: "alpha", from: 0, to: 0.5, start: 0.28, duration: 0.1, ease: outQuad })
      .to(flash, { prop: "alpha", from: 0.5, to: 0, start: 0.38, duration: 0.35, ease: outQuad });
  }

  // --- Headline (slams in) ---
  const headRaw = str(values.headline, "FLASH SALE").toUpperCase();
  const headLS = 4;
  const headSize = fitSize(fonts, headRaw, "display", 700, Math.round(minDim * 0.11), w * 0.5, headLS);
  const headW = fonts.measure(headRaw, { family: fonts.family("display"), weight: 700, size: headSize, letterSpacing: headLS });
  const head = makeText(fonts, { text: headRaw, role: "display", weight: 700, size: headSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: headLS });
  head.position.set(cx, L.headY);
  head.alpha = 0;
  root.addChild(head);
  timeline
    .to(head, { prop: "alpha", from: 0, to: 1, start: 0.25, duration: 0.2, ease: outQuad })
    .to(head, { prop: "scale.x", from: 1.4, to: 1, start: 0.25, duration: 0.4, ease: outExpo })
    .to(head, { prop: "scale.y", from: 1.4, to: 1, start: 0.25, duration: 0.4, ease: outExpo });

  // --- Lightning bolts flanking the headline (zap in) ---
  if (showBolts) {
    const boltSize = minDim * 0.12;
    const boltGap = boltSize * 0.45;
    const boltX = headW / 2 + boltGap + boltSize / 2;
    [-1, 1].forEach((sgn, idx) => {
      const bolt = makeIcon("bolt", boltSize, { color: accent });
      bolt.position.set(cx + sgn * boltX, L.headY);
      bolt.scale.set(0);
      bolt.rotation = sgn * 35 * DEG;
      root.addChild(bolt);
      const st = 0.45 + idx * 0.06;
      timeline
        .to(bolt, { prop: "scale.x", from: 0, to: 1, start: st, duration: 0.3, ease: outExpo })
        .to(bolt, { prop: "scale.y", from: 0, to: 1, start: st, duration: 0.3, ease: outExpo })
        .to(bolt, { prop: "rotation", from: sgn * 35 * DEG, to: 0, start: st, duration: 0.35, ease: outExpo });
    });
  }

  // --- Detail line ---
  const detailRaw = str(values.detail, "Everything 40% off — today only");
  const detSize = fitSize(fonts, detailRaw, "body", 600, Math.round(minDim * 0.038), w * 0.82);
  const det = makeText(fonts, { text: detailRaw, role: "body", weight: 600, size: detSize, color: textColor, anchor: 0.5, align: "center" });
  det.position.set(cx, L.detailY);
  det.alpha = 0;
  root.addChild(det);
  timeline
    .to(det, { prop: "alpha", from: 0, to: 1, start: 0.9, duration: 0.4, ease: outQuad })
    .to(det, { prop: "y", from: L.detailY + 16, to: L.detailY, start: 0.9, duration: 0.5, ease: outExpo });

  // --- Urgency bar (fill depletes like a countdown) ---
  if (showUrgencyBar) {
    const barW = w * 0.66;
    const barH = Math.max(10, minDim * 0.028);
    const barX = cx - barW / 2;
    const track = new Graphics().roundRect(0, 0, barW, barH, barH / 2).fill({ color: textColor, alpha: 0.16 });
    track.position.set(barX, L.barY);
    track.scale.set(0, 1);
    root.addChild(track);
    timeline.to(track, { prop: "scale.x", from: 0, to: 1, start: 1.3, duration: 0.4, ease: outExpo });

    const fill = new Graphics().roundRect(0, 0, barW, barH, barH / 2).fill(accent);
    fill.position.set(barX, L.barY);
    fill.scale.set(0, 1);
    root.addChild(fill);
    timeline
      .to(fill, { prop: "scale.x", from: 0, to: 1, start: 1.4, duration: 0.3, ease: outExpo })
      .to(fill, { prop: "scale.x", from: 1, to: 0.25, start: 1.75, duration: 2.0, ease: inQuad });

    const es = makeText(fonts, { text: "ENDS SOON", role: "body", weight: 700, size: Math.round(minDim * 0.026), color: accent, anchor: { x: 0, y: 1 }, letterSpacing: 2 });
    es.position.set(barX, L.barY - barH * 0.6);
    es.alpha = 0;
    root.addChild(es);
    timeline.to(es, { prop: "alpha", from: 0, to: 1, start: 1.4, duration: 0.4, ease: outQuad });
  }

  // --- CTA pill (springs in, pulses) ---
  const ctaRaw = str(values.cta, "Grab it now");
  const ctaSize = Math.round(minDim * 0.044);
  const ctaLabel = makeText(fonts, { text: ctaRaw, role: "display", weight: 700, size: ctaSize, color: bg, anchor: 0.5 });
  const ctaW = ctaLabel.width + ctaSize * 1.6;
  const ctaH = ctaSize * 2.0;
  const ctaC = new Container();
  ctaC.position.set(cx, L.ctaY);
  ctaC.addChild(makePill(ctaW, ctaH, accent));
  ctaC.addChild(ctaLabel);
  ctaC.scale.set(0);
  root.addChild(ctaC);
  timeline
    .to(ctaC, { prop: "scale.x", from: 0, to: 1, start: 1.8, duration: 0.55, ease: spring(0.42) })
    .to(ctaC, { prop: "scale.y", from: 0, to: 1, start: 1.8, duration: 0.55, ease: spring(0.42) })
    .to(ctaC, { prop: "scale.x", from: 1, to: 1.06, start: 2.6, duration: 0.2, ease: outQuad })
    .to(ctaC, { prop: "scale.x", from: 1.06, to: 1, start: 2.8, duration: 0.25, ease: outQuad })
    .to(ctaC, { prop: "scale.y", from: 1, to: 1.06, start: 2.6, duration: 0.2, ease: outQuad })
    .to(ctaC, { prop: "scale.y", from: 1.06, to: 1, start: 2.8, duration: 0.25, ease: outQuad })
    .to(ctaC, { prop: "scale.x", from: 1, to: 1.06, start: 3.2, duration: 0.2, ease: outQuad })
    .to(ctaC, { prop: "scale.x", from: 1.06, to: 1, start: 3.4, duration: 0.25, ease: outQuad })
    .to(ctaC, { prop: "scale.y", from: 1, to: 1.06, start: 3.2, duration: 0.2, ease: outQuad })
    .to(ctaC, { prop: "scale.y", from: 1.06, to: 1, start: 3.4, duration: 0.25, ease: outQuad });

  return { timeline, duration: 4.0 };
}

export const flashSale: TemplateDefinition = {
  id: "flash-sale",
  name: "Flash Sale",
  tagline: "High-voltage sale alert with lightning and a countdown.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.4,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "FLASH SALE", maxLength: 20, shrinkToFit: true },
    { key: "detail", type: "text", label: "Detail", default: "Everything 40% off — today only", maxLength: 44, shrinkToFit: true },
    { key: "cta", type: "text", label: "Button", default: "Grab it now", maxLength: 20 },
    { key: "flash", type: "toggle", label: "Screen flash", default: true },
    { key: "bolts", type: "toggle", label: "Lightning bolts", default: true },
    { key: "urgencyBar", type: "toggle", label: "Urgency bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
