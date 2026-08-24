import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outBack,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Vertical Type — the headline runs *down* the frame, one glyph per row, in the
// manner of a poster spine or a shopfront blade sign. A rule descends alongside
// it and the letters drop in behind the rule's leading edge. Every other text
// template in the library runs horizontally.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "bone", name: "Bone", colors: { background: "#F3F0E9", textColor: "#16150F", accent: "#A63D2F" } },
  { id: "ink", name: "Ink", colors: { background: "#0E0F12", textColor: "#F3F2EE", accent: "#E4B33C" } },
  { id: "indigo", name: "Indigo", colors: { background: "#EBEDF7", textColor: "#141A33", accent: "#3A45B0" } },
  { id: "forest", name: "Forest", colors: { background: "#E9F0EA", textColor: "#101C13", accent: "#22684A" } },
];

interface Layout {
  glyphFrac: number;
  columnFrac: number;
  topFrac: number;
  heightFrac: number;
  sideFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { glyphFrac: 0.075, columnFrac: 0.24, topFrac: 0.12, heightFrac: 0.76, sideFrac: 0.033 };
    case "9:16":
      return { glyphFrac: 0.115, columnFrac: 0.3, topFrac: 0.11, heightFrac: 0.72, sideFrac: 0.04 };
    case "4:5":
      return { glyphFrac: 0.1, columnFrac: 0.28, topFrac: 0.11, heightFrac: 0.74, sideFrac: 0.038 };
    case "1:1":
    default:
      return { glyphFrac: 0.095, columnFrac: 0.27, topFrac: 0.12, heightFrac: 0.74, sideFrac: 0.036 };
  }
}

const DROP_START = 0.4;
const PER_GLYPH = 0.075;
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F3F0E9"));
  const textColor = str(values.textColor, pc("textColor", "#16150F"));
  const accent = str(values.accent, pc("accent", "#A63D2F"));
  const headline = str(values.headline, "OPEN").toUpperCase().replace(/\s+/g, " ").trim();
  const sideText = str(values.sideText, "").trim();
  const align = str(values.align, "center");
  const showRule = on(values.showRule);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const glyphs = [...headline];

  const colX =
    align === "left" ? size.width * L.columnFrac : align === "right" ? size.width * (1 - L.columnFrac) : size.width / 2;

  const top = size.height * L.topFrac;
  const avail = size.height * L.heightFrac;
  // Row pitch is whatever fits the column height; the glyph size follows it, so
  // a long word simply sets smaller rather than running off the bottom.
  const rows = Math.max(glyphs.length, 1);
  const pitch = Math.min(avail / rows, size.width * L.glyphFrac * 1.22);
  const fontSize = Math.round(pitch * 0.82);
  const blockH = pitch * rows;
  const startY = top + (avail - blockH) / 2;

  const timeline = new JimaTimeline();

  // The rule descends first and the glyphs land behind its leading edge.
  const ruleW = Math.max(3, Math.round(size.width * 0.0038));
  const ruleX = colX + (align === "right" ? -pitch * 0.85 : pitch * 0.85);
  if (showRule) {
    const rule = new Graphics().rect(-ruleW / 2, 0, ruleW, blockH).fill(accent);
    rule.position.set(ruleX, startY);
    rule.scale.y = 0;
    root.addChild(rule);
    timeline.to(rule, {
      prop: "scale.y",
      from: 0,
      to: 1,
      start: DROP_START * 0.5,
      duration: DROP_START + PER_GLYPH * rows + 0.35,
      ease: outExpo,
    });
  }

  glyphs.forEach((ch, i) => {
    if (ch === " ") return;
    const y = startY + pitch * (i + 0.5);
    const holder = new Container();
    holder.position.set(colX, y);
    root.addChild(holder);
    const t = makeText(fonts, {
      text: ch,
      role: "display",
      weight: 800,
      size: fontSize,
      color: textColor,
      anchor: 0.5,
    });
    holder.addChild(t);

    const at = DROP_START + i * PER_GLYPH;
    holder.alpha = 0;
    timeline
      .to(holder, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.3, ease: outQuad })
      .to(holder, { prop: "y", from: y - pitch * 0.7, to: y, start: at, duration: 0.6, ease: outExpo })
      .to(holder, { prop: "scale.x", from: 1.25, to: 1, start: at, duration: 0.55, ease: outBack })
      .to(holder, { prop: "scale.y", from: 0.72, to: 1, start: at, duration: 0.55, ease: outBack });
  });

  // A small rotated line up the opposite side, like a spine credit.
  if (sideText.length > 0) {
    const sideSize = Math.round(size.width * L.sideFrac * 0.62);
    const side = makeText(fonts, {
      text: sideText.toUpperCase(),
      role: "body",
      weight: 600,
      size: sideSize,
      color: textColor,
      anchor: 0.5,
      letterSpacing: sideSize * 0.16,
    });
    const sideX = align === "right" ? size.width * 0.12 : size.width * 0.88;
    side.position.set(sideX, size.height * 0.5);
    side.rotation = align === "right" ? Math.PI / 2 : -Math.PI / 2;
    side.alpha = 0;
    root.addChild(side);
    timeline
      .to(side, { prop: "alpha", from: 0, to: 0.6, start: DROP_START + PER_GLYPH * rows + 0.2, duration: 0.7, ease: outQuad })
      .to(side, {
        prop: "y",
        from: size.height * 0.53,
        to: size.height * 0.5,
        start: DROP_START + PER_GLYPH * rows + 0.2,
        duration: 0.9,
        ease: outQuint,
      });
  }

  return { timeline, duration: DURATION };
}

export const verticalType: TemplateDefinition = {
  id: "vertical-type",
  name: "Vertical Type",
  tagline: "The headline runs down the frame, one letter per row, like a blade sign.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { headline: "display", sideText: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Open late", maxLength: 14 },
    { key: "sideText", type: "text", label: "Side note", default: "Since 2014", maxLength: 26, optional: true },
    {
      key: "align",
      type: "select",
      label: "Column",
      default: "center",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Centre" },
        { value: "right", label: "Right" },
      ],
    },
    { key: "showRule", type: "toggle", label: "Descending rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
