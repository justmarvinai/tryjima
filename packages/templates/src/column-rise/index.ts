import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
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

// Slim columns glide up from below the frame in a soft left-to-right wave and
// come to rest side by side — together they are the title's backdrop panel.
// Text always sits on the panel colour, so the end frame is high-contrast.
const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#E8E5DE", panelColor: "#FFFFFF", textColor: "#15171C", accent: "#3B6EF0" } },
  { id: "sage", name: "Sage", colors: { background: "#DFE9E1", panelColor: "#FFFFFF", textColor: "#14251C", accent: "#2E9367" } },
  { id: "blush", name: "Blush", colors: { background: "#F1E2DE", panelColor: "#FFFFFF", textColor: "#2A1517", accent: "#D4564C" } },
  { id: "ink", name: "Ink", colors: { background: "#07080B", panelColor: "#1B2029", textColor: "#F4F6FA", accent: "#7DE2C3" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.076 : aspect === "9:16" ? 0.1 : 0.09;
}

function panelFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.66;
    case "1:1":
      return 0.9;
    case "4:5":
      return 0.92;
    case "9:16":
      return 0.94;
  }
}

function columnCount(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 9;
    case "1:1":
      return 7;
    case "4:5":
      return 7;
    case "9:16":
      return 6;
  }
}

const RISE_START = 0.18;
const RISE_STAGGER = 0.085;
const RISE_DUR = 1.05;
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#E8E5DE"));
  const panelColor = str(values.panelColor, pc("panelColor", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#15171C"));
  const accent = str(values.accent, pc("accent", "#3B6EF0"));
  const title = str(values.title, "Column Rise");
  // Optional: an empty string from the editor must stay empty, not fall back.
  const subtitle = str(values.subtitle, "");
  const showAccentEdge = on(values.showAccentEdge);
  const showShadow = on(values.showShadow);

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Panel geometry, sized around the type block -------------------------
  const panelW = Math.min(zone.width, zone.width * panelFrac(ctx.aspect));
  const padX = minDim * 0.085;
  const padY = minDim * 0.085;
  const maxW = panelW - padX * 2;

  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), maxW, TITLE_TRACK);
  const hasSub = subtitle.length > 0;
  const subSize = fitSize(fonts, subtitle, "body", 500, Math.round(titleSize * 0.27), maxW * 0.92, SUB_TRACK);
  const subGap = subSize * 1.2;
  const blockH = titleSize + (hasSub ? subGap + subSize : 0);
  const panelH = Math.max(minDim * 0.3, Math.min(zone.height * 0.8, blockH + padY * 2));

  const panelCy = zone.y + zone.height * 0.5;
  const panelTop = panelCy - panelH / 2;
  const panelLeft = cx - panelW / 2;
  // Near-square corners: assembled, the columns must read as one clean panel
  // with hairline seams, not a row of scalloped slats.
  const radius = Math.max(2, minDim * 0.004);

  const n = columnCount(ctx.aspect);
  const lastStart = RISE_START + (n - 1) * RISE_STAGGER;
  const lastLand = lastStart + RISE_DUR;

  // --- Soft depth under the panel (fades in as the wave settles) -----------
  if (showShadow) {
    const shadow = new Graphics();
    for (const layer of [
      { e: panelH * 0.055, o: panelH * 0.055, a: 0.045 },
      { e: panelH * 0.028, o: panelH * 0.032, a: 0.05 },
      { e: panelH * 0.01, o: panelH * 0.014, a: 0.06 },
    ]) {
      shadow
        .roundRect(
          -panelW / 2 - layer.e,
          -panelH / 2 - layer.e + layer.o,
          panelW + layer.e * 2,
          panelH + layer.e * 2,
          radius + layer.e,
        )
        .fill({ color: "#000000", alpha: layer.a });
    }
    shadow.position.set(cx, panelCy);
    shadow.alpha = 0;
    root.addChild(shadow);
    timeline.to(shadow, {
      prop: "alpha",
      from: 0,
      to: 1,
      start: lastStart + RISE_DUR * 0.45,
      duration: 0.8,
      ease: outQuad,
    });
  }

  // --- The columns ---------------------------------------------------------
  const gap = Math.max(2, minDim * 0.0035);
  const colW = (panelW - (n - 1) * gap) / n;
  const colRadius = radius;
  // Each column starts with its top edge exactly on the frame's bottom edge.
  const offBottom = h - panelTop;

  const columns = new Container();
  root.addChild(columns);

  for (let i = 0; i < n; i++) {
    const colCx = panelLeft + i * (colW + gap) + colW / 2;
    const col = new Graphics()
      .roundRect(-colW / 2, -panelH / 2, colW, panelH, colRadius)
      .fill(panelColor);
    col.label = `column-${i}`;
    col.position.set(colCx, panelCy + offBottom);
    columns.addChild(col);

    const start = RISE_START + i * RISE_STAGGER;
    timeline.to(col, {
      prop: "y",
      from: panelCy + offBottom,
      to: panelCy,
      start,
      duration: RISE_DUR,
      ease: outQuint,
    });
  }

  // --- Accent hairline along the panel's top edge --------------------------
  if (showAccentEdge) {
    const edgeH = Math.max(3, minDim * 0.005);
    const edge = new Graphics()
      .roundRect(-panelW / 2, -edgeH / 2, panelW, edgeH, edgeH / 2)
      .fill(accent);
    edge.position.set(cx, panelTop + edgeH / 2);
    edge.scale.x = 0;
    root.addChild(edge);
    timeline.to(edge, {
      prop: "scale.x",
      from: 0,
      to: 1,
      start: lastLand - RISE_DUR * 0.32,
      duration: 0.8,
      ease: outQuint,
    });
  }

  // --- Type on the settled panel ------------------------------------------
  const titleStart = lastStart + RISE_DUR * 0.62;
  let cursor = panelCy - blockH / 2;

  const titleY = cursor + titleSize / 2;
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
  titleText.position.set(cx, titleY + minDim * 0.016);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: titleStart, duration: 0.6, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + minDim * 0.016, to: titleY, start: titleStart, duration: 0.85, ease: outQuint });

  if (hasSub) {
    const subY = cursor + subGap + subSize / 2;
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
    s.position.set(cx, subY + minDim * 0.012);
    s.alpha = 0;
    root.addChild(s);
    const subStart = titleStart + 0.3;
    timeline
      .to(s, { prop: "alpha", from: 0, to: 0.84, start: subStart, duration: 0.6, ease: outQuad })
      .to(s, { prop: "y", from: subY + minDim * 0.012, to: subY, start: subStart, duration: 0.8, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const columnRise: TemplateDefinition = {
  id: "column-rise",
  name: "Column Rise",
  tagline: "Slim columns rise in a soft wave and settle into the panel behind your title.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Column Rise", maxLength: 28, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "a calm entrance", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showAccentEdge", type: "toggle", label: "Accent top edge", default: true },
    { key: "showShadow", type: "toggle", label: "Panel shadow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "panelColor", type: "color", label: "Panel", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
