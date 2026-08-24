import { Container, Graphics, Sprite, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF4EE", accent: "#FF4D1C", textColor: "#101014", cardFill: "#17131B", sub: "#C4BEC9", peek: "#F8DDD0", border: "#101014", pillBg: "#17131B", pillText: "#FFFFFF", dotOff: "#E3CDC2" } },
  { id: "lime", name: "Lime", colors: { background: "#F2FAE4", accent: "#5F9E12", textColor: "#16230A", cardFill: "#13200A", sub: "#BCC6B0", peek: "#E2EED2", border: "#16230A", pillBg: "#13200A", pillText: "#FFFFFF", dotOff: "#CAD7B9" } },
  { id: "ocean", name: "Ocean", colors: { background: "#EDF3FF", accent: "#2E7DF6", textColor: "#0B1F4D", cardFill: "#0E1A33", sub: "#AEB8CC", peek: "#D7E3FA", border: "#0B1F4D", pillBg: "#0E1A33", pillText: "#FFFFFF", dotOff: "#BFCDE8" } },
  { id: "ink", name: "Ink", colors: { background: "#101014", accent: "#FF6A3C", textColor: "#FFFFFF", cardFill: "#26232E", sub: "#A7ADB8", peek: "#1C1B22", border: "#FFFFFF", pillBg: "#26232E", pillText: "#FFFFFF", dotOff: "#3A3A44" } },
];

interface CardCfg {
  cwF: number;
  chF: number;
  cyF: number;
  peeks: number;
}

const CARD: Record<Aspect, CardCfg> = {
  "1:1": { cwF: 0.62, chF: 0.62, cyF: 0.46, peeks: 3 },
  "4:5": { cwF: 0.62, chF: 0.7, cyF: 0.44, peeks: 3 },
  "9:16": { cwF: 0.66, chF: 0.54, cyF: 0.42, peeks: 3 },
  "16:9": { cwF: 0.34, chF: 0.66, cyF: 0.44, peeks: 2 },
};

interface Wrapped {
  text: string;
  size: number;
  lineHeight: number;
  lines: number;
}

function wrapFit(
  fonts: TemplateContext["fonts"],
  text: string,
  role: "display" | "body",
  weight: number,
  size0: number,
  maxWidth: number,
  maxLines: number,
): Wrapped {
  const family = fonts.family(role);
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight, size: sz });
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { text: "", size: size0, lineHeight: Math.round(size0 * 1.16), lines: 1 };
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || measure(next, size0) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  let packed = lines;
  if (packed.length > maxLines) {
    packed = [...packed.slice(0, maxLines - 1), packed.slice(maxLines - 1).join(" ")];
  }
  let size = size0;
  for (let guard = 0; guard < 8; guard++) {
    const widest = Math.max(...packed.map((l) => measure(l, size)));
    if (widest <= maxWidth || widest === 0) break;
    size = Math.max(12, Math.floor(size * (maxWidth / widest)));
  }
  return { text: packed.join("\n"), size, lineHeight: Math.round(size * 1.16), lines: packed.length };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF4EE"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const cardFill = pc("cardFill", "#17131B");
  const titleColor = str(values.textColor, "#FFFFFF");
  const subColor = pc("sub", "#C4BEC9");
  const peekColor = pc("peek", "#F8DDD0");
  const borderColor = pc("border", "#101014");
  const pillBg = pc("pillBg", "#17131B");
  const pillText = pc("pillText", "#FFFFFF");
  const dotOff = pc("dotOff", "#E3CDC2");
  const title = str(values.title, "5 tips inside →");
  const subtitle = str(values.subtitle, "Swipe to see them all");
  const showAccentBar = values.accentBar !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const cfg = CARD[ctx.aspect];
  const cardW = w * cfg.cwF;
  const cardH = h * cfg.chF;
  const cardCy = h * cfg.cyF;
  const cardR = Math.min(cardW, cardH) * 0.06;
  const peeks = cfg.peeks;
  const timeline = new JimaTimeline();

  // Peeking cards behind (suggesting more slides).
  for (let k = peeks; k >= 1; k--) {
    const sc = 1 - k * 0.05;
    const dx = cardW * 0.06 * k;
    const dy = -cardH * 0.02 * k;
    const rot = k * 3.5 * DEG;
    const peek = new Container();
    peek.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.03, cardW, cardH, cardR).fill({ color: 0x000000, alpha: 0.1 }));
    peek.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(peekColor).stroke({ color: borderColor, width: Math.max(1, cardW * 0.004), alpha: 0.5 }));
    peek.position.set(cx, cardCy);
    peek.rotation = 0;
    peek.alpha = 0;
    peek.scale.set(0.85);
    root.addChild(peek);
    const start = 0.4 + (peeks - k) * 0.12;
    timeline
      .to(peek, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(peek, { prop: "x", from: cx, to: cx + dx, start, duration: 0.7, ease: spring(0.5) })
      .to(peek, { prop: "y", from: cardCy, to: cardCy + dy, start, duration: 0.7, ease: spring(0.5) })
      .to(peek, { prop: "rotation", from: 0, to: rot, start, duration: 0.7, ease: outExpo })
      .to(peek, { prop: "scale.x", from: 0.85, to: sc, start, duration: 0.7, ease: spring(0.5) })
      .to(peek, { prop: "scale.y", from: 0.85, to: sc, start, duration: 0.7, ease: spring(0.5) });
  }

  // Front card: image (masked + scrim) or a bold fill.
  const main = new Container();
  main.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.03, cardW, cardH, cardR).fill({ color: 0x000000, alpha: 0.2 }));
  const tex = images.image ?? null;
  if (tex) {
    const holder = new Container();
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(cardW / tex.width, cardH / tex.height);
    s.scale.set(cover);
    const m = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(0xffffff);
    holder.addChild(s, m);
    s.mask = m;
    main.addChild(holder);
    main.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill({ color: 0x000000, alpha: 0.44 }));
  } else {
    main.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardFill));
  }
  main.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).stroke({ color: 0xffffff, width: Math.max(1, cardW * 0.004), alpha: 0.14 }));

  // Centered title block: title / accent rule / subtitle.
  const tW = cardW * 0.82;
  const tf = wrapFit(fonts, title, "display", 700, Math.round(cardW * 0.135), tW, 4);
  const titleTxt = makeText(fonts, { text: tf.text, role: "display", weight: 700, size: tf.size, color: titleColor, anchor: { x: 0.5, y: 0 }, align: "center", lineHeight: tf.lineHeight });
  const titleH = tf.lines * tf.lineHeight;
  let subTxt: Text | null = null;
  let subH = 0;
  if (subtitle.length > 0) {
    const sf = wrapFit(fonts, subtitle, "body", 500, Math.round(cardW * 0.05), tW, 2);
    subTxt = makeText(fonts, { text: sf.text, role: "body", weight: 500, size: sf.size, color: subColor, anchor: { x: 0.5, y: 0 }, align: "center", lineHeight: sf.lineHeight });
    subH = sf.lines * sf.lineHeight;
  }
  const ruleH = Math.max(3, cardW * 0.011);
  const ruleW = cardW * 0.16;
  const gap1 = cardW * 0.05;
  const gap2 = cardW * 0.045;
  const blockH = titleH + gap1 + ruleH + (subTxt ? gap2 + subH : 0);
  let yy = -blockH / 2;
  titleTxt.position.set(0, yy);
  main.addChild(titleTxt);
  yy += titleH + gap1;
  if (showAccentBar) {
    main.addChild(new Graphics().roundRect(-ruleW / 2, yy, ruleW, ruleH, ruleH / 2).fill(accent));
  }
  yy += ruleH;
  if (subTxt) {
    yy += gap2;
    subTxt.position.set(0, yy);
    main.addChild(subTxt);
  }

  main.position.set(cx, cardCy + cardH * 0.06);
  main.alpha = 0;
  main.scale.set(0.85);
  root.addChild(main);
  const mainStart = 0.4 + peeks * 0.12 + 0.15;
  timeline
    .to(main, { prop: "alpha", from: 0, to: 1, start: mainStart, duration: 0.4, ease: outQuad })
    .to(main, { prop: "y", from: cardCy + cardH * 0.06, to: cardCy, start: mainStart, duration: 0.8, ease: spring(0.5) })
    .to(main, { prop: "scale.x", from: 0.85, to: 1, start: mainStart, duration: 0.8, ease: spring(0.5) })
    .to(main, { prop: "scale.y", from: 0.85, to: 1, start: mainStart, duration: 0.8, ease: spring(0.5) });

  // "Swipe →" pill (pulsing) below the card.
  const pillFont = Math.round(Math.min(w, h) * 0.032);
  const lblT = makeText(fonts, { text: "Swipe", role: "display", weight: 700, size: pillFont, color: pillText, anchor: { x: 0, y: 0.5 }, letterSpacing: 1 });
  const arrT = makeText(fonts, { text: "→", role: "display", weight: 700, size: pillFont, color: accent, anchor: { x: 0, y: 0.5 } });
  const gapLA = pillFont * 0.4;
  const innerW = lblT.width + gapLA + arrT.width;
  const padX = pillFont;
  const pw = innerW + padX * 2;
  const ph = pillFont * 1.9;
  const pillOuter = new Container();
  const pillInner = new Container();
  pillInner.addChild(new Graphics().roundRect(-pw / 2, -ph / 2 + ph * 0.08, pw, ph, ph / 2).fill({ color: 0x000000, alpha: 0.16 }));
  pillInner.addChild(new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2).fill(pillBg));
  lblT.position.set(-innerW / 2, 0);
  pillInner.addChild(lblT);
  arrT.position.set(-innerW / 2 + lblT.width + gapLA, 0);
  pillInner.addChild(arrT);
  pillOuter.addChild(pillInner);
  const pillY = cardCy + cardH / 2 + ph * 1.25;
  pillOuter.position.set(cx, pillY);
  pillOuter.alpha = 0;
  pillOuter.scale.set(0.6);
  root.addChild(pillOuter);
  const pillStart = mainStart + 0.5;
  timeline
    .to(pillOuter, { prop: "alpha", from: 0, to: 1, start: pillStart, duration: 0.4, ease: outQuad })
    .to(pillOuter, { prop: "scale.x", from: 0.6, to: 1, start: pillStart, duration: 0.6, ease: makeOutBack(1.8) })
    .to(pillOuter, { prop: "scale.y", from: 0.6, to: 1, start: pillStart, duration: 0.6, ease: makeOutBack(1.8) });

  // Dot indicators.
  const dotsN = 5;
  const dotR = Math.min(w, h) * 0.008;
  const dotGap = dotR * 3.2;
  const dotsY = pillY + ph * 0.95;
  const dotsW = (dotsN - 1) * dotGap;
  for (let i = 0; i < dotsN; i++) {
    const d = new Graphics().circle(0, 0, i === 0 ? dotR * 1.15 : dotR).fill(i === 0 ? accent : dotOff);
    d.position.set(cx - dotsW / 2 + i * dotGap, dotsY);
    d.scale.set(0);
    root.addChild(d);
    const st = mainStart + 0.7 + i * 0.06;
    timeline
      .to(d, { prop: "scale.x", from: 0, to: 1, start: st, duration: 0.4, ease: makeOutBack(2) })
      .to(d, { prop: "scale.y", from: 0, to: 1, start: st, duration: 0.4, ease: makeOutBack(2) });
  }

  // Gentle continuous pulse on the swipe pill (pure in t; owns pillInner.scale).
  const PULSE_AT = mainStart + 1.1;
  const update = (t: number): void => {
    const tau = t - PULSE_AT;
    if (tau <= 0) {
      pillInner.scale.set(1, 1);
      return;
    }
    const env = Math.min(1, tau / 0.5);
    const s = 1 + 0.05 * Math.sin((tau / 0.85) * Math.PI * 2) * env;
    pillInner.scale.set(s, s);
  };

  return { timeline, duration: 3.8, update };
}

export const carouselCover: TemplateDefinition = {
  id: "carousel-cover",
  name: "Carousel Cover",
  tagline: "A swipeable carousel cover with peeking slides.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "5 tips inside →", maxLength: 40, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "Swipe to see them all", maxLength: 40, optional: true },
    { key: "image", type: "image", label: "Cover image", default: "", optional: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Title", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
