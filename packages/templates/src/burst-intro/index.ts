import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  spring,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// An energy shockwave (rings + seeded rays) bursts from the center and the
// title punches in. Light stage throughout; the accent drives the burst, the
// title holds in the dark text color (>= 4.5:1) on the background.
const PALETTES: Palette[] = [
  { id: "volt", name: "Volt", colors: { background: "#F7F5F0", textColor: "#171308", accent: "#F5471E" } },
  { id: "electric", name: "Electric", colors: { background: "#EEF2FC", textColor: "#101A44", accent: "#3B5BF5" } },
  { id: "lime", name: "Lime", colors: { background: "#F3FAEB", textColor: "#1B2A08", accent: "#5FB50A" } },
  { id: "magenta", name: "Magenta", colors: { background: "#FCF1F8", textColor: "#2A0F24", accent: "#E12D9B" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.09 : aspect === "9:16" ? 0.118 : 0.106;
}

const BURST_START = 0.08;
const TITLE_START = 0.3;
const DURATION = 4.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F7F5F0"));
  const textColor = str(values.textColor, pc("textColor", "#171308"));
  const accent = str(values.accent, pc("accent", "#F5471E"));
  const title = str(values.title, "Boom");
  const subtitle = str(values.subtitle, "let's get started");
  const showBurst = on(values.showBurst);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const centerY = zone.y + zone.height * 0.46;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Shockwave rings + rays (behind the title) ---
  if (showBurst) {
    // Core flash.
    const flash = new Graphics().circle(0, 0, minDim * 0.1).fill(accent);
    flash.position.set(cx, centerY);
    flash.scale.set(0);
    root.addChild(flash);
    timeline
      .to(flash, { prop: "scale.x", from: 0, to: 1.6, start: BURST_START, duration: 0.45, ease: outExpo })
      .to(flash, { prop: "scale.y", from: 0, to: 1.6, start: BURST_START, duration: 0.45, ease: outExpo })
      .to(flash, { prop: "alpha", from: 0.5, to: 0, start: BURST_START, duration: 0.45, ease: outQuad });

    // Concentric rings.
    for (let k = 0; k < 3; k++) {
      const R = minDim * (0.16 + k * 0.13);
      const rw = Math.max(3, minDim * 0.011 * (1 - k * 0.22));
      const ring = new Graphics().circle(0, 0, R).stroke({ color: accent, width: rw });
      ring.position.set(cx, centerY);
      ring.scale.set(0);
      root.addChild(ring);
      const st = BURST_START + k * 0.07;
      timeline
        .to(ring, { prop: "scale.x", from: 0, to: 1, start: st, duration: 0.62, ease: outExpo })
        .to(ring, { prop: "scale.y", from: 0, to: 1, start: st, duration: 0.62, ease: outExpo })
        .to(ring, { prop: "alpha", from: 0.75, to: 0, start: st + 0.12, duration: 0.5, ease: outQuad });
    }

    // Seeded radial rays.
    const rays = 14;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + rng.range(-0.06, 0.06);
      const r0 = minDim * 0.12;
      const len = minDim * rng.range(0.1, 0.2);
      const th = minDim * rng.range(0.006, 0.012);
      const ray = new Container();
      ray.position.set(cx, centerY);
      ray.rotation = a;
      ray.scale.set(0, 1);
      ray.addChild(new Graphics().roundRect(r0, -th / 2, len, th, th / 2).fill(accent));
      root.addChild(ray);
      const st = BURST_START + rng.range(0, 0.06);
      timeline
        .to(ray, { prop: "scale.x", from: 0, to: 1, start: st, duration: 0.5, ease: outExpo })
        .to(ray, { prop: "alpha", from: 1, to: 0, start: st + 0.26, duration: 0.4, ease: outQuad });
    }
  }

  // --- Title + subtitle ---
  const maxW = zone.width * (ctx.aspect === "16:9" ? 0.62 : 0.86);
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), maxW);
  const hasSub = subtitle.length > 0;
  const subSize = Math.round(titleSize * 0.28);
  const lineGap = subSize * 1.1;
  const totalH = titleSize + (hasSub ? lineGap + subSize : 0);

  const titleY = centerY - totalH / 2 + titleSize / 2;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, titleY);
  titleText.alpha = 0;
  titleText.scale.set(0.5);
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: TITLE_START, duration: 0.28, ease: outQuad })
    .to(titleText, { prop: "scale.x", from: 0.5, to: 1, start: TITLE_START, duration: 0.6, ease: spring(0.38) })
    .to(titleText, { prop: "scale.y", from: 0.5, to: 1, start: TITLE_START, duration: 0.6, ease: spring(0.38) });

  if (hasSub) {
    const subY = centerY + totalH / 2 - subSize / 2;
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 2 });
    subText.position.set(cx, subY + 12);
    subText.alpha = 0;
    root.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.82, start: TITLE_START + 0.3, duration: 0.45, ease: outQuad })
      .to(subText, { prop: "y", from: subY + 12, to: subY, start: TITLE_START + 0.3, duration: 0.5, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const burstIntro: TemplateDefinition = {
  id: "burst-intro",
  name: "Burst Intro",
  tagline: "A shockwave bursts out and the title punches into the center.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Boom", maxLength: 24, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "let's get started", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showBurst", type: "toggle", label: "Shockwave", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
