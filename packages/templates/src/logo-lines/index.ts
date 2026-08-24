import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  safeZone,
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

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6" } },
  { id: "grape-night", name: "Grape night", colors: { background: "#1B1030", textColor: "#FFFFFF", accent: "#7C5CFF" } },
];

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

function brandFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.09 : aspect === "9:16" ? 0.115 : 0.105;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#FFFFFF"));
  const textColor = str(values.textColor, pcol("textColor", "#101014"));
  const accent = str(values.accent, pcol("accent", "#FF4D1C"));
  const brand = str(values.brand, "Jima");
  const tagline = str(values.tagline, "");
  const showLines = values.showLines !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const availW = w * 0.84;

  const zone = safeZone(ctx.aspect);
  const safeH = h - zone.top - zone.bottom;
  const brandCy = zone.top + safeH * 0.44;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const brandSizeRaw = Math.round(w * brandFrac(ctx.aspect));
  const brandSize = fitSize(fonts, brand, "display", 700, brandSizeRaw, availW);
  const brandText = makeText(fonts, { text: brand, role: "display", weight: 700, size: brandSize, color: textColor, anchor: 0.5, align: "center" });
  brandText.position.set(cx, brandCy);
  root.addChild(brandText);

  let clearAt: number;
  if (showLines) {
    brandText.alpha = 1;

    const barHalf = brandSize * 0.78;
    const revealStart = 0.4;
    const revealDur = 0.55;
    const topFrom = brandCy - barHalf;
    const topTo = -barHalf * 1.15;
    const bottomFrom = brandCy;
    const bottomTo = h + barHalf * 0.15;

    const topBar = new Graphics().rect(0, 0, w, barHalf).fill(accent);
    topBar.position.set(0, topFrom);
    topBar.label = "top-bar";
    root.addChild(topBar);

    const bottomBar = new Graphics().rect(0, 0, w, barHalf).fill(accent);
    bottomBar.position.set(0, bottomFrom);
    bottomBar.label = "bottom-bar";
    root.addChild(bottomBar);

    timeline
      .to(topBar, { prop: "y", from: topFrom, to: topTo, start: revealStart, duration: revealDur, ease: outExpo })
      .to(bottomBar, { prop: "y", from: bottomFrom, to: bottomTo, start: revealStart, duration: revealDur, ease: outExpo });

    clearAt = revealStart + revealDur;

    // A tiny settle pulse on the brand once the bars have cleared it.
    timeline
      .to(brandText, { prop: "scale.x", from: 1, to: 1.045, start: clearAt - 0.05, duration: 0.12, ease: outQuad })
      .to(brandText, { prop: "scale.x", from: 1.045, to: 1, start: clearAt + 0.07, duration: 0.18, ease: outQuad })
      .to(brandText, { prop: "scale.y", from: 1, to: 1.045, start: clearAt - 0.05, duration: 0.12, ease: outQuad })
      .to(brandText, { prop: "scale.y", from: 1.045, to: 1, start: clearAt + 0.07, duration: 0.18, ease: outQuad });
  } else {
    const fadeStart = 0.3;
    const fadeDur = 0.6;
    brandText.alpha = 0;
    brandText.position.set(cx, brandCy + 18);
    timeline
      .to(brandText, { prop: "alpha", from: 0, to: 1, start: fadeStart, duration: 0.5, ease: outQuad })
      .to(brandText, { prop: "y", from: brandCy + 18, to: brandCy, start: fadeStart, duration: fadeDur, ease: outExpo });
    clearAt = fadeStart + fadeDur;
  }

  // --- Tagline (optional, fades under the brand) ---
  if (tagline.length > 0) {
    const tagSizeRaw = Math.round(minDim * 0.034);
    const tagSize = fitSize(fonts, tagline, "body", 500, tagSizeRaw, availW);
    const tagY = brandCy + brandSize * 0.68;
    const tagText = makeText(fonts, { text: tagline, role: "body", weight: 500, size: tagSize, color: textColor, anchor: 0.5, align: "center" });
    tagText.position.set(cx, tagY + 14);
    tagText.alpha = 0;
    root.addChild(tagText);
    const tagStart = clearAt + 0.15;
    timeline
      .to(tagText, { prop: "alpha", from: 0, to: 0.9, start: tagStart, duration: 0.45, ease: outQuad })
      .to(tagText, { prop: "y", from: tagY + 14, to: tagY, start: tagStart, duration: 0.55, ease: outQuint });
  }

  return { timeline, duration: 4.2 };
}

export const logoLines: TemplateDefinition = {
  id: "logo-lines",
  name: "Logo Reveal Lines",
  tagline: "Two bars wipe apart to reveal the brand name.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { brand: "display", tagline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "brand", type: "text", label: "Brand", default: "Jima", maxLength: 28, shrinkToFit: true },
    { key: "tagline", type: "text", label: "Tagline", default: "motion for everyone", maxLength: 48, optional: true },
    { key: "showLines", type: "toggle", label: "Reveal bars", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
