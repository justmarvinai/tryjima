import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outQuint,
  inQuad,
  spring,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);

const PALETTES: Palette[] = [
  { id: "tangerine", name: "Tangerine dusk", colors: { background: "#FFF5EF", textColor: "#2A1206", ctaBg: "#FF4D1C", ctaText: "#FFFFFF", blob1: "#FF4D1C", blob2: "#FF8A3D", blob3: "#FF2E9E" } },
  { id: "berry", name: "Berry pop", colors: { background: "#FCEFF7", textColor: "#2A0A2A", ctaBg: "#FF2E9E", ctaText: "#FFFFFF", blob1: "#FF2E9E", blob2: "#7C5CFF", blob3: "#FF4D1C" } },
  { id: "lagoon", name: "Lagoon", colors: { background: "#ECFAFF", textColor: "#062A33", ctaBg: "#0EA5C4", ctaText: "#FFFFFF", blob1: "#38C7FF", blob2: "#7C5CFF", blob3: "#17A34A" } },
  { id: "sunset-lime", name: "Sunset lime", colors: { background: "#FBFFEA", textColor: "#22270A", ctaBg: "#FF6A1A", ctaText: "#FFFFFF", blob1: "#D8F34D", blob2: "#FF8A3D", blob3: "#FF4D1C" } },
];

interface Layout {
  headlineFrac: number;
  cy: number;
}
function aspectLayout(aspect: Aspect, height: number): Layout {
  switch (aspect) {
    case "16:9":
      return { headlineFrac: 0.13, cy: height * 0.5 };
    case "9:16":
      return { headlineFrac: 0.155, cy: height * 0.46 };
    default:
      return { headlineFrac: 0.15, cy: height * 0.47 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;

  const bg = str(values.background, pc("background", "#FFF5EF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const ctaBg = str(values.ctaBg, pc("ctaBg", "#FF4D1C"));
  const ctaText = pc("ctaText", "#FFFFFF");
  const blobs = [pc("blob1", "#FF4D1C"), pc("blob2", "#FF8A3D"), pc("blob3", "#FF2E9E")];
  const energy = num(values.blobEnergy, 0.6);
  const showGlow = values.glow !== false;

  const kicker = str(values.kicker, "SUMMER SALE");
  const headline = str(values.headline, "30% OFF");
  const detail = str(values.detail, "Everything. This week only.");
  const cta = str(values.cta, "Shop now");

  const timeline = new JimaTimeline();
  const DUR = 5.0;

  // --- Background + drifting glow blobs ---
  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));
  if (showGlow) {
    const maxDim = Math.max(size.width, size.height);
    const glowTex = radialGlowTexture();
    const driftR = 0.13 * Math.min(size.width, size.height) * energy;
    for (let i = 0; i < 3; i++) {
      const s = new Sprite(glowTex);
      s.anchor.set(0.5);
      s.tint = blobs[i]!;
      const diameter = maxDim * rng.range(0.7, 1.05);
      s.width = diameter;
      s.height = diameter;
      s.alpha = 0.85;
      const cx = size.width * rng.range(0.2, 0.8);
      const cy = size.height * rng.range(0.2, 0.8);
      const phase = rng.range(0, Math.PI * 2);
      root.addChild(s);
      // Four waypoints around a small circle, looping back to the start.
      const pts = [0, 1, 2, 3, 4].map((k) => {
        const a = phase + (k * Math.PI) / 2;
        return { x: cx + Math.cos(a) * driftR, y: cy + Math.sin(a) * driftR };
      });
      for (let k = 0; k < 4; k++) {
        const seg = DUR / 4;
        timeline
          .to(s, { prop: "x", from: pts[k]!.x, to: pts[k + 1]!.x, start: k * seg, duration: seg, ease: outQuad })
          .to(s, { prop: "y", from: pts[k]!.y, to: pts[k + 1]!.y, start: k * seg, duration: seg, ease: outQuad });
      }
      s.position.set(pts[0]!.x, pts[0]!.y);
    }
  }

  // --- Content (fades out at the end for a seamless loop) ---
  const content = new Container();
  root.addChild(content);
  const L = aspectLayout(ctx.aspect, size.height);
  const headlineSize = Math.round(size.width * L.headlineFrac);
  const cx = size.width / 2;

  const kickerText = makeText(fonts, { text: kicker.toUpperCase(), role: "body", weight: 600, size: Math.round(headlineSize * 0.24), color: textColor, anchor: 0.5, letterSpacing: 8 });
  kickerText.position.set(cx, L.cy - headlineSize * 0.9);
  kickerText.alpha = 0;
  content.addChild(kickerText);
  timeline
    .to(kickerText, { prop: "alpha", from: 0, to: 1, start: 0.0, duration: 0.4, ease: outQuad })
    .to(kickerText, { prop: "style.letterSpacing", from: Math.round(headlineSize * 0.24) * 0.6, to: 8, start: 0.0, duration: 0.5, ease: outQuint });

  const headlineText = makeText(fonts, { text: headline, role: "display", weight: 700, size: headlineSize, color: textColor, anchor: 0.5, align: "center" });
  headlineText.position.set(cx, L.cy);
  headlineText.alpha = 0;
  content.addChild(headlineText);
  timeline
    .to(headlineText, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.25, ease: outQuad })
    .to(headlineText, { prop: "scale.x", from: 1.35, to: 1, start: 0.5, duration: 0.6, ease: makeOutBack(1.4) })
    .to(headlineText, { prop: "scale.y", from: 1.35, to: 1, start: 0.5, duration: 0.6, ease: makeOutBack(1.4) });

  const detailText = makeText(fonts, { text: detail, role: "body", weight: 500, size: Math.round(headlineSize * 0.26), color: textColor, anchor: 0.5, align: "center" });
  detailText.position.set(cx, L.cy + headlineSize * 0.72);
  detailText.alpha = 0;
  content.addChild(detailText);
  timeline
    .to(detailText, { prop: "alpha", from: 0, to: 1, start: 1.1, duration: 0.5, ease: outQuad })
    .to(detailText, { prop: "y", from: L.cy + headlineSize * 0.72 + 14, to: L.cy + headlineSize * 0.72, start: 1.1, duration: 0.5, ease: outQuint });

  // CTA pill
  const ctaSize = Math.round(headlineSize * 0.28);
  const ctaW = fonts.measure(cta, { family: fonts.family("body"), weight: 600, size: ctaSize });
  const padX = ctaSize * 1.0;
  const padY = ctaSize * 0.55;
  const pillW = ctaW + padX * 2;
  const pillH = ctaSize + padY * 2;
  const pill = new Container();
  pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(ctaBg));
  const ctaLabel = makeText(fonts, { text: cta, role: "body", weight: 600, size: ctaSize, color: ctaText, anchor: 0.5 });
  pill.addChild(ctaLabel);
  pill.position.set(cx, L.cy + headlineSize * 1.35);
  pill.scale.set(0);
  content.addChild(pill);
  timeline.to(pill, { prop: "scale.x", from: 0, to: 1, start: 1.6, duration: 0.6, ease: spring(0.5) });
  timeline.to(pill, { prop: "scale.y", from: 0, to: 1, start: 1.6, duration: 0.6, ease: spring(0.5) });

  // Seamless-loop content fade at the tail.
  timeline.to(content, { prop: "alpha", from: 1, to: 0, start: DUR - 0.4, duration: 0.4, ease: inQuad });

  return { timeline, duration: DUR };
}

export const glowPromo: TemplateDefinition = {
  id: "glow-promo",
  name: "Glow Promo",
  tagline: "Punchy sale offer on a living gradient.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: true,
  posterTime: 2.2,
  palettes: PALETTES,
  fields: [
    { key: "kicker", type: "text", label: "Kicker", default: "SUMMER SALE", maxLength: 24 },
    { key: "headline", type: "text", label: "Headline", default: "30% OFF", maxLength: 32, shrinkToFit: true },
    { key: "detail", type: "text", label: "Detail", default: "Everything. This week only.", maxLength: 60 },
    { key: "cta", type: "text", label: "Button", default: "Shop now", maxLength: 20 },
    { key: "blobEnergy", type: "slider", label: "Background energy", default: 0.6, min: 0, max: 1, step: 0.05 },
    { key: "glow", type: "toggle", label: "Glow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "ctaBg", type: "color", label: "Button", default: "", optional: true },
  ],
  build,
};
