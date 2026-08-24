import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type Rng,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "blaze-ink", name: "Blaze ink", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "electric-white", name: "Electric white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#2E7DF6" } },
  { id: "volt-lime", name: "Volt lime", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "sunset-pop", name: "Sunset pop", colors: { background: "#1A0B08", textColor: "#FFF4EC", accent: "#FF6B35" } },
];

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

function fontFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.1 : aspect === "9:16" ? 0.13 : 0.12;
}

/** Tapered radial speed-lines from `innerR` out to `outerR`, seeded via `rng`. */
function speedBurst(count: number, innerR: number, outerR: number, color: string, rng: Rng): Graphics {
  const g = new Graphics();
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rng.range(-0.06, 0.06);
    const len = rng.range(outerR * 0.7, Math.max(outerR * 0.7, outerR - innerR));
    const halfW = rng.range(innerR * 0.06, innerR * 0.12);
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const px = -uy * halfW;
    const py = ux * halfW;
    const x0 = ux * innerR + px;
    const y0 = uy * innerR + py;
    const x1 = ux * innerR - px;
    const y1 = uy * innerR - py;
    const x2 = ux * (innerR + len);
    const y2 = uy * (innerR + len);
    g.poly([x0, y0, x1, y1, x2, y2]).fill(color);
  }
  return g;
}

const SLAM_DUR = 0.32;
const IMPACT_T = SLAM_DUR;
const DUR = 3.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#101014"));
  const textColor = str(values.textColor, pcol("textColor", "#FFFFFF"));
  const accent = str(values.accent, pcol("accent", "#FF4D1C"));
  const title = str(values.title, "BIG NEWS");
  const subline = str(values.subline, "");
  const showStreaks = on(values.showStreaks);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const cy = h * 0.48;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Radial speed-line burst, right behind the title, popping at impact ---
  if (showStreaks) {
    const burst = speedBurst(22, minDim * 0.12, minDim * 0.6, accent, rng);
    burst.position.set(cx, cy);
    burst.scale.set(0.5);
    burst.alpha = 0;
    burst.label = "streaks";
    root.addChild(burst);
    timeline
      .to(burst, { prop: "alpha", from: 0, to: 0.9, start: IMPACT_T - 0.02, duration: 0.05, ease: outQuad })
      .to(burst, { prop: "alpha", from: 0.9, to: 0, start: IMPACT_T + 0.05, duration: 0.5, ease: outQuad })
      .to(burst, { prop: "scale.x", from: 0.5, to: 1.3, start: IMPACT_T - 0.02, duration: 0.4, ease: outExpo })
      .to(burst, { prop: "scale.y", from: 0.5, to: 1.3, start: IMPACT_T - 0.02, duration: 0.4, ease: outExpo })
      .to(burst, { prop: "rotation", from: 0, to: 0.25, start: IMPACT_T - 0.02, duration: 0.55, ease: outQuad });
  }

  // --- Title: slams in from a huge scale, recoils, then holds clean ---
  const fontSize0 = Math.round(w * fontFrac(ctx.aspect));
  const maxWidth = w * (ctx.aspect === "16:9" ? 0.7 : 0.86);
  const fontSize = fitSize(fonts, title, "display", 700, fontSize0, maxWidth);
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, cy);
  titleText.scale.set(4);
  root.addChild(titleText);

  timeline
    .to(titleText, { prop: "scale.x", from: 4, to: 1, start: 0, duration: SLAM_DUR, ease: outExpo })
    .to(titleText, { prop: "scale.y", from: 4, to: 1, start: 0, duration: SLAM_DUR, ease: outExpo })
    // A quick decaying recoil absorbs the impact.
    .to(titleText, { prop: "scale.x", from: 1, to: 0.955, start: IMPACT_T, duration: 0.07, ease: outQuad })
    .to(titleText, { prop: "scale.y", from: 1, to: 0.955, start: IMPACT_T, duration: 0.07, ease: outQuad })
    .to(titleText, { prop: "scale.x", from: 0.955, to: 1.018, start: IMPACT_T + 0.07, duration: 0.09, ease: outQuad })
    .to(titleText, { prop: "scale.y", from: 0.955, to: 1.018, start: IMPACT_T + 0.07, duration: 0.09, ease: outQuad })
    .to(titleText, { prop: "scale.x", from: 1.018, to: 0.992, start: IMPACT_T + 0.16, duration: 0.07, ease: outQuad })
    .to(titleText, { prop: "scale.y", from: 1.018, to: 0.992, start: IMPACT_T + 0.16, duration: 0.07, ease: outQuad })
    .to(titleText, { prop: "scale.x", from: 0.992, to: 1, start: IMPACT_T + 0.23, duration: 0.08, ease: outQuad })
    .to(titleText, { prop: "scale.y", from: 0.992, to: 1, start: IMPACT_T + 0.23, duration: 0.08, ease: outQuad });

  if (subline.length > 0) {
    const subSize = Math.round(fontSize * 0.28);
    const subY = cy + fontSize * 0.62 + subSize * 0.7;
    const subText = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 500,
      size: subSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: 1,
    });
    subText.position.set(cx, subY + 14);
    subText.alpha = 0;
    root.addChild(subText);
    const subStart = IMPACT_T + 0.45;
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.92, start: subStart, duration: 0.4, ease: outQuad })
      .to(subText, { prop: "y", from: subY + 14, to: subY, start: subStart, duration: 0.45, ease: outQuint });
  }

  // --- A quick white flash frame right at the moment of impact ---
  const flash = new Graphics().rect(0, 0, w, h).fill("#FFFFFF");
  flash.alpha = 0;
  flash.label = "flash";
  root.addChild(flash);
  timeline
    .to(flash, { prop: "alpha", from: 0, to: 0.9, start: IMPACT_T - 0.015, duration: 0.02, ease: outQuad })
    .to(flash, { prop: "alpha", from: 0.9, to: 0, start: IMPACT_T, duration: 0.2, ease: outQuad });

  return { timeline, duration: DUR };
}

export const zoomPunch: TemplateDefinition = {
  id: "zoom-punch",
  name: "Zoom Punch",
  tagline: "A title slams in from a huge zoom with a flash and streak burst.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { title: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "BIG NEWS", maxLength: 20, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "you don't want to miss this", maxLength: 48, optional: true },
    { key: "showStreaks", type: "toggle", label: "Speed-line burst", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
