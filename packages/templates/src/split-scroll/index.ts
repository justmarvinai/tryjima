import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  linear,
  outQuad,
  outQuint,
  outExpo,
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

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// Two stacked columns travel in opposite directions at one easy pace, then
// decelerate together while a title card settles over the middle. The handoff
// between the constant-pace leg and the decelerating leg is velocity-matched
// (see PHASE_B_TRAVEL_F) so there is no visible kink where the ease changes.
const PALETTES: Palette[] = [
  {
    id: "studio",
    name: "Studio",
    colors: {
      background: "#F4F2ED", textColor: "#191713", accent: "#B4552F", cardColor: "#FFFFFF",
      muted: "#9C948A", tone1: "#E4DED2", tone2: "#D2C9B9", tone3: "#EDE6DA", tone4: "#C9BFAF",
      ink: "#8B7F6E",
    },
  },
  {
    id: "atlas",
    name: "Atlas",
    colors: {
      background: "#EDF1F4", textColor: "#101C25", accent: "#1D6E90", cardColor: "#FFFFFF",
      muted: "#8B9AA5", tone1: "#DCE6EC", tone2: "#C6D5DF", tone3: "#E8EEF2", tone4: "#B7C9D4",
      ink: "#7A8E9C",
    },
  },
  {
    id: "bloom",
    name: "Bloom",
    colors: {
      background: "#F6F1F4", textColor: "#241522", accent: "#A8386B", cardColor: "#FFFFFF",
      muted: "#A28E99", tone1: "#EBDFE6", tone2: "#DCC8D3", tone3: "#F1E8ED", tone4: "#CFB6C3",
      ink: "#96798A",
    },
  },
  {
    id: "obsidian",
    name: "Obsidian",
    colors: {
      background: "#0F1113", textColor: "#F1F3F5", accent: "#D8B25F", cardColor: "#1A1D21",
      muted: "#767C85", tone1: "#22262B", tone2: "#2C3138", tone3: "#1C2024", tone4: "#343A42",
      ink: "#4C545E",
    },
  },
];

interface Cfg {
  /** Combined width of both columns, as a fraction of the safe width. */
  colsWF: number;
  /** Title-card width, as a fraction of the safe width. */
  cardWF: number;
  titleF: number;
}
const CFG: Record<Aspect, Cfg> = {
  "16:9": { colsWF: 0.8, cardWF: 0.46, titleF: 0.06 },
  "1:1": { colsWF: 0.88, cardWF: 0.82, titleF: 0.062 },
  "4:5": { colsWF: 0.9, cardWF: 0.84, titleF: 0.058 },
  "9:16": { colsWF: 0.96, cardWF: 0.94, titleF: 0.05 },
};

// Editorial rhythm — tile heights as multiples of the column width.
const RATIOS = [1.18, 0.82, 1.32, 0.94, 1.12, 0.86, 1.26, 0.9];

const PHASE_A_DUR = 2.3;
const PHASE_B_START = 2.3;
const PHASE_B_DUR = 1.35;
// outQuint leaves its start at 5x the average speed, so this travel fraction
// makes the decelerating leg begin at exactly the constant-leg speed.
const PHASE_B_TRAVEL_F = PHASE_B_DUR / (PHASE_A_DUR * 5);
const CARD_START = 2.5;
const DURATION = 4.8;

interface TileColors {
  tones: string[];
  ink: string;
  accent: string;
}

/**
 * A soft drop shadow: five progressively larger, offset rounded rects at low
 * alpha. Overlap makes the core dense and the rim feathered — a gradient edge
 * without a resolution-dependent blur filter.
 */
function softShadow(w: number, h: number, r: number, spread: number): Container {
  const c = new Container();
  for (let i = 1; i <= 5; i++) {
    const o = spread * i * 0.36;
    const dy = spread * i * 0.3;
    c.addChild(
      new Graphics()
        .roundRect(-w / 2 - o, -h / 2 - o + dy, w + o * 2, h + o * 2, r + o)
        .fill({ color: "#000000", alpha: 0.034 }),
    );
  }
  return c;
}

/** One drawn stand-in "photograph" — four calm abstract compositions. */
function drawTile(g: Graphics, w: number, h: number, variant: number, c: TileColors): void {
  g.rect(0, 0, w, h).fill(c.tones[variant % c.tones.length] ?? "#FFFFFF");
  switch (variant % 4) {
    case 0:
      g.circle(w * 0.36, h * 0.36, Math.min(w, h) * 0.26).fill({ color: c.ink, alpha: 0.45 });
      g.rect(0, h * 0.66, w, h * 0.34).fill({ color: c.ink, alpha: 0.24 });
      break;
    case 1:
      g.rect(0, h * 0.5, w, h * 0.18).fill({ color: c.ink, alpha: 0.28 });
      g.rect(0, h * 0.72, w, h * 0.28).fill({ color: c.ink, alpha: 0.5 });
      g.circle(w * 0.74, h * 0.26, Math.min(w, h) * 0.09).fill({ color: c.accent, alpha: 0.7 });
      break;
    case 2: {
      const aw = w * 0.46;
      const ah = h * 0.62;
      g.roundRect((w - aw) / 2, h * 0.24, aw, ah, aw / 2).fill({ color: c.ink, alpha: 0.5 });
      g.rect(0, h * 0.86, w, h * 0.14).fill({ color: c.ink, alpha: 0.28 });
      break;
    }
    default:
      g.poly([0, h, 0, h * 0.44, w, h * 0.16, w, h]).fill({ color: c.ink, alpha: 0.42 });
      g.circle(w * 0.24, h * 0.22, Math.min(w, h) * 0.07).fill({ color: c.accent, alpha: 0.75 });
      break;
  }
}

/** A tile: rounded-clipped cover-fit photo, or a drawn stand-in. */
function makeTile(w: number, h: number, r: number, variant: number, c: TileColors, tex: Texture | null): Container {
  const card = new Container();
  const clip = new Container();
  const mask = new Graphics().roundRect(0, 0, w, h, r).fill(0xffffff);
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(Math.max(w / tex.width, h / tex.height));
    s.position.set(w / 2, h / 2);
    clip.addChild(s);
  } else {
    const g = new Graphics();
    drawTile(g, w, h, variant, c);
    clip.addChild(g);
  }
  clip.mask = mask;
  card.addChild(clip, mask);
  return card;
}

interface Reel {
  node: Container;
  height: number;
}

/** Stack tiles down a column until it is at least `minHeight` tall. */
function buildReel(
  colW: number,
  gap: number,
  radius: number,
  minHeight: number,
  variantSeed: number,
  colors: TileColors,
  tex: Texture | null,
  texIndex: number,
): Reel {
  const node = new Container();
  let y = 0;
  let i = 0;
  while (y < minHeight) {
    const ratio = RATIOS[(variantSeed + i) % RATIOS.length] ?? 1;
    const tileH = colW * ratio;
    const tile = makeTile(colW, tileH, radius, variantSeed + i, colors, i === texIndex ? tex : null);
    tile.position.set(0, y);
    node.addChild(tile);
    y += tileH + gap;
    i++;
  }
  return { node, height: y };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2ED"));
  const textColor = str(values.textColor, pc("textColor", "#191713"));
  const accent = str(values.accent, pc("accent", "#B4552F"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const muted = pc("muted", "#9C948A");
  const ink = pc("ink", "#8B7F6E");

  const eyebrow = str(values.eyebrow, "Selected work");
  const title = str(values.title, "Studio index");
  const subtitle = str(values.subtitle, "Twelve projects, one quiet system.");
  const showVeil = on(values.showVeil);
  const showRule = on(values.showRule);
  const showShadow = on(values.showShadow);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cfg = CFG[ctx.aspect];
  const safe = safeRect(ctx.aspect);
  const timeline = new JimaTimeline();

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  // --- Two counter-scrolling columns ---
  const colGap = minDim * 0.022;
  const colsW = safe.width * cfg.colsWF;
  const colW = (colsW - colGap) / 2;
  const tileGap = minDim * 0.022;
  const tileR = minDim * 0.018;

  const travelA = h * 0.4475;
  const travelB = travelA * PHASE_B_TRAVEL_F;
  const totalTravel = travelA + travelB;
  const reelMin = h + totalTravel + h * 0.26;

  const tones = [pc("tone1", "#E4DED2"), pc("tone2", "#D2C9B9"), pc("tone3", "#EDE6DA"), pc("tone4", "#C9BFAF")];
  const leftColors: TileColors = { tones, ink, accent };
  const rightColors: TileColors = { tones: [tones[2] ?? "", tones[3] ?? "", tones[0] ?? "", tones[1] ?? ""], ink, accent };

  const left = buildReel(colW, tileGap, tileR, reelMin, 0, leftColors, images.imageA ?? null, 1);
  const right = buildReel(colW, tileGap, tileR, reelMin, 2, rightColors, images.imageB ?? null, 1);

  const colsLeftX = w / 2 - colsW / 2;
  const leftY0 = -h * 0.15;
  const rightY0 = -totalTravel - h * 0.12;

  left.node.position.set(colsLeftX, leftY0);
  right.node.position.set(colsLeftX + colW + colGap, rightY0);
  left.node.alpha = 0;
  right.node.alpha = 0;
  root.addChild(left.node, right.node);

  timeline
    .to(left.node, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.55, ease: outQuad })
    .to(right.node, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.55, ease: outQuad })
    // Left column: up. Constant pace, then a matched-speed glide to rest.
    .to(left.node, { prop: "y", from: leftY0, to: leftY0 - travelA, start: 0, duration: PHASE_A_DUR, ease: linear })
    .to(left.node, {
      prop: "y", from: leftY0 - travelA, to: leftY0 - totalTravel,
      start: PHASE_B_START, duration: PHASE_B_DUR, ease: outQuint,
    })
    // Right column: down.
    .to(right.node, { prop: "y", from: rightY0, to: rightY0 + travelA, start: 0, duration: PHASE_A_DUR, ease: linear })
    .to(right.node, {
      prop: "y", from: rightY0 + travelA, to: rightY0 + totalTravel,
      start: PHASE_B_START, duration: PHASE_B_DUR, ease: outQuint,
    });

  // --- Veil: settles the columns back so the card can lead ---
  if (showVeil) {
    const veil = new Graphics().rect(0, 0, w, h).fill(bg);
    veil.alpha = 0;
    root.addChild(veil);
    timeline.to(veil, { prop: "alpha", from: 0, to: 0.44, start: CARD_START - 0.2, duration: 0.9, ease: inOutQuad });
  }

  // --- Centred title card ---
  const cardW = safe.width * cfg.cardWF;
  const pad = minDim * 0.055;
  const innerW = cardW - pad * 2;
  const eyeSize = Math.round(minDim * 0.021);
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * cfg.titleF), innerW);
  const subSize = fitSize(fonts, subtitle, "body", 500, Math.round(minDim * 0.026), innerW);
  const ruleW = minDim * 0.07;
  const ruleH = Math.max(3, Math.round(minDim * 0.006));

  const hasEyebrow = eyebrow.length > 0;
  const hasSub = subtitle.length > 0;
  const cardH =
    pad * 2 +
    (hasEyebrow ? eyeSize * 1.2 + minDim * 0.026 : 0) +
    titleSize * 1.2 +
    (hasSub ? minDim * 0.022 + subSize * 1.25 : 0) +
    (showRule ? minDim * 0.03 + ruleH : 0);

  const cardCx = w / 2;
  const cardCy = safe.y + safe.height / 2;
  const card = new Container();
  card.position.set(cardCx, cardCy);
  card.alpha = 0;
  card.scale.set(0.965);
  root.addChild(card);
  if (showShadow) card.addChild(softShadow(cardW, cardH, minDim * 0.024, minDim * 0.014));
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, minDim * 0.024).fill(cardColor));
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: CARD_START, duration: 0.55, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.965, to: 1, start: CARD_START, duration: 0.9, ease: outExpo })
    .to(card, { prop: "scale.y", from: 0.965, to: 1, start: CARD_START, duration: 0.9, ease: outExpo })
    .to(card, { prop: "y", from: cardCy + minDim * 0.022, to: cardCy, start: CARD_START, duration: 0.95, ease: outExpo });

  const leftX = -cardW / 2 + pad;
  let cursorY = -cardH / 2 + pad;

  if (hasEyebrow) {
    const eyeText = makeText(fonts, {
      text: eyebrow,
      role: "body",
      weight: 600,
      size: fitSize(fonts, eyebrow, "body", 600, eyeSize, innerW),
      color: accent,
      anchor: { x: 0, y: 0.5 },
      letterSpacing: eyeSize * 0.14,
    });
    const eyeY = cursorY + eyeSize * 0.6;
    eyeText.position.set(leftX, eyeY);
    eyeText.alpha = 0;
    card.addChild(eyeText);
    timeline
      .to(eyeText, { prop: "alpha", from: 0, to: 1, start: CARD_START + 0.2, duration: 0.45, ease: outQuad })
      .to(eyeText, { prop: "y", from: eyeY + minDim * 0.01, to: eyeY, start: CARD_START + 0.2, duration: 0.6, ease: outQuint });
    cursorY += eyeSize * 1.2 + minDim * 0.026;
  }

  const titleY = cursorY + titleSize * 0.6;
  const titleText = makeText(fonts, {
    text: title,
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
    letterSpacing: -titleSize * 0.014,
  });
  titleText.position.set(leftX, titleY);
  titleText.alpha = 0;
  card.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: CARD_START + 0.3, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + minDim * 0.018, to: titleY, start: CARD_START + 0.3, duration: 0.75, ease: outQuint });
  cursorY += titleSize * 1.2;

  if (hasSub) {
    const subY = cursorY + minDim * 0.022 + subSize * 0.6;
    const subText = makeText(fonts, {
      text: subtitle,
      role: "body",
      weight: 500,
      size: subSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    subText.position.set(leftX, subY);
    subText.alpha = 0;
    card.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.75, start: CARD_START + 0.48, duration: 0.5, ease: outQuad })
      .to(subText, { prop: "y", from: subY + minDim * 0.014, to: subY, start: CARD_START + 0.48, duration: 0.65, ease: outQuint });
    cursorY += minDim * 0.022 + subSize * 1.25;
  }

  if (showRule) {
    const ruleY = cursorY + minDim * 0.03;
    const track = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill({ color: muted, alpha: 0.4 });
    track.position.set(leftX, ruleY);
    const fill = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    fill.position.set(leftX, ruleY);
    fill.scale.x = 0;
    card.addChild(track, fill);
    timeline
      .to(track, { prop: "alpha", from: 0, to: 1, start: CARD_START + 0.5, duration: 0.35, ease: outQuad })
      .to(fill, { prop: "scale.x", from: 0, to: 1, start: CARD_START + 0.6, duration: 0.7, ease: outExpo });
  }

  return { timeline, duration: DURATION };
}

export const splitScroll: TemplateDefinition = {
  id: "split-scroll",
  name: "Split Scroll",
  tagline: "Two columns of work drift past each other, then settle behind a title card.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 4.4,
  fontRoles: { title: "display", subtitle: "body", eyebrow: "body" },
  palettes: PALETTES,
  fields: [
    { key: "eyebrow", type: "text", label: "Eyebrow", default: "Selected work", maxLength: 22, shrinkToFit: true, optional: true },
    { key: "title", type: "text", label: "Title", default: "Studio index", maxLength: 24, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "Twelve projects, one quiet system.", maxLength: 46, shrinkToFit: true, optional: true },
    { key: "imageA", type: "image", label: "Left column image", default: "", optional: true, help: "Drops into the left column; drawn tiles stand in when empty." },
    { key: "imageB", type: "image", label: "Right column image", default: "", optional: true, help: "Drops into the right column." },
    { key: "showVeil", type: "toggle", label: "Dim the columns", default: true },
    { key: "showRule", type: "toggle", label: "Accent rule", default: true },
    { key: "showShadow", type: "toggle", label: "Card shadow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
