import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
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

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);

// `accent` only ever fills icon chips (plus glyph, not text), so it carries no
// text-contrast requirement here — textColor/cardBg (always a safe light/dark
// pair) is the only real text.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#EEF1F6", cardBg: "#FFFFFF", textColor: "#101014", muted: "#6B7280", accent: "#1E56C4" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C0C10", cardBg: "#1C1C22", textColor: "#FFFFFF", muted: "#9098A6", accent: "#6D28D9" } },
  { id: "mint", name: "Mint", colors: { background: "#E7F7EF", cardBg: "#FFFFFF", textColor: "#08221A", muted: "#4F6960", accent: "#0F7A55" } },
  { id: "blush", name: "Blush", colors: { background: "#FCEDF3", cardBg: "#FFFFFF", textColor: "#3A0A28", muted: "#8A6478", accent: "#B01D5C" } },
];

const AVATAR_HUES = ["#1E56C4", "#6D28D9", "#0F7A55", "#C2410C", "#B01D5C"];

const CTA_POP_START = 0.85;
const CTA_POP_DUR = 0.5;
const PULSE_START = CTA_POP_START + CTA_POP_DUR + 0.1;
const PULSE_PERIOD = 1.15;
const PULSE_AMP = 0.045;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F6"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const muted = pc("muted", "#6B7280");
  const accent = str(values.accent, pc("accent", "#1E56C4"));

  const prompt = str(values.prompt, "your setup");
  const participants = Math.max(2, Math.min(5, Math.round(num(values.participants, 4))));
  const showAvatars = values.showAvatars !== false;

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
  const cardPadY = Math.round(cardW * 0.09);
  const availW = cardW - cardPadX * 2;

  const eyebrowIconD = Math.round(minDim * 0.036);
  const eyebrowFontSize = Math.round(minDim * 0.028);
  const eyebrowGap = eyebrowFontSize * 0.5;
  const eyebrowLabel = "ADD YOURS";
  const eyebrowTextWidth = measureBody(eyebrowLabel, eyebrowFontSize);
  const eyebrowW = eyebrowIconD + eyebrowGap + eyebrowTextWidth;
  const eyebrowH = eyebrowIconD * 1.3;

  const promptFull = `Add yours: ${prompt}`;
  const promptBase = Math.round(minDim * 0.05);
  const promptSize = shrinkToFit(promptFull, measureDisplay, { maxWidth: availW, baseSize: promptBase, minSize: Math.round(promptBase * 0.5) });
  const promptH = promptSize * 1.3;

  const avatarR = Math.round(cardW * 0.052);
  const ctaR = Math.round(avatarR * 1.3);
  const rowH = ctaR * 2.4;

  const gap1 = Math.round(minDim * 0.02);
  const gap2 = Math.round(minDim * 0.034);

  const innerH = eyebrowH + gap1 + promptH + gap2 + rowH;
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
  const promptCy = cursor + promptH / 2;
  cursor += promptH + gap2;
  const rowCy = cursor + rowH / 2;

  // --- Eyebrow: small "+" chip + "ADD YOURS" ---
  const eyebrow = new Container();
  const chip = new Container();
  chip.addChild(new Graphics().circle(0, 0, eyebrowIconD / 2).fill(accent));
  chip.addChild(makeIcon("plus", eyebrowIconD * 0.5, { color: "#FFFFFF" }));
  chip.position.set(-eyebrowW / 2 + eyebrowIconD / 2, 0);
  eyebrow.addChild(chip);
  const eyebrowText = makeText(fonts, { text: eyebrowLabel, role: "body", weight: 700, size: eyebrowFontSize, color: muted, anchor: { x: 0, y: 0.5 }, letterSpacing: 1 });
  eyebrowText.position.set(-eyebrowW / 2 + eyebrowIconD + eyebrowGap, 0);
  eyebrow.addChild(eyebrowText);
  eyebrow.position.set(0, eyebrowCy);
  eyebrow.alpha = 0;
  card.addChild(eyebrow);
  timeline
    .to(eyebrow, { prop: "alpha", from: 0, to: 1, start: 0.28, duration: 0.32, ease: outQuad })
    .to(eyebrow, { prop: "y", from: eyebrowCy + 10, to: eyebrowCy, start: 0.28, duration: 0.4, ease: outExpo });

  // --- Prompt ---
  const promptNode = makeText(fonts, { text: promptFull, role: "display", weight: 700, size: promptSize, color: textColor, anchor: 0.5, align: "center" });
  promptNode.position.set(0, promptCy);
  promptNode.alpha = 0;
  card.addChild(promptNode);
  timeline
    .to(promptNode, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.35, ease: outQuad })
    .to(promptNode, { prop: "y", from: promptCy + 14, to: promptCy, start: 0.5, duration: 0.5, ease: outExpo });

  // --- Avatar-fan row + "+" CTA ---
  const step = avatarR * 1.35;
  const ctaGap = avatarR + ctaR * 0.85;
  const lastAvatarX = showAvatars ? (participants - 1) * step : 0;
  const ctaX0 = showAvatars ? lastAvatarX + ctaGap : 0;
  const groupLeft = showAvatars ? -avatarR : -ctaR;
  const groupRight = ctaX0 + ctaR;
  const centerOffset = (groupLeft + groupRight) / 2;

  const row = new Container();
  row.position.set(0, rowCy);
  card.addChild(row);

  // "+" CTA — settles into place first, then breathes continuously.
  const ctaFinalX = ctaX0 - centerOffset;
  const ctaNode = new Container();
  ctaNode.addChild(new Graphics().circle(0, 0, ctaR).fill(accent));
  ctaNode.addChild(new Graphics().circle(0, 0, ctaR).stroke({ color: cardBg, width: Math.max(2, ctaR * 0.12) }));
  ctaNode.addChild(makeIcon("plus", ctaR * 1.05, { color: "#FFFFFF" }));
  ctaNode.position.set(ctaFinalX, 0);
  ctaNode.alpha = 0;
  ctaNode.scale.set(0.3);
  row.addChild(ctaNode);
  timeline
    .to(ctaNode, { prop: "alpha", from: 0, to: 1, start: CTA_POP_START, duration: 0.3, ease: outQuad })
    .to(ctaNode, { prop: "scale.x", from: 0.3, to: 1, start: CTA_POP_START, duration: CTA_POP_DUR, ease: makeOutBack(2.2) })
    .to(ctaNode, { prop: "scale.y", from: 0.3, to: 1, start: CTA_POP_START, duration: CTA_POP_DUR, ease: makeOutBack(2.2) });

  // Avatars fan out from the CTA's position into their overlapping row slots.
  if (showAvatars) {
    const FAN_START = CTA_POP_START + CTA_POP_DUR + 0.05;
    const FAN_STEP = 0.13;
    const FAN_DUR = 0.55;
    for (let i = 0; i < participants; i++) {
      const finalX = i * step - centerOffset;
      const avatar = new Container();
      avatar.addChild(new Graphics().circle(0, 0, avatarR).fill(rng.pick(AVATAR_HUES)));
      avatar.addChild(new Graphics().circle(0, 0, avatarR).stroke({ color: cardBg, width: Math.max(2, avatarR * 0.14) }));
      avatar.position.set(ctaFinalX, 0);
      avatar.alpha = 0;
      avatar.scale.set(0.5);
      avatar.rotation = -14 * DEG;
      row.addChild(avatar);
      // Keep the CTA on top as each avatar joins (avatars stack in arrival
      // order beneath it, so later ones overlap earlier ones left-to-right).
      row.setChildIndex(ctaNode, row.children.length - 1);

      const start = FAN_START + (participants - 1 - i) * FAN_STEP;
      timeline
        .to(avatar, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
        .to(avatar, { prop: "x", from: ctaFinalX, to: finalX, start, duration: FAN_DUR, ease: spring(0.5) })
        .to(avatar, { prop: "scale.x", from: 0.5, to: 1, start, duration: FAN_DUR, ease: makeOutBack(1.8) })
        .to(avatar, { prop: "scale.y", from: 0.5, to: 1, start, duration: FAN_DUR, ease: makeOutBack(1.8) })
        .to(avatar, { prop: "rotation", from: -14 * DEG, to: 0, start, duration: FAN_DUR, ease: outExpo });
    }
  }

  const update = (t: number): void => {
    if (t >= PULSE_START) {
      const phase = ((t - PULSE_START) / PULSE_PERIOD) * Math.PI * 2;
      ctaNode.scale.set(1 + PULSE_AMP * Math.sin(phase));
    }
  };

  return { timeline, duration: 3.6, update };
}

export const addYours: TemplateDefinition = {
  id: "add-yours",
  name: "Add Yours",
  tagline: "An \"Add Yours\" chain sticker fans out friends around a pulsing +.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { prompt: "display" },
  palettes: PALETTES,
  fields: [
    { key: "prompt", type: "text", label: "Prompt", default: "your setup", maxLength: 30, shrinkToFit: true },
    { key: "participants", type: "slider", label: "Friends shown", default: 4, min: 2, max: 5, step: 1 },
    { key: "showAvatars", type: "toggle", label: "Avatar fan", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
