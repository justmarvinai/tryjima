import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
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

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// A clean, cinematic episode-title card: a small accent kicker, a big title, a
// thin accent rule, and a subtitle — all rising and fading in, then holding.
// Light stage, dark title (>= 4.5:1); the accent is the kicker and rule.
const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#FAF8F4", textColor: "#16130F", accent: "#E0552B" } },
  { id: "slate", name: "Slate", colors: { background: "#F1F4F8", textColor: "#111A26", accent: "#2E7DF6" } },
  { id: "sage", name: "Sage", colors: { background: "#F0F6EE", textColor: "#16240F", accent: "#4E9E3A" } },
  { id: "mauve", name: "Mauve", colors: { background: "#F8F2F6", textColor: "#241420", accent: "#B23F86" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.078 : aspect === "9:16" ? 0.108 : 0.096;
}

const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FAF8F4"));
  const textColor = str(values.textColor, pc("textColor", "#16130F"));
  const accent = str(values.accent, pc("accent", "#E0552B"));
  const kicker = str(values.kicker, "Episode One").toUpperCase();
  const title = str(values.title, "The Beginning");
  const subtitle = str(values.subtitle, "a story in motion");
  const showRule = on(values.showRule);

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

  const maxW = zone.width * (ctx.aspect === "16:9" ? 0.66 : 0.88);
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), maxW);
  const hasKicker = kicker.length > 0;
  const hasSub = subtitle.length > 0;
  const kickerSize = fitSize(fonts, kicker, "body", 600, Math.max(12, Math.round(titleSize * 0.24)), maxW);
  const subSize = fitSize(fonts, subtitle, "body", 500, Math.round(titleSize * 0.3), maxW);
  const ruleH = Math.max(3, minDim * 0.006);
  const ruleW = Math.min(maxW * 0.5, minDim * 0.16);

  const gapKT = titleSize * 0.36;
  const gapTR = titleSize * 0.36;
  const gapRS = subSize * 0.95;
  const gapTS = titleSize * 0.42;

  let totalH = titleSize;
  if (hasKicker) totalH += kickerSize + gapKT;
  if (showRule) totalH += gapTR + ruleH;
  if (hasSub) totalH += (showRule ? gapRS : gapTS) + subSize;

  let y = centerY - totalH / 2;

  // Kicker.
  if (hasKicker) {
    const kickerCy = y + kickerSize / 2;
    const kickerText = makeText(fonts, { text: kicker, role: "body", weight: 600, size: kickerSize, color: accent, anchor: 0.5, align: "center", letterSpacing: Math.max(2, kickerSize * 0.18) });
    kickerText.position.set(cx, kickerCy + 12);
    kickerText.alpha = 0;
    root.addChild(kickerText);
    timeline
      .to(kickerText, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.45, ease: outQuad })
      .to(kickerText, { prop: "y", from: kickerCy + 12, to: kickerCy, start: 0.2, duration: 0.55, ease: outExpo });
    y += kickerSize + gapKT;
  }

  // Title.
  const titleCy = y + titleSize / 2;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, titleCy + 16);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.4, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleCy + 16, to: titleCy, start: 0.4, duration: 0.65, ease: outExpo });
  y += titleSize;

  // Rule.
  if (showRule) {
    y += gapTR;
    const ruleCy = y + ruleH / 2;
    const rule = new Graphics().roundRect(-ruleW / 2, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(cx, ruleCy);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.68, duration: 0.55, ease: outQuint });
    y += ruleH;
  }

  // Subtitle.
  if (hasSub) {
    y += showRule ? gapRS : gapTS;
    const subCy = y + subSize / 2;
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 1 });
    subText.position.set(cx, subCy + 12);
    subText.alpha = 0;
    root.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.8, start: 0.9, duration: 0.5, ease: outQuad })
      .to(subText, { prop: "y", from: subCy + 12, to: subCy, start: 0.9, duration: 0.55, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const titleCard: TemplateDefinition = {
  id: "title-card",
  name: "Title Card",
  tagline: "A cinematic title card: kicker, big title, and a thin accent rule.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.7,
  fontRoles: { kicker: "body", title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "kicker", type: "text", label: "Kicker", default: "Episode One", maxLength: 24, optional: true, shrinkToFit: true },
    { key: "title", type: "text", label: "Title", default: "The Beginning", maxLength: 28, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "a story in motion", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showRule", type: "toggle", label: "Accent rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
