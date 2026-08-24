import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};
const DEG = Math.PI / 180;

const DEFAULT_CARDS = ["New templates", "Faster export", "Dark-free UI"];
const CARD_INK = "#101014";
const CARD_BG = "#FFFFFF";
const SKELETON = "#D8DCE2";

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF3EE", textColor: "#2A0F06", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", textColor: "#241452", accent: "#7C5CFF", onAccent: "#FFFFFF" } },
  { id: "slate", name: "Slate", colors: { background: "#EEF1F5", textColor: "#0F1B2A", accent: "#2E5BD6", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
];

interface CascadeCfg {
  titleYF: number;
  listCenterYF: number;
  listHF: number;
  cardWF: number;
}

const CASCADE: Record<Aspect, CascadeCfg> = {
  "1:1": { titleYF: 0.12, listCenterYF: 0.57, listHF: 0.6, cardWF: 0.8 },
  "4:5": { titleYF: 0.12, listCenterYF: 0.56, listHF: 0.58, cardWF: 0.8 },
  "9:16": { titleYF: 0.13, listCenterYF: 0.5, listHF: 0.5, cardWF: 0.8 },
  "16:9": { titleYF: 0.12, listCenterYF: 0.58, listHF: 0.6, cardWF: 0.78 },
};

function cardList(values: Values): string[] {
  return asItems(values.cards, DEFAULT_CARDS).slice(0, 4);
}

function computeDuration(values: Values): number {
  return 0.8 + cardList(values).length * 0.45 + 1.8;
}

/** Crisp-fit helper: re-make one size smaller if it would overflow. */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

function makeCard(
  fonts: TemplateContext["fonts"],
  label: string,
  index: number,
  cardW: number,
  cardH: number,
  accent: string,
  onAccent: string,
): Container {
  const card = new Container();
  const r = cardH * 0.16;
  // Soft drop shadow.
  card.addChild(
    new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.06, cardW, cardH, r).fill({ color: "#000000", alpha: 0.06 }),
  );
  // Body.
  card.addChild(
    new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r).fill(CARD_BG).stroke({ color: "#000000", alpha: 0.06, width: 1 }),
  );
  // Accent index chip (rounded square + number).
  const chip = cardH * 0.52;
  const chipX = -cardW / 2 + cardH * 0.58;
  card.addChild(new Graphics().roundRect(chipX - chip / 2, -chip / 2, chip, chip, chip * 0.28).fill(accent));
  const num = makeText(fonts, { text: String(index + 1), role: "display", weight: 700, size: Math.round(chip * 0.62), color: onAccent, anchor: 0.5 });
  num.position.set(chipX, 0);
  card.addChild(num);

  const textX = -cardW / 2 + cardH * 1.05;
  const textMaxW = cardW - cardH * 1.05 - cardW * 0.06;
  // Title line.
  const title0 = fitText(
    fonts,
    { text: label, role: "display", weight: 700, size: Math.round(cardH * 0.26), color: CARD_INK, anchor: { x: 0, y: 0.5 } },
    textMaxW,
  );
  title0.position.set(textX, -cardH * 0.13);
  card.addChild(title0);
  // Skeleton line.
  card.addChild(new Graphics().roundRect(textX, cardH * 0.1, textMaxW * 0.62, cardH * 0.1, cardH * 0.05).fill(SKELETON));
  return card;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF3EE"));
  const textColor = str(values.textColor, pc("textColor", "#2A0F06"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const title = str(values.title, "This week's drops");
  const cards = cardList(values);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const w = size.width;
  const h = size.height;
  const cfg = CASCADE[ctx.aspect];
  const cardW = w * cfg.cardWF;
  const listH = h * cfg.listHF;
  const listCenterY = h * cfg.listCenterYF;
  const rowPitch = listH / cards.length;
  const cardH = rowPitch * 0.82;
  const listTop = listCenterY - listH / 2;
  const pileX = w / 2;
  const pileY = listCenterY;
  const mid = (cards.length - 1) / 2;

  const timeline = new JimaTimeline();

  cards.forEach((label, i) => {
    const card = makeCard(fonts, label, i, cardW, cardH, accent, onAccent);
    const rowY = listTop + (i + 0.5) * rowPitch;
    // Start: tight pile at center, slightly offset + rotated.
    const startRot = (i - mid) * 4 * DEG;
    card.position.set(pileX + (i - mid) * 10, pileY + (i - mid) * 7);
    card.rotation = startRot;
    card.alpha = 0;
    root.addChild(card);

    const cascade = 0.8 + i * 0.35;
    timeline
      // Pile fades in first, then each card cascades to its row and de-rotates.
      .to(card, { prop: "alpha", from: 0, to: 1, start: 0.0, duration: 0.4, ease: outQuad })
      .to(card, { prop: "x", from: pileX + (i - mid) * 10, to: w / 2, start: cascade, duration: 0.8, ease: spring(0.5) })
      .to(card, { prop: "y", from: pileY + (i - mid) * 7, to: rowY, start: cascade, duration: 0.8, ease: spring(0.5) })
      .to(card, { prop: "rotation", from: startRot, to: 0, start: cascade, duration: 0.7, ease: outExpo });
  });

  // Title header on top.
  const titleSize = Math.round(w * (ctx.aspect === "16:9" ? 0.05 : 0.06));
  const titleY = h * cfg.titleYF;
  const titleText = fitText(
    fonts,
    { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
    w * 0.86,
  );
  titleText.position.set(w / 2, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 18, to: titleY, start: 0.1, duration: 0.6, ease: outExpo });

  return { timeline, duration: computeDuration(values) };
}

export const cardCascade: TemplateDefinition = {
  id: "card-cascade",
  name: "Card Cascade",
  tagline: "A pile of cards cascades into a tidy list.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "This week's drops", maxLength: 40, shrinkToFit: true },
    { key: "cards", type: "textlist", label: "Cards", default: DEFAULT_CARDS, minItems: 2, maxItems: 4, maxLength: 26 },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
