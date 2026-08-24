import { Container, Graphics, Sprite, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  inOutQuad,
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

/**
 * Largest size <= size at which `text` fits maxWidth on one line. `tracking` is
 * letter-spacing expressed as a fraction of the font size, so the measurement
 * stays proportional and the shrink stays exact.
 */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
  tracking = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size,
    letterSpacing: size * tracking,
  });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// Tight tracking on the headline, airy tracking on the small caps-ish subtitle.
const TITLE_TRACK = -0.012;
const SUB_TRACK = 0.09;

// A broad, soft-edged colour field travels the frame on a shallow diagonal and
// the title is wiped in behind it — the wash *is* the reveal, so it leaves the
// lockup standing on a clean, untinted background (dark-on-light end frame).
const PALETTES: Palette[] = [
  { id: "porcelain", name: "Porcelain", colors: { background: "#FCFCFD", textColor: "#14161B", accent: "#5B8CFF", accentSoft: "#B8A6FF" } },
  { id: "dune", name: "Dune", colors: { background: "#FBF6EF", textColor: "#241A10", accent: "#C9701F", accentSoft: "#F0C177" } },
  { id: "harbor", name: "Harbor", colors: { background: "#F2F6F8", textColor: "#0F2430", accent: "#1F8FA8", accentSoft: "#7FD1DE" } },
  { id: "noir", name: "Noir", colors: { background: "#0D0F14", textColor: "#F6F7FA", accent: "#6C7BFF", accentSoft: "#C58BFF" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.078 : aspect === "9:16" ? 0.104 : 0.094;
}

// One unbroken diagonal pass: the field eases in from off-frame, crosses, and
// eases out the far side while the lockup settles. inOutQuad keeps the mid-pass
// speed gentle (a quad peaks at 2x average; a quint would peak at 5x).
const WASH_START = 0.18;
const WASH_DUR = 2.2;
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FCFCFD"));
  const textColor = str(values.textColor, pc("textColor", "#14161B"));
  const accent = str(values.accent, pc("accent", "#5B8CFF"));
  const accentSoft = pc("accentSoft", accent);
  const title = str(values.title, "New Season");
  // Optional: an empty string from the editor must stay empty, not fall back.
  const subtitle = str(values.subtitle, "");
  const showRule = on(values.showRule);
  const showTint = on(values.showTint);

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const maxDim = Math.max(w, h);
  const zone = safeRect(ctx.aspect);
  const centerY = zone.y + zone.height * 0.5;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- The lockup (kicker rule + title + subtitle) --------------------------
  const maxW = zone.width * (ctx.aspect === "16:9" ? 0.66 : 0.88);
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), maxW, TITLE_TRACK);
  const hasSub = subtitle.length > 0;
  const subSize = fitSize(fonts, subtitle, "body", 500, Math.round(titleSize * 0.28), maxW * 0.9, SUB_TRACK);
  const ruleH = Math.max(2, minDim * 0.0045);
  const ruleW = Math.min(maxW * 0.5, minDim * 0.13);
  const ruleGap = titleSize * 0.42;
  const subGap = subSize * 1.35;

  const blockH =
    (showRule ? ruleH + ruleGap : 0) + titleSize + (hasSub ? subGap + subSize : 0);
  let cursor = -blockH / 2;

  const content = new Container();
  content.label = "content";
  content.position.set(cx, centerY);
  root.addChild(content);

  if (showRule) {
    const rule = new Graphics().roundRect(-ruleW / 2, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(0, cursor + ruleH / 2);
    content.addChild(rule);
    cursor += ruleH + ruleGap;
  }

  const titleY = cursor + titleSize / 2;
  const titleText = makeText(fonts, {
    text: title,
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
    letterSpacing: titleSize * TITLE_TRACK,
  });
  titleText.position.set(0, titleY);
  content.addChild(titleText);
  cursor += titleSize;

  let subText: Text | null = null;
  let subY = 0;
  if (hasSub) {
    subY = cursor + subGap + subSize / 2;
    const s = makeText(fonts, {
      text: subtitle,
      role: "body",
      weight: 500,
      size: subSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: subSize * SUB_TRACK,
    });
    s.position.set(0, subY + minDim * 0.012);
    s.alpha = 0;
    content.addChild(s);
    subText = s;
  }

  // --- Sweep axis: everything travels along +x of a rotated frame ----------
  const dir = -0.3;
  const cosD = Math.abs(Math.cos(dir));
  const sinD = Math.abs(Math.sin(dir));
  const halfSpan = (w * cosD + h * sinD) / 2;
  const washW = maxDim * 0.52;
  const washL = (w + h) * 1.15;
  const travelFrom = -(halfSpan + washW * 0.5);
  const travelTo = halfSpan + washW * 0.5;

  // The reveal edge starts well behind the field's core so the title always
  // emerges in the wash's wake, never ahead of it.
  const lag = -washW * 0.28;

  // The reveal only has to cross the lockup, not the whole frame — so it runs
  // slower than the wash and the wipe across the headline stays unhurried.
  const titleW = fonts.measure(title, {
    family: fonts.family("display"),
    weight: 700,
    size: titleSize,
    letterSpacing: titleSize * TITLE_TRACK,
  });
  const subW = hasSub
    ? fonts.measure(subtitle, {
        family: fonts.family("body"),
        weight: 500,
        size: subSize,
        letterSpacing: subSize * SUB_TRACK,
      })
    : 0;
  const contentHalfAxis =
    (Math.max(titleW, subW, ruleW) * cosD + blockH * sinD) / 2 + minDim * 0.06;

  const maskAxis = new Container();
  maskAxis.position.set(cx, centerY);
  maskAxis.rotation = dir;
  root.addChild(maskAxis);

  const big = (w + h) * 2;
  const maskFrom = travelFrom + lag;
  const maskTo = contentHalfAxis;
  const maskG = new Graphics().rect(-big, -big / 2, big, big).fill("#FFFFFF");
  maskG.x = maskFrom;
  maskAxis.addChild(maskG);
  content.mask = maskG;

  timeline.to(maskG, {
    prop: "x",
    from: maskFrom,
    to: maskTo,
    start: WASH_START,
    duration: WASH_DUR,
    ease: inOutQuad,
  });

  // A gentle rise as the wake clears — the lockup settles rather than lands.
  timeline.to(content, {
    prop: "y",
    from: centerY + minDim * 0.014,
    to: centerY,
    start: WASH_START + WASH_DUR * 0.45,
    duration: 1.1,
    ease: outQuint,
  });

  // --- The wash itself: soft-edged tinted fields, no hard edge anywhere ----
  const washAxis = new Container();
  washAxis.position.set(cx, centerY);
  washAxis.rotation = dir;
  root.addChild(washAxis);

  const wash = new Container();
  wash.x = travelFrom;
  wash.alpha = 0;
  washAxis.addChild(wash);

  const core = new Sprite(radialGlowTexture());
  core.anchor.set(0.5);
  core.tint = accent;
  core.width = washW;
  core.height = washL;
  core.alpha = 0.62;
  wash.addChild(core);

  if (showTint) {
    const trail = new Sprite(radialGlowTexture());
    trail.anchor.set(0.5);
    trail.tint = accentSoft;
    trail.width = washW * 0.72;
    trail.height = washL * 0.92;
    trail.x = -washW * 0.24;
    trail.alpha = 0.5;
    wash.addChild(trail);
  }

  timeline
    .to(wash, { prop: "x", from: travelFrom, to: travelTo, start: WASH_START, duration: WASH_DUR, ease: inOutQuad })
    .to(wash, { prop: "alpha", from: 0, to: 1, start: WASH_START, duration: 0.45, ease: outQuad })
    .to(wash, { prop: "alpha", from: 1, to: 0, start: WASH_START + WASH_DUR * 0.72, duration: WASH_DUR * 0.34, ease: inOutQuad });

  if (subText) {
    const s = subText;
    const subStart = WASH_START + WASH_DUR * 0.76;
    timeline
      .to(s, { prop: "alpha", from: 0, to: 0.86, start: subStart, duration: 0.55, ease: outQuad })
      .to(s, { prop: "y", from: subY + minDim * 0.012, to: subY, start: subStart, duration: 0.7, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const gradientWash: TemplateDefinition = {
  id: "gradient-wash",
  name: "Gradient Wash",
  tagline: "A soft colour field washes across the frame and leaves your title behind it.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "New Season", maxLength: 28, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "starts here", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showRule", type: "toggle", label: "Kicker rule", default: true },
    { key: "showTint", type: "toggle", label: "Second wash tint", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
