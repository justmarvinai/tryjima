import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  outQuint,
  safeRect,
  type Aspect,
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

// A soft colored spotlight sweeps across an off-white stage and settles on the
// title, which brightens from a faint ghost to full. No dark stage — the glow
// is a gentle accent pool on light, and the held title is dark-on-light.
const PALETTES: Palette[] = [
  { id: "warm", name: "Warm", colors: { background: "#FBF7F1", textColor: "#181109", accent: "#FF9E2C" } },
  { id: "rose", name: "Rose", colors: { background: "#FCF3F5", textColor: "#25101A", accent: "#F0487E" } },
  { id: "aqua", name: "Aqua", colors: { background: "#EFF8FA", textColor: "#082830", accent: "#12A5C4" } },
  { id: "violet", name: "Violet", colors: { background: "#F5F1FC", textColor: "#1D1140", accent: "#8446E6" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.084 : aspect === "9:16" ? 0.114 : 0.102;
}

const DURATION = 4.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FBF7F1"));
  const textColor = str(values.textColor, pc("textColor", "#181109"));
  const accent = str(values.accent, pc("accent", "#FF9E2C"));
  const title = str(values.title, "In the Spotlight");
  const subtitle = str(values.subtitle, "center stage");
  const showGlow = on(values.showGlow);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const maxDim = Math.max(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const centerY = zone.y + zone.height * 0.46;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- The spotlight glow (sweeps onto the title) ---
  const arriveAt = 0.9;
  if (showGlow) {
    const glow = new Sprite(radialGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = accent;
    glow.width = glow.height = maxDim * 0.92;
    glow.alpha = 0;
    const fromX = cx - minDim * 0.24;
    const fromY = centerY - minDim * 0.17;
    glow.position.set(fromX, fromY);
    glow.scale.set(glow.scale.x * 0.72, glow.scale.y * 0.72);
    root.addChild(glow);
    const s1 = glow.scale.x;
    timeline
      .to(glow, { prop: "alpha", from: 0, to: 0.42, start: 0.12, duration: 0.7, ease: outQuad })
      .to(glow, { prop: "x", from: fromX, to: cx, start: 0.12, duration: 0.85, ease: outCubic })
      .to(glow, { prop: "y", from: fromY, to: centerY, start: 0.12, duration: 0.85, ease: outCubic })
      .to(glow, { prop: "scale.x", from: s1, to: s1 / 0.72, start: 0.12, duration: 0.85, ease: outCubic })
      .to(glow, { prop: "scale.y", from: s1, to: s1 / 0.72, start: 0.12, duration: 0.85, ease: outCubic });
  }

  // --- Title + subtitle (brighten in as the light lands) ---
  const maxW = zone.width * (ctx.aspect === "16:9" ? 0.6 : 0.84);
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), maxW);
  const hasSub = subtitle.length > 0;
  const subSize = Math.round(titleSize * 0.3);
  const lineGap = subSize * 1.0;
  const totalH = titleSize + (hasSub ? lineGap + subSize : 0);

  const content = new Container();
  content.position.set(cx, centerY);
  root.addChild(content);

  const titleY = -totalH / 2 + titleSize / 2;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(0, titleY);
  titleText.alpha = 0.12;
  content.addChild(titleText);
  const brightenAt = showGlow ? arriveAt - 0.35 : 0.2;
  timeline
    .to(titleText, { prop: "alpha", from: 0.12, to: 1, start: brightenAt, duration: 0.55, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + 12, to: titleY, start: brightenAt, duration: 0.6, ease: outQuint });

  if (hasSub) {
    const subY = totalH / 2 - subSize / 2;
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 2 });
    subText.position.set(0, subY + 12);
    subText.alpha = 0;
    content.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.8, start: brightenAt + 0.4, duration: 0.5, ease: outQuad })
      .to(subText, { prop: "y", from: subY + 12, to: subY, start: brightenAt + 0.4, duration: 0.55, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const spotlightReveal: TemplateDefinition = {
  id: "spotlight-reveal",
  name: "Spotlight Reveal",
  tagline: "A soft spotlight sweeps onto the title, which brightens into view.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.5,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "In the Spotlight", maxLength: 28, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "center stage", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showGlow", type: "toggle", label: "Spotlight glow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
