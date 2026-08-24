import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outCubic,
  spring,
  makeOutBack,
  shrinkToFit,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { groupThousands, parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

// accent/onAccent pairs verified ≥4.5:1 for the "SUPER THANKS" eyebrow pill.
const PALETTES: Palette[] = [
  { id: "warm", name: "Warm", colors: { background: "#FFF7ED", cardBg: "#FFFFFF", textColor: "#2A1B06", muted: "#7A6248", accent: "#C2410C", onAccent: "#FFFFFF" } },
  { id: "midnight-gold", name: "Midnight gold", colors: { background: "#121016", cardBg: "#1E1B24", textColor: "#FFFFFF", muted: "#A79BB0", accent: "#F2B441", onAccent: "#151016" } },
  { id: "berry", name: "Berry", colors: { background: "#FFF0F6", cardBg: "#FFFFFF", textColor: "#3A0A28", muted: "#8A6478", accent: "#B01D5C", onAccent: "#FFFFFF" } },
  { id: "mint", name: "Mint", colors: { background: "#E9F7F0", cardBg: "#FFFFFF", textColor: "#08221A", muted: "#4F6960", accent: "#0F7A55", onAccent: "#FFFFFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF7ED"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#2A1B06"));
  const muted = pc("muted", "#7A6248");
  const accent = str(values.accent, pc("accent", "#C2410C"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const name = str(values.name, "Sarah");
  const amount = str(values.amount, "$5");
  const total = parseTargetNumber(str(values.total, "128"));
  const totalLabel = str(values.totalLabel, "raised today");
  const showCoins = values.showCoins !== false;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const measureDisplay = (s: string, sz: number): number => fonts.measure(s, { family: fonts.family("display"), weight: 700, size: sz });
  const measureBody = (s: string, sz: number): number => fonts.measure(s, { family: fonts.family("body"), weight: 700, size: sz });

  // --- Card sizing ---
  const cardW = Math.min(safe.width * 0.88, minDim * 0.82);
  const cardPadX = Math.round(cardW * 0.08);
  const cardPadY = Math.round(cardW * 0.085);
  const availW = cardW - cardPadX * 2;

  const eyebrowSize = Math.round(minDim * 0.03);
  const eyebrowLabel = "SUPER THANKS";
  const eyebrowH = eyebrowSize * 2.3;

  const heartSize = Math.round(cardW * 0.24);
  const heartRowH = heartSize * 1.1;

  const msgFontBase = Math.round(minDim * 0.042);
  const msgIconSize = Math.round(msgFontBase * 0.95);
  const msgGap = msgFontBase * 0.32;
  const msgStr = `${name} sent ${amount}`;
  const msgSize = shrinkToFit(msgStr, measureBody, { maxWidth: availW - msgIconSize - msgGap, baseSize: msgFontBase, minSize: Math.round(msgFontBase * 0.55) });
  const msgTextWidth = measureBody(msgStr, msgSize);
  const msgH = msgSize * 1.3;

  const totalNumBase = Math.round(minDim * 0.088);
  const totalStr = `$${groupThousands(total)}`;
  const totalNumSize = shrinkToFit(totalStr, measureDisplay, { maxWidth: availW * 0.9, baseSize: totalNumBase, minSize: Math.round(totalNumBase * 0.5) });
  const totalNumH = totalNumSize * 1.05;

  const hasTotalLabel = totalLabel.length > 0;
  const totalLabelBase = Math.round(totalNumSize * 0.26);
  const measureLabel = (s: string, sz: number): number => fonts.measure(s, { family: fonts.family("body"), weight: 600, size: sz });
  const totalLabelSize = hasTotalLabel
    ? shrinkToFit(totalLabel, measureLabel, { maxWidth: availW * 0.92, baseSize: totalLabelBase, minSize: Math.round(totalLabelBase * 0.55) })
    : totalLabelBase;
  const totalLabelH = hasTotalLabel ? totalLabelSize * 1.3 : 0;

  const gap1 = Math.round(minDim * 0.022);
  const gap2 = Math.round(minDim * 0.014);
  const gap3 = Math.round(minDim * 0.028);
  const gap4 = Math.round(minDim * 0.012);

  const innerH = eyebrowH + gap1 + heartRowH + gap2 + msgH + gap3 + totalNumH + (hasTotalLabel ? gap4 + totalLabelH : 0);
  const cardH = innerH + cardPadY * 2;
  const cardR = cardH * 0.1;
  const cardCy = safe.y + safe.height / 2;

  // --- Card (pops in) ---
  const card = new Container();
  card.label = "card";
  card.position.set(cx, cardCy);
  card.alpha = 0;
  card.scale.set(0.8);
  root.addChild(card);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.3, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.8, to: 1, start: 0.05, duration: 0.6, ease: makeOutBack(1.6) })
    .to(card, { prop: "scale.y", from: 0.8, to: 1, start: 0.05, duration: 0.6, ease: makeOutBack(1.6) });

  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardBg));

  let cursor = -innerH / 2;
  const eyebrowCy = cursor + eyebrowH / 2;
  cursor += eyebrowH + gap1;
  const heartCy = cursor + heartRowH / 2;
  cursor += heartRowH + gap2;
  const msgCy = cursor + msgH / 2;
  cursor += msgH + gap3;
  const totalNumCy = cursor + totalNumH / 2;
  cursor += totalNumH;
  const totalLabelCy = hasTotalLabel ? cursor + gap4 + totalLabelH / 2 : 0;

  // --- Eyebrow pill ---
  const eyebrowLabelNode = makeText(fonts, { text: eyebrowLabel, role: "display", weight: 700, size: eyebrowSize, color: onAccent, anchor: 0.5, letterSpacing: 1.2 });
  const eyebrowPadX = eyebrowSize * 0.9;
  const eyebrowW = eyebrowLabelNode.width + eyebrowPadX * 2;
  const eyebrow = new Container();
  eyebrow.addChild(new Graphics().roundRect(-eyebrowW / 2, -eyebrowH / 2, eyebrowW, eyebrowH, eyebrowH / 2).fill(accent));
  eyebrow.addChild(eyebrowLabelNode);
  eyebrow.position.set(0, eyebrowCy);
  eyebrow.alpha = 0;
  eyebrow.scale.set(0.75);
  card.addChild(eyebrow);
  timeline
    .to(eyebrow, { prop: "alpha", from: 0, to: 1, start: 0.28, duration: 0.3, ease: outQuad })
    .to(eyebrow, { prop: "scale.x", from: 0.75, to: 1, start: 0.28, duration: 0.5, ease: spring(0.5) })
    .to(eyebrow, { prop: "scale.y", from: 0.75, to: 1, start: 0.28, duration: 0.5, ease: spring(0.5) });

  // --- Heart (pops in, gives a beat) ---
  const heart = makeIcon("heart", heartSize, { color: accent });
  heart.position.set(0, heartCy);
  heart.alpha = 0;
  heart.scale.set(0.4);
  card.addChild(heart);
  const HEART_POP = 0.55;
  const HEART_DUR = 0.5;
  timeline
    .to(heart, { prop: "alpha", from: 0, to: 1, start: HEART_POP, duration: 0.25, ease: outQuad })
    .to(heart, { prop: "scale.x", from: 0.4, to: 1, start: HEART_POP, duration: HEART_DUR, ease: makeOutBack(2.2) })
    .to(heart, { prop: "scale.y", from: 0.4, to: 1, start: HEART_POP, duration: HEART_DUR, ease: makeOutBack(2.2) });

  const BURST = HEART_POP + HEART_DUR - 0.05;
  timeline
    .to(heart, { prop: "scale.x", from: 1, to: 1.14, start: BURST, duration: 0.13, ease: outQuad })
    .to(heart, { prop: "scale.x", from: 1.14, to: 1, start: BURST + 0.13, duration: 0.24, ease: outQuad })
    .to(heart, { prop: "scale.y", from: 1, to: 1.14, start: BURST, duration: 0.13, ease: outQuad })
    .to(heart, { prop: "scale.y", from: 1.14, to: 1, start: BURST + 0.13, duration: 0.24, ease: outQuad });

  // --- Little coins popping outward from the heart ---
  const coins: { g: Graphics; ang: number; dist: number; delay: number; spin: number }[] = [];
  if (showCoins) {
    const N = 12;
    for (let i = 0; i < N; i++) {
      const s = minDim * rng.range(0.016, 0.03);
      const g = makeIcon("star", s, { color: rng.pick([accent, "#F2B441", textColor]) });
      g.position.set(0, heartCy);
      g.visible = false;
      card.addChild(g);
      const ang = (i / N) * Math.PI * 2 + rng.range(-0.24, 0.24);
      const dist = heartSize * rng.range(0.55, 1.05);
      const delay = rng.range(0, 0.16);
      const spin = rng.range(-4, 4);
      coins.push({ g, ang, dist, delay, spin });
    }
  }
  const COIN_LIFE = 0.75;

  // --- Message line: "{name} sent {amount}" + a small heart glyph ---
  const msgTotalW = msgTextWidth + msgGap + msgIconSize;
  const msgRow = new Container();
  const msgTextNode = makeText(fonts, { text: msgStr, role: "body", weight: 700, size: msgSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  msgTextNode.position.set(-msgTotalW / 2, 0);
  msgRow.addChild(msgTextNode);
  const msgHeart = makeIcon("heart", msgIconSize, { color: accent });
  msgHeart.position.set(-msgTotalW / 2 + msgTextWidth + msgGap + msgIconSize / 2, 0);
  msgRow.addChild(msgHeart);
  msgRow.position.set(0, msgCy);
  msgRow.alpha = 0;
  card.addChild(msgRow);
  timeline
    .to(msgRow, { prop: "alpha", from: 0, to: 1, start: 0.95, duration: 0.35, ease: outQuad })
    .to(msgRow, { prop: "y", from: msgCy + 14, to: msgCy, start: 0.95, duration: 0.5, ease: outExpo });

  // --- Running total (counts up) ---
  const totalNode = makeText(fonts, { text: "$0", role: "display", weight: 700, size: totalNumSize, color: textColor, anchor: 0.5 });
  totalNode.position.set(0, totalNumCy);
  totalNode.alpha = 0;
  card.addChild(totalNode);
  const COUNT_START = 1.35;
  const COUNT_END = 2.55;
  timeline
    .to(totalNode, { prop: "alpha", from: 0, to: 1, start: COUNT_START, duration: 0.3, ease: outQuad })
    .to(totalNode, { prop: "scale.x", from: 1, to: 1.09, start: COUNT_END, duration: 0.13, ease: outQuad })
    .to(totalNode, { prop: "scale.x", from: 1.09, to: 1, start: COUNT_END + 0.13, duration: 0.24, ease: outQuad })
    .to(totalNode, { prop: "scale.y", from: 1, to: 1.09, start: COUNT_END, duration: 0.13, ease: outQuad })
    .to(totalNode, { prop: "scale.y", from: 1.09, to: 1, start: COUNT_END + 0.13, duration: 0.24, ease: outQuad });

  if (hasTotalLabel) {
    const labelNode = makeText(fonts, { text: totalLabel, role: "body", weight: 600, size: totalLabelSize, color: muted, anchor: 0.5 });
    labelNode.position.set(0, totalLabelCy);
    labelNode.alpha = 0;
    card.addChild(labelNode);
    timeline.to(labelNode, { prop: "alpha", from: 0, to: 0.85, start: COUNT_START + 0.15, duration: 0.4, ease: outQuad });
  }

  const update = (t: number): void => {
    const u = t <= COUNT_START ? 0 : t >= COUNT_END ? 1 : (t - COUNT_START) / (COUNT_END - COUNT_START);
    totalNode.text = `$${groupThousands(total * outCubic(u))}`;

    if (showCoins) {
      for (const c of coins) {
        const tau = t - BURST - c.delay;
        if (tau < 0 || tau > COIN_LIFE) {
          c.g.visible = false;
          continue;
        }
        const p = clamp01(tau / COIN_LIFE);
        const grow = outCubic(p);
        c.g.visible = true;
        c.g.x = Math.cos(c.ang) * c.dist * grow;
        c.g.y = heartCy + Math.sin(c.ang) * c.dist * grow - minDim * 0.05 * p;
        c.g.rotation = c.spin * p;
        c.g.alpha = 1 - p;
      }
    }
  };

  return { timeline, duration: 3.9, update };
}

export const tipJar: TemplateDefinition = {
  id: "tip-jar",
  name: "Tip Jar",
  tagline: "A super-thanks sticker bursts with coins as the total ticks up.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { name: "body", total: "display" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Sender name", default: "Sarah", maxLength: 24, shrinkToFit: true },
    { key: "amount", type: "text", label: "Amount", default: "$5", maxLength: 10 },
    { key: "total", type: "text", label: "Total raised", default: "128", maxLength: 10, help: "Counts up. Digits only — shown as $123." },
    { key: "totalLabel", type: "text", label: "Total caption", default: "raised today", maxLength: 30, optional: true, shrinkToFit: true },
    { key: "showCoins", type: "toggle", label: "Coins popping", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
