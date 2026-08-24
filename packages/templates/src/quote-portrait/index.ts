import { Container, Graphics, Sprite, type Text, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  inOutQuad,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords, type WordBox } from "../shared/words";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);
const smooth = (u: number): number => u * u * (3 - 2 * u);

/** Largest size <= size0 at which `text` fits maxWidth (crisp, single-line). */
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
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

const lineCount = (boxes: readonly WordBox[]): number =>
  boxes.reduce((m, b) => Math.max(m, b.line + 1), 0);

// One travelling wavefront reveals everything: it opens the portrait frame,
// carries a soft light across the frame and lifts the quote in behind it, so
// the face and the words arrive as a single gesture. Not a player frame
// (video-testimonial) and not a deck of review cards (review-stack).
const PALETTES: Palette[] = [
  {
    id: "linen",
    name: "Linen",
    colors: { background: "#F7F5F1", textColor: "#17191D", accent: "#8A5A2B", panelBg: "#E7E2D9", silhouette: "#BBB2A4", sweep: "#C89B63", muted: "#6B6560" },
  },
  {
    id: "ink",
    name: "Ink",
    colors: { background: "#0C0E13", textColor: "#F3F5F9", accent: "#9BB4FF", panelBg: "#171B24", silhouette: "#39414F", sweep: "#9BB4FF", muted: "#A2AAB8" },
  },
  {
    id: "cloud",
    name: "Cloud",
    colors: { background: "#FFFFFF", textColor: "#101418", accent: "#1F6FEB", panelBg: "#E9EEF5", silhouette: "#B7C2D0", sweep: "#7FB0FF", muted: "#5B6672" },
  },
  {
    id: "rose",
    name: "Rose",
    colors: { background: "#FDF2F1", textColor: "#2B1214", accent: "#B3335A", panelBg: "#F3DEDC", silhouette: "#D0ADAC", sweep: "#E58AA5", muted: "#7A5A5C" },
  },
];

const SWEEP_START = 0.12;
const SWEEP_DUR = 1.6;
const DURATION = 4.6;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F7F5F1"));
  const textColor = str(values.textColor, pc("textColor", "#17191D"));
  const accent = str(values.accent, pc("accent", "#8A5A2B"));
  const panelBg = str(values.panelBg, pc("panelBg", "#E7E2D9"));
  const silhouette = pc("silhouette", "#BBB2A4");
  const sweepColor = pc("sweep", "#C89B63");
  const muted = pc("muted", "#6B6560");

  const quote = str(values.quote, "They shipped in a week what we had been circling for a year.");
  const name = str(values.name, "Mara Ellis");
  const role = str(values.role, "Head of Brand, Fielder");
  const showQuoteMark = values.showQuoteMark !== false;
  const showRule = values.showRule !== false;
  const showSweep = values.showSweep !== false;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const zone = safeRect(ctx.aspect);
  const side = ctx.aspect === "16:9";

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const panelW = side ? zone.width * 0.3 : Math.min(zone.width * 0.5, zone.height * 0.34);
  const panelH = side ? zone.height * 0.92 : panelW * 1.24;
  const panelX = side ? zone.x : cx - panelW / 2;
  const radius = Math.min(panelW, panelH) * 0.085;

  const gapX = minDim * 0.075;
  const quoteMaxW = side ? zone.x + zone.width - (panelX + panelW + gapX) : zone.width * 0.86;
  const quoteAnchorX = side ? panelX + panelW + gapX : cx;
  const align: "left" | "center" = side ? "left" : "center";

  // --- Quote type: shrink until it fits the line budget ---
  const maxLines = side ? 5 : 4;
  const baseQ = Math.round(minDim * (side ? 0.05 : 0.053));
  const minQ = Math.round(baseQ * 0.55);
  const layoutAt = (fontSize: number): WordBox[] =>
    layoutWords(quote, fonts, {
      role: "serif",
      weight: 400,
      fontSize,
      lineHeight: fontSize * 1.36,
      maxWidth: quoteMaxW,
      align,
      anchorX: 0,
      centerY: 0,
    });
  let qSize = baseQ;
  let boxes = layoutAt(qSize);
  while (qSize > minQ && lineCount(boxes) > maxLines) {
    qSize -= 2;
    boxes = layoutAt(qSize);
  }
  const quoteLineH = qSize * 1.36;
  const quoteH = Math.max(1, lineCount(boxes)) * quoteLineH;

  const markSize = Math.round(minDim * 0.1);
  const markRowH = showQuoteMark ? markSize * 0.5 : 0;
  const gapMarkQuote = showQuoteMark ? minDim * 0.02 : 0;

  const nameSize = fitSize(fonts, name, "display", 600, Math.round(minDim * 0.034), quoteMaxW * 0.9);
  const roleSize = fitSize(fonts, role, "body", 400, Math.round(minDim * 0.025), quoteMaxW * 0.9);
  const ruleH = Math.max(2, Math.round(minDim * 0.0022));
  const gapQuoteRule = minDim * 0.055;
  const gapRuleName = minDim * 0.038;
  const nameBlockH = nameSize * 1.15 + roleSize * 1.7;

  const textColH = markRowH + gapMarkQuote + quoteH + gapQuoteRule + ruleH + gapRuleName + nameBlockH;

  const gapPanelQuote = minDim * 0.055;
  const blockH = side ? panelH : panelH + gapPanelQuote + textColH;
  const blockTop = Math.max(zone.y, zone.y + zone.height / 2 - blockH / 2);
  const panelY = side ? zone.y + (zone.height - panelH) / 2 : blockTop;

  const textTop = side ? panelY + (panelH - textColH) / 2 : blockTop + panelH + gapPanelQuote;
  const markCy = textTop + markRowH / 2;
  const quoteCy = textTop + markRowH + gapMarkQuote + quoteH / 2;
  const ruleY = textTop + markRowH + gapMarkQuote + quoteH + gapQuoteRule + ruleH / 2;
  const nameY = ruleY + gapRuleName + nameSize * 0.6;
  const roleY = nameY + nameSize * 0.62 + roleSize * 0.75;

  // --- The wavefront ---
  const feather = zone.width * 0.16;
  const frontFrom = zone.x - feather * 0.4;
  const frontTo = zone.x + zone.width + feather * 0.75;

  // --- Portrait: image or a drawn stand-in, opened by the wavefront ---
  const portrait = new Container();
  portrait.position.set(panelX + panelW / 2, panelY + panelH / 2);
  root.addChild(portrait);

  const inner = new Container();
  portrait.addChild(inner);
  inner.addChild(new Graphics().roundRect(-panelW / 2, -panelH / 2, panelW, panelH, radius).fill(panelBg));

  const tex: Texture | null = images.image ?? null;
  if (tex) {
    const photo = new Sprite(tex);
    photo.anchor.set(0.5);
    photo.scale.set(Math.max(panelW / tex.width, panelH / tex.height));
    inner.addChild(photo);
  } else {
    const glow = new Sprite(radialGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = accent;
    glow.width = panelW * 1.5;
    glow.height = panelW * 1.5;
    glow.alpha = 0.16;
    glow.position.set(0, -panelH * 0.18);
    inner.addChild(glow);
    // A calm bust: head and shoulders sized off the panel, the shoulder arc
    // running out past the frame so it reads as a cropped portrait.
    const headR = panelW * 0.19;
    const shoulderR = panelW * 0.58;
    const headCy = -panelH * 0.1;
    const figure = new Graphics()
      .circle(0, headCy, headR)
      .fill(silhouette)
      .circle(0, headCy + headR * 0.65 + shoulderR, shoulderR)
      .fill(silhouette);
    inner.addChild(figure);
  }
  timeline
    .to(inner, { prop: "scale.x", from: 1.07, to: 1, start: SWEEP_START, duration: 2.5, ease: outExpo })
    .to(inner, { prop: "scale.y", from: 1.07, to: 1, start: SWEEP_START, duration: 2.5, ease: outExpo });

  const portraitMask = new Graphics();
  portrait.addChild(portraitMask);
  portrait.mask = portraitMask;

  // --- Quote words (each lifts in as the front passes it) ---
  const wordNodes: { node: Text; left: number; baseY: number }[] = [];
  boxes.forEach((box) => {
    const node = makeText(fonts, {
      text: box.text,
      role: "serif",
      weight: 400,
      size: qSize,
      color: textColor,
      anchor: 0.5,
    });
    const x = quoteAnchorX + box.cx;
    node.position.set(x, box.cy + quoteCy);
    node.alpha = 0;
    root.addChild(node);
    wordNodes.push({ node, left: x - box.width / 2, baseY: box.cy + quoteCy });
  });

  if (showQuoteMark) {
    const mark = makeText(fonts, {
      text: "“",
      role: "serif",
      weight: 600,
      size: markSize,
      color: accent,
      anchor: 0.5,
    });
    const markX = side ? quoteAnchorX + markSize * 0.3 : cx;
    mark.position.set(markX, markCy + markSize * 0.2);
    mark.alpha = 0;
    root.addChild(mark);
    wordNodes.push({ node: mark, left: markX - markSize * 0.3, baseY: mark.position.y });
  }

  // --- Attribution: hairline, name, role ---
  if (showRule) {
    const ruleW = Math.min(quoteMaxW * 0.22, minDim * 0.13);
    const rule = new Graphics().roundRect(0, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(side ? quoteAnchorX : cx - ruleW / 2, ruleY);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 1.95, duration: 0.6, ease: outExpo });
  }

  const nameText = makeText(fonts, {
    text: name,
    role: "display",
    weight: 600,
    size: nameSize,
    color: textColor,
    anchor: side ? { x: 0, y: 0.5 } : 0.5,
  });
  nameText.position.set(side ? quoteAnchorX : cx, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 2.06, duration: 0.5, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 14, to: nameY, start: 2.06, duration: 0.65, ease: outExpo });

  if (role.length > 0) {
    const roleText = makeText(fonts, {
      text: role,
      role: "body",
      weight: 400,
      size: roleSize,
      color: muted,
      anchor: side ? { x: 0, y: 0.5 } : 0.5,
    });
    roleText.position.set(side ? quoteAnchorX : cx, roleY);
    roleText.alpha = 0;
    root.addChild(roleText);
    timeline
      .to(roleText, { prop: "alpha", from: 0, to: 1, start: 2.2, duration: 0.5, ease: outQuad })
      .to(roleText, { prop: "y", from: roleY + 12, to: roleY, start: 2.2, duration: 0.6, ease: outExpo });
  }

  // --- The soft light that rides the wavefront ---
  const sweep = showSweep ? new Sprite(radialGlowTexture()) : null;
  if (sweep) {
    sweep.anchor.set(0.5);
    sweep.tint = sweepColor;
    sweep.width = zone.width * 0.22;
    sweep.height = h * 1.7;
    sweep.alpha = 0;
    sweep.position.set(frontFrom, h / 2);
    root.addChild(sweep);
  }

  const rise = qSize * 0.5;
  const update = (t: number): void => {
    const u = clamp01((t - SWEEP_START) / SWEEP_DUR);
    const p = inOutQuad(u);
    const front = frontFrom + (frontTo - frontFrom) * p;

    portraitMask.clear();
    const revealW = Math.min(panelW, Math.max(0, front - panelX));
    if (revealW > 0.5) {
      portraitMask.roundRect(-panelW / 2, -panelH / 2, revealW, panelH, radius).fill("#FFFFFF");
    }

    for (const item of wordNodes) {
      const a = smooth(clamp01((front - item.left) / (feather * 0.55)));
      item.node.alpha = a;
      item.node.position.y = item.baseY + (1 - a) * rise;
    }

    if (sweep) {
      sweep.position.x = front;
      const inA = Math.min(1, u / 0.1);
      const outA = Math.min(1, (1 - u) / 0.22);
      sweep.alpha = 0.42 * inA * outA;
    }
  };

  return { timeline, duration: DURATION, update };
}

export const quotePortrait: TemplateDefinition = {
  id: "quote-portrait",
  name: "Quote Portrait",
  tagline: "A soft light travels across, opening the portrait and the quote together.",
  category: "testimonial",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { quote: "serif", name: "display", role: "body" },
  palettes: PALETTES,
  fields: [
    {
      key: "quote",
      type: "textarea",
      label: "Quote",
      default: "They shipped in a week what we had been circling for a year.",
      maxLength: 140,
    },
    { key: "image", type: "image", label: "Portrait", default: "", optional: true },
    { key: "name", type: "text", label: "Name", default: "Mara Ellis", maxLength: 24, shrinkToFit: true },
    { key: "role", type: "text", label: "Role", default: "Head of Brand, Fielder", maxLength: 34, shrinkToFit: true },
    { key: "showQuoteMark", type: "toggle", label: "Quote mark", default: true },
    { key: "showRule", type: "toggle", label: "Hairline", default: true },
    { key: "showSweep", type: "toggle", label: "Light sweep", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "panelBg", type: "color", label: "Portrait back", default: "", optional: true },
  ],
  build,
};
