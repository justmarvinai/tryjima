import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  fitBox,
  outQuad,
  outExpo,
  inOutQuad,
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
import { avatar } from "../shared/ui";
import { radialGlowTexture } from "../shared/glow";

// Quote Reel — a 9:16-first quote card. Each line rides up behind its own mask
// on a long expo curve, one after another, so the quotation writes itself
// upward; the attribution fades in beneath. Two slow gradient blooms drift
// across the whole take so nothing is ever completely static.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
const inkOn = (hex: string): string => (luminance(hex) < 0.56 ? "#FFFFFF" : "#14161B");

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(10, Math.floor((size0 * maxWidth) / w)) : size0;
}

/** A geometric quotation mark: two commas — a ball with a tail hooking down-left. */
function quoteMark(s: number, color: string): Graphics {
  const g = new Graphics();
  const r = s * 0.3;
  for (const ox of [0, s * 0.95]) {
    const mx = ox + r * 1.55;
    const my = r;
    g.circle(mx, my, r).fill(color);
    g.poly([mx - r, my - r * 0.12, mx + r * 0.6, my + r * 0.32, mx - r * 1.55, my + r * 2.15]).fill(color);
  }
  return g;
}

const PALETTES: Palette[] = [
  { id: "porcelain", name: "Porcelain", colors: { background: "#FBFAF9", textColor: "#16181D", accent: "#1F6F5C", glowA: "#CFE3DA", glowB: "#F1E3D3", avatarBg: "#2B3038" } },
  { id: "mist", name: "Mist", colors: { background: "#EEF1F6", textColor: "#101722", accent: "#2A55A5", glowA: "#D3DEF2", glowB: "#E6DCF0", avatarBg: "#1E2A3D" } },
  { id: "sand", name: "Sand", colors: { background: "#F7F2EA", textColor: "#241D15", accent: "#9C4D1C", glowA: "#F0DFCB", glowB: "#E4E7DA", avatarBg: "#3A2E23" } },
  { id: "ink", name: "Ink", colors: { background: "#0C0E12", textColor: "#F3F5F8", accent: "#86D3B6", glowA: "#1D3A33", glowB: "#2A2438", avatarBg: "#39414E" } },
];

/** Quote size as a fraction of the short edge — big and tall-first. */
function quoteFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.062;
    case "1:1":
      return 0.078;
    case "4:5":
      return 0.086;
    case "9:16":
      return 0.094;
  }
}

const MARK_AT = 0.12;
const LINE_AT = 0.42;
const LINE_STAGGER = 0.14;
const RULE_AT = 1.95;
const ATTR_AT = 2.2;
const ATTR_STAGGER = 0.1;
const DURATION = 4.6;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FBFAF9"));
  const textColor = str(values.textColor, pc("textColor", "#16181D"));
  const accent = str(values.accent, pc("accent", "#1F6F5C"));
  const glowA = pc("glowA", "#CFE3DA");
  const glowB = pc("glowB", "#F1E3D3");
  const avatarBg = pc("avatarBg", "#2B3038");

  const quote = str(values.quote, "We stopped chasing the algorithm and started making things worth stopping for.");
  const author = str(values.author, "Mara Ellis");
  const role = str(values.role, "Creative director, Northlight");
  const quoteRole: FontRole = str(values.fontRole, "display") === "serif" ? "serif" : "display";
  const showMark = on(values.showMark);
  const showRule = on(values.showRule);
  const showGlow = on(values.showGlow);
  const showAvatar = on(values.showAvatar);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Soft gradient blooms, drifting for the whole take ---
  if (showGlow) {
    const blooms: { color: string; s: number; x: number; y: number; dx: number; dy: number }[] = [
      { color: glowA, s: minDim * 1.55, x: w * 0.16, y: h * 0.2, dx: minDim * 0.035, dy: 0 },
      { color: glowB, s: minDim * 1.25, x: w * 0.86, y: h * 0.82, dx: 0, dy: -minDim * 0.03 },
    ];
    blooms.forEach((b) => {
      const wrap = new Container();
      const sp = new Sprite(radialGlowTexture());
      sp.anchor.set(0.5);
      sp.width = b.s;
      sp.height = b.s;
      sp.tint = b.color;
      wrap.addChild(sp);
      wrap.position.set(b.x, b.y);
      wrap.alpha = 0;
      wrap.scale.set(0.88);
      root.addChild(wrap);
      timeline
        .to(wrap, { prop: "alpha", from: 0, to: 0.72, start: 0, duration: 1.3, ease: outQuad })
        .to(wrap, { prop: "scale.x", from: 0.88, to: 1, start: 0, duration: 1.9, ease: outExpo })
        .to(wrap, { prop: "scale.y", from: 0.88, to: 1, start: 0, duration: 1.9, ease: outExpo });
      if (b.dx !== 0) {
        timeline.to(wrap, { prop: "x", from: b.x - b.dx, to: b.x + b.dx, start: 0, duration: DURATION, ease: inOutQuad });
      }
      if (b.dy !== 0) {
        timeline.to(wrap, { prop: "y", from: b.y - b.dy, to: b.y + b.dy, start: 0, duration: DURATION, ease: inOutQuad });
      }
    });
  }

  // --- Column + quote metrics ---
  const colW = Math.min(safe.width * 0.94, minDim * 1.15);
  const left = cx - colW / 2;
  const size0 = Math.round(minDim * quoteFrac(ctx.aspect));
  const familyQuote = fonts.family(quoteRole);
  const measure = (s: string, sz: number): number => fonts.measure(s, { family: familyQuote, weight: 600, size: sz });
  const { fontSize, lines } = fitBox(quote, measure, {
    maxWidth: colW,
    baseSize: size0,
    minSize: Math.round(size0 * 0.52),
    maxLines: ctx.aspect === "16:9" ? 4 : 5,
  });
  const lineH = Math.round(fontSize * 1.26);

  const markS = size0 * 0.66;
  const markH = markS * 0.95;
  const gapMark = size0 * 0.42;
  const quoteH = lines.length * lineH;
  const gapRule = size0 * 0.62;
  const ruleH = Math.max(2, minDim * 0.0025);
  const gapAttr = size0 * (showRule ? 0.52 : 0.74);
  const avatarR = minDim * 0.038;
  const attrH = avatarR * 2;

  const totalH =
    (showMark ? markH + gapMark : 0) +
    quoteH +
    (showRule ? gapRule + ruleH : 0) +
    gapAttr +
    attrH;
  let y = Math.max(safe.y, safe.y + (safe.height - totalH) / 2);

  // --- Decorative quotation mark ---
  if (showMark) {
    const mark = quoteMark(markS, accent);
    mark.position.set(left, y);
    mark.alpha = 0;
    root.addChild(mark);
    timeline
      .to(mark, { prop: "alpha", from: 0, to: 0.28, start: MARK_AT, duration: 0.85, ease: outQuad })
      .to(mark, { prop: "y", from: y + markS * 0.22, to: y, start: MARK_AT, duration: 1.1, ease: outExpo });
    y += markH + gapMark;
  }

  // --- Quote lines, each rising behind its own mask ---
  const quoteTop = y;
  lines.forEach((ln, i) => {
    const lineTop = quoteTop + i * lineH;
    const holder = new Container();
    root.addChild(holder);
    const t = makeText(fonts, {
      text: ln,
      role: quoteRole,
      weight: 600,
      size: fontSize,
      color: textColor,
      anchor: { x: 0, y: 0 },
      lineHeight: lineH,
      letterSpacing: -fontSize * 0.012,
    });
    t.position.set(left, lineTop);
    holder.addChild(t);
    const clip = new Graphics().rect(left - fontSize, lineTop, colW + fontSize * 2, lineH).fill(0xffffff);
    holder.addChild(clip);
    t.mask = clip;
    const start = LINE_AT + i * LINE_STAGGER;
    timeline.to(t, { prop: "y", from: lineTop + lineH * 1.02, to: lineTop, start, duration: 1.05, ease: outExpo });
  });
  y += quoteH;

  // --- Hairline rule ---
  if (showRule) {
    y += gapRule;
    const ruleW = colW * 0.24;
    const rule = new Graphics().rect(0, 0, ruleW, ruleH).fill(accent);
    rule.position.set(left, y);
    rule.scale.x = 0;
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: RULE_AT, duration: 1.0, ease: inOutCubic });
    y += ruleH;
  }

  // --- Attribution row ---
  y += gapAttr;
  const attrCy = y + attrH / 2;
  let textX = left;
  if (showAvatar) {
    const initial = author.trim().charAt(0).toUpperCase() || "?";
    const av = avatar(fonts, {
      radius: avatarR,
      bg: avatarBg,
      initial,
      textColor: inkOn(avatarBg),
    });
    av.position.set(left + avatarR, attrCy);
    av.alpha = 0;
    root.addChild(av);
    timeline
      .to(av, { prop: "alpha", from: 0, to: 1, start: ATTR_AT, duration: 0.6, ease: outQuad })
      .to(av, { prop: "y", from: attrCy + avatarR * 0.35, to: attrCy, start: ATTR_AT, duration: 0.95, ease: outExpo });
    textX = left + avatarR * 2 + minDim * 0.024;
  }

  const attrMaxW = colW - (textX - left);
  const hasRole = role.length > 0;
  const nameSize = fitSize(fonts, author, "display", 700, Math.round(minDim * 0.036), attrMaxW);
  const nameY = hasRole ? attrCy - minDim * 0.019 : attrCy;
  const nameText = makeText(fonts, { text: author, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  nameText.position.set(textX, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: ATTR_AT + ATTR_STAGGER, duration: 0.6, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + minDim * 0.014, to: nameY, start: ATTR_AT + ATTR_STAGGER, duration: 0.95, ease: outExpo });

  if (hasRole) {
    const roleSize = fitSize(fonts, role, "body", 500, Math.round(minDim * 0.027), attrMaxW);
    const roleY = attrCy + minDim * 0.021;
    const roleText = makeText(fonts, { text: role, role: "body", weight: 500, size: roleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    roleText.position.set(textX, roleY);
    roleText.alpha = 0;
    root.addChild(roleText);
    timeline
      .to(roleText, { prop: "alpha", from: 0, to: 0.68, start: ATTR_AT + ATTR_STAGGER * 2, duration: 0.6, ease: outQuad })
      .to(roleText, { prop: "y", from: roleY + minDim * 0.012, to: roleY, start: ATTR_AT + ATTR_STAGGER * 2, duration: 0.95, ease: outExpo });
  }

  return { timeline, duration: DURATION };
}

export const quoteReel: TemplateDefinition = {
  id: "quote-reel",
  name: "Quote Reel",
  tagline: "A quotation rises line by line behind a soft mask, then the attribution settles in.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.8,
  fontRoles: { quote: "display", author: "display", role: "body" },
  palettes: PALETTES,
  fields: [
    {
      key: "quote",
      type: "textarea",
      label: "Quote",
      default: "We stopped chasing the algorithm and started making things worth stopping for.",
      maxLength: 160,
      maxLines: 5,
    },
    { key: "author", type: "text", label: "Author", default: "Mara Ellis", maxLength: 28, shrinkToFit: true },
    { key: "role", type: "text", label: "Role", default: "Creative director, Northlight", maxLength: 36, shrinkToFit: true },
    {
      key: "fontRole",
      type: "select",
      label: "Quote type",
      default: "display",
      options: [
        { value: "display", label: "Sans (modern)" },
        { value: "serif", label: "Serif (editorial)" },
      ],
    },
    { key: "showMark", type: "toggle", label: "Quotation mark", default: true },
    { key: "showRule", type: "toggle", label: "Accent rule", default: true },
    { key: "showAvatar", type: "toggle", label: "Author avatar", default: true },
    { key: "showGlow", type: "toggle", label: "Gradient backdrop", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
