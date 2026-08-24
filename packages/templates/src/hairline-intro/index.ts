import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  inOutCubic,
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

/**
 * Largest size <= size at which `text` fits maxWidth on one line. `tracking` is
 * letter-spacing as a fraction of the font size, so the shrink stays exact.
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

const TITLE_TRACK = -0.012;
const SUB_TRACK = 0.1;

// One hairline draws across the middle, then unfolds into a thin architectural
// frame with the title fading up inside it. Everything is line-weight and air —
// the only solid mark is the tiny accent tick on the top edge.
const PALETTES: Palette[] = [
  { id: "bone", name: "Bone", colors: { background: "#FAF9F6", textColor: "#1A1C20", accent: "#C2603A", lineColor: "#1A1C20" } },
  { id: "slate", name: "Slate", colors: { background: "#EFF2F5", textColor: "#131A22", accent: "#3B6EF0", lineColor: "#131A22" } },
  { id: "olive", name: "Olive", colors: { background: "#F7F7F1", textColor: "#1D2113", accent: "#6B8F3A", lineColor: "#1D2113" } },
  { id: "ink", name: "Ink", colors: { background: "#101216", textColor: "#F3F5F8", accent: "#E8B24A", lineColor: "#F3F5F8" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.076 : aspect === "9:16" ? 0.1 : 0.09;
}

function frameFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.62;
    case "1:1":
      return 0.86;
    case "4:5":
      return 0.88;
    case "9:16":
      return 0.98;
  }
}

const DRAW_START = 0.15;
const DRAW_DUR = 0.8;
// Overlaps the draw's tail so the line never comes to a dead stop before it opens.
const OPEN_START = 0.85;
const OPEN_DUR = 1.0;
const DURATION = 4.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FAF9F6"));
  const textColor = str(values.textColor, pc("textColor", "#1A1C20"));
  const accent = str(values.accent, pc("accent", "#C2603A"));
  const lineColor = pc("lineColor", textColor);
  const title = str(values.title, "Hairline");
  // Optional: an empty string from the editor must stay empty, not fall back.
  const subtitle = str(values.subtitle, "");
  const showTick = on(values.showTick);
  const showInnerRule = on(values.showInnerRule);

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const zone = safeRect(ctx.aspect);
  const cy = zone.y + zone.height * 0.5;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Type block (measured first: the frame is sized around it) -----------
  const frameW = Math.min(zone.width, zone.width * frameFrac(ctx.aspect));
  const padX = minDim * 0.085;
  const padY = minDim * 0.09;
  const maxW = frameW - padX * 2;

  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), maxW, TITLE_TRACK);
  const hasSub = subtitle.length > 0;
  const subSize = fitSize(fonts, subtitle, "body", 500, Math.round(titleSize * 0.27), maxW * 0.92, SUB_TRACK);
  const ruleH = Math.max(2, minDim * 0.004);
  // Clears the descenders of the centred title box (~0.6em below its centre).
  const ruleGap = titleSize * 0.4;
  const subGap = subSize * 1.1;

  const blockH =
    titleSize + (showInnerRule ? ruleGap * 2 + ruleH : 0) + (hasSub ? subGap + subSize : 0);
  const frameH = Math.max(minDim * 0.26, Math.min(zone.height * 0.86, blockH + padY * 2));

  const lineW = Math.max(2, minDim * 0.0035);
  const halfW = frameW / 2;
  const halfH = frameH / 2;

  // --- The frame: two horizontal rules that start stacked in the middle -----
  const makeEdge = (): Container => {
    const c = new Container();
    c.position.set(cx, cy);
    root.addChild(c);
    return c;
  };

  const topEdge = makeEdge();
  topEdge.addChild(
    new Graphics().rect(-halfW, -lineW / 2, frameW, lineW).fill({ color: lineColor, alpha: 0.7 }),
  );
  topEdge.scale.x = 0;

  const bottomEdge = makeEdge();
  bottomEdge.addChild(
    new Graphics().rect(-halfW, -lineW / 2, frameW, lineW).fill({ color: lineColor, alpha: 0.7 }),
  );
  bottomEdge.scale.x = 0;

  // Verticals grow from their own centres in lockstep with the separation, so
  // the four corners meet exactly at every frame of the opening.
  const sideEdges = [-halfW, halfW].map((ox) => {
    const c = new Container();
    c.position.set(cx + ox, cy);
    c.addChild(
      new Graphics().rect(-lineW / 2, -halfH, lineW, frameH).fill({ color: lineColor, alpha: 0.7 }),
    );
    c.scale.y = 0;
    root.addChild(c);
    return c;
  });

  for (const edge of [topEdge, bottomEdge]) {
    timeline.to(edge, { prop: "scale.x", from: 0, to: 1, start: DRAW_START, duration: DRAW_DUR, ease: outExpo });
  }
  timeline
    .to(topEdge, { prop: "y", from: cy, to: cy - halfH, start: OPEN_START, duration: OPEN_DUR, ease: inOutCubic })
    .to(bottomEdge, { prop: "y", from: cy, to: cy + halfH, start: OPEN_START, duration: OPEN_DUR, ease: inOutCubic });
  for (const side of sideEdges) {
    timeline.to(side, { prop: "scale.y", from: 0, to: 1, start: OPEN_START, duration: OPEN_DUR, ease: inOutCubic });
  }

  // A single accent tick riding the top edge — the one solid mark in the design.
  if (showTick) {
    const tick = new Graphics().circle(0, 0, Math.max(3, minDim * 0.009)).fill(accent);
    tick.alpha = 0;
    tick.scale.set(0.4);
    topEdge.addChild(tick);
    const tickStart = OPEN_START + OPEN_DUR + 0.2;
    timeline
      .to(tick, { prop: "alpha", from: 0, to: 1, start: tickStart, duration: 0.45, ease: outQuad })
      .to(tick, { prop: "scale.x", from: 0.4, to: 1, start: tickStart, duration: 0.6, ease: outQuint })
      .to(tick, { prop: "scale.y", from: 0.4, to: 1, start: tickStart, duration: 0.6, ease: outQuint });
  }

  // --- Type inside the frame ----------------------------------------------
  let cursor = -blockH / 2;
  const titleY = cy + cursor + titleSize / 2;
  cursor += titleSize;

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
  titleText.position.set(cx, titleY + minDim * 0.014);
  titleText.alpha = 0;
  root.addChild(titleText);

  const titleStart = OPEN_START + OPEN_DUR * 0.55;
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: titleStart, duration: 0.6, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + minDim * 0.014, to: titleY, start: titleStart, duration: 0.85, ease: outQuint });

  if (showInnerRule) {
    const ruleW = Math.min(maxW * 0.4, minDim * 0.1);
    const ruleY = cy + cursor + ruleGap + ruleH / 2;
    const rule = new Graphics().roundRect(-ruleW / 2, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(cx, ruleY);
    rule.scale.x = 0;
    root.addChild(rule);
    cursor += ruleGap * 2 + ruleH;
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: titleStart + 0.4, duration: 0.7, ease: outQuint });
  }

  if (hasSub) {
    const subY = cy + cursor + subGap + subSize / 2;
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
    s.position.set(cx, subY + minDim * 0.01);
    s.alpha = 0;
    root.addChild(s);
    const subStart = titleStart + 0.32;
    timeline
      .to(s, { prop: "alpha", from: 0, to: 0.84, start: subStart, duration: 0.6, ease: outQuad })
      .to(s, { prop: "y", from: subY + minDim * 0.01, to: subY, start: subStart, duration: 0.8, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const hairlineIntro: TemplateDefinition = {
  id: "hairline-intro",
  name: "Hairline",
  tagline: "A single hairline draws across, then opens into a thin frame around your title.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Hairline", maxLength: 28, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "a quiet opening", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showTick", type: "toggle", label: "Accent tick", default: true },
    { key: "showInnerRule", type: "toggle", label: "Inner rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
