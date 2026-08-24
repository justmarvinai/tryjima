import { Container, Graphics, Sprite, type Text, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (a.length) return a;
  }
  return fb;
};

function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number): Text {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

const DEFAULT_FEATURES = ["Lightning fast", "Fully private", "100% free"];
const PER_FEATURE = 0.5;

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF6F1", textColor: "#241009", accent: "#FF4D1C", onAccent: "#FFFFFF", card: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F4F1FF", textColor: "#241452", accent: "#7C5CFF", onAccent: "#FFFFFF", card: "#FFFFFF" } },
  { id: "ocean", name: "Ocean", colors: { background: "#EEF4FF", textColor: "#0B1F4D", accent: "#2E7DF6", onAccent: "#FFFFFF", card: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FAF5EA", accent: "#D8F34D", onAccent: "#101014", card: "#1C1E26" } },
];

const CARD: Record<Aspect, { wF: number; hF: number; cyF: number }> = {
  "16:9": { wF: 0.32, hF: 0.62, cyF: 0.56 },
  "1:1": { wF: 0.44, hF: 0.46, cyF: 0.52 },
  "4:5": { wF: 0.46, hF: 0.46, cyF: 0.5 },
  "9:16": { wF: 0.46, hF: 0.44, cyF: 0.46 },
};

function computeDuration(values: Values): number {
  const features = asList(values.features, DEFAULT_FEATURES).slice(0, 4);
  return 1.0 + features.length * PER_FEATURE + 1.4;
}

/** A framed-landscape glyph, centered at origin (empty-product placeholder). */
function photoGlyph(s: number, color: string): Container {
  const g = new Container();
  const fw = s;
  const fh = s * 0.82;
  g.addChild(new Graphics().roundRect(-fw / 2, -fh / 2, fw, fh, s * 0.1).stroke({ color, width: Math.max(3, s * 0.05) }));
  g.addChild(new Graphics().circle(fw * 0.2, -fh * 0.18, s * 0.1).fill(color));
  g.addChild(new Graphics().poly([-fw * 0.42, fh * 0.4, -fw * 0.1, -fh * 0.04, fw * 0.16, fh * 0.4]).fill(color));
  g.addChild(new Graphics().poly([-fw * 0.02, fh * 0.4, fw * 0.2, fh * 0.06, fw * 0.46, fh * 0.4]).fill(color));
  return g;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const aspect = ctx.aspect;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF6F1"));
  const textColor = str(values.textColor, pc("textColor", "#241009"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const cardColor = pc("card", "#FFFFFF");
  const title = str(values.title, "");
  const features = asList(values.features, DEFAULT_FEATURES).slice(0, 4);
  const n = features.length;
  const showConnector = values.connector !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  const marginX = w * 0.06;

  // --- Optional title ---
  if (title.length > 0) {
    const titleY = h * (aspect === "9:16" ? 0.14 : aspect === "16:9" ? 0.1 : 0.09);
    const titleSize = Math.round(minDim * (aspect === "16:9" ? 0.05 : 0.056));
    const titleText = fitText(
      fonts,
      { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
      w - marginX * 2,
    );
    titleText.position.set(w / 2, titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.0, duration: 0.4, ease: outQuad })
      .to(titleText, { prop: "y", from: titleY - 16, to: titleY, start: 0.0, duration: 0.55, ease: outExpo });
  }

  // --- Product card (image cover-fit, masked) or placeholder ---
  const cfg = CARD[aspect];
  const cardW = w * cfg.wF;
  const cardH = h * cfg.hF;
  const cardCX = w / 2;
  const cardCY = h * cfg.cyF;
  const cardLeft = cardCX - cardW / 2;
  const cardRight = cardCX + cardW / 2;
  const cardTop = cardCY - cardH / 2;
  const r = minDim * 0.04;

  const cardC = new Container();
  const shadow = new Graphics().roundRect(cardLeft, cardTop + minDim * 0.012, cardW, cardH, r).fill({ color: 0x101014, alpha: 0.1 });
  cardC.addChild(shadow);
  cardC.addChild(new Graphics().roundRect(cardLeft, cardTop, cardW, cardH, r).fill(cardColor));
  const tex: Texture | null = images.product ?? null;
  if (tex) {
    const holder = new Container();
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(cardW / tex.width, cardH / tex.height);
    s.scale.set(cover);
    s.position.set(cardCX, cardCY);
    const mask = new Graphics().roundRect(cardLeft, cardTop, cardW, cardH, r).fill(0xffffff);
    holder.addChild(s, mask);
    s.mask = mask;
    cardC.addChild(holder);
  } else {
    const gs = Math.min(cardW, cardH) * 0.42;
    const ph = new Container();
    ph.addChild(new Graphics().circle(0, 0, gs * 0.62).fill({ color: accent, alpha: 0.1 }));
    ph.addChild(photoGlyph(gs, accent));
    ph.position.set(cardCX, cardCY);
    cardC.addChild(ph);
  }
  cardC.pivot.set(cardCX, cardCY);
  cardC.position.set(cardCX, cardCY);
  cardC.alpha = 0;
  cardC.scale.set(0.94);
  root.addChild(cardC);
  timeline
    .to(cardC, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outQuad })
    .to(cardC, { prop: "scale.x", from: 0.94, to: 1, start: 0.3, duration: 0.6, ease: outExpo })
    .to(cardC, { prop: "scale.y", from: 0.94, to: 1, start: 0.3, duration: 0.6, ease: outExpo });

  // --- Callouts ---
  const Rdot = minDim * 0.017;
  const leaderTh = Math.max(2, minDim * 0.006);
  const gap = minDim * 0.02;
  const labelFont = Math.round(minDim * 0.034);
  const gutterR = w - marginX - cardRight;
  const gutterL = cardLeft - marginX;
  const railRX = cardRight + gutterR * 0.2;
  const railLX = cardLeft - gutterL * 0.2;

  features.forEach((feat, i) => {
    const right = i % 2 === 0;
    const v = n === 1 ? 0.5 : 0.2 + 0.6 * (i / (n - 1));
    const dotY = cardTop + v * cardH;
    const dotX = right ? cardRight - Rdot * 0.3 : cardLeft + Rdot * 0.3;
    const start = 1.0 + i * PER_FEATURE;

    // Leader line (draws out from the dot).
    if (showConnector) {
      const leaderLen = right ? railRX - dotX : dotX - railLX;
      const leader = new Graphics();
      if (right) leader.roundRect(0, -leaderTh / 2, leaderLen, leaderTh, leaderTh / 2).fill(accent);
      else leader.roundRect(-leaderLen, -leaderTh / 2, leaderLen, leaderTh, leaderTh / 2).fill(accent);
      leader.position.set(dotX, dotY);
      leader.scale.set(0, 1);
      root.addChild(leader);
      timeline.to(leader, { prop: "scale.x", from: 0, to: 1, start: start + 0.15, duration: 0.35, ease: outExpo });
    }

    // Label at the leader end.
    const labelX = right ? railRX + gap : railLX - gap;
    const maxW = right ? w - marginX - labelX : labelX - marginX;
    const label = fitText(
      fonts,
      { text: feat, role: "display", weight: 700, size: labelFont, color: textColor, anchor: { x: right ? 0 : 1, y: 0.5 } },
      maxW,
    );
    const restX = labelX;
    label.position.set(restX + (right ? 12 : -12), dotY);
    label.alpha = 0;
    root.addChild(label);
    timeline
      .to(label, { prop: "alpha", from: 0, to: 1, start: start + 0.4, duration: 0.35, ease: outQuad })
      .to(label, { prop: "x", from: restX + (right ? 12 : -12), to: restX, start: start + 0.4, duration: 0.5, ease: outExpo });

    // Callout dot (on the product).
    const dot = new Container();
    dot.position.set(dotX, dotY);
    dot.addChild(new Graphics().circle(0, 0, Rdot).fill(accent));
    dot.addChild(new Graphics().circle(0, 0, Rdot * 0.4).fill("#FFFFFF"));
    dot.scale.set(0);
    root.addChild(dot);
    timeline
      .to(dot, { prop: "scale.x", from: 0, to: 1, start, duration: 0.55, ease: spring(0.45) })
      .to(dot, { prop: "scale.y", from: 0, to: 1, start, duration: 0.55, ease: spring(0.45) });
  });

  return { timeline, duration: computeDuration(values) };
}

export const featureCallouts: TemplateDefinition = {
  id: "feature-callouts",
  name: "Feature Callouts",
  tagline: "Annotation dots point out features around a product.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Meet the features", maxLength: 40, shrinkToFit: true, optional: true },
    { key: "product", type: "image", label: "Product image", default: "", optional: true, help: "Transparent PNG or a product photo." },
    { key: "features", type: "textlist", label: "Features", default: DEFAULT_FEATURES, minItems: 2, maxItems: 4, maxLength: 24 },
    { key: "connector", type: "toggle", label: "Connector line", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
