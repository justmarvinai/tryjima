import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  inQuad,
  outQuint,
  outCubic,
  makeOutBack,
  spring,
  steps,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Largest size ≤ size0 at which `text` fits `maxWidth` on one crisp line. */
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

// A SaaS waitlist join-flow: an email types itself in, the button presses, and
// the row transforms into a live queue position that counts DOWN a few places.
// (coming-soon is a static teaser; this is the joining moment.)
const PALETTES: Palette[] = [
  { id: "violet-paper", name: "Violet paper", colors: { background: "#F1EEFA", cardColor: "#FFFFFF", textColor: "#1D1433", muted: "#6E6590", inputBg: "#F4F2FA", accent: "#6D3BEA", onAccent: "#FFFFFF" } },
  { id: "mint-launch", name: "Mint launch", colors: { background: "#EAF6F0", cardColor: "#FFFFFF", textColor: "#0D2A1D", muted: "#5F7A6C", inputBg: "#EFF6F1", accent: "#0F7A4E", onAccent: "#FFFFFF" } },
  { id: "coral-beta", name: "Coral beta", colors: { background: "#FDF0EA", cardColor: "#FFFFFF", textColor: "#38160A", muted: "#8A6A5E", inputBg: "#FAF1EC", accent: "#C2481B", onAccent: "#FFFFFF" } },
  { id: "graphite-sky", name: "Graphite sky", colors: { background: "#14161B", cardColor: "#1F232B", textColor: "#FFFFFF", muted: "#8A93A0", inputBg: "#2A2F39", accent: "#4CC2FF", onAccent: "#082A3C" } },
];

const TYPE_START = 1.05;
const TYPE_BUDGET = 1.25;
const PRESS = 2.42;
const SWAP_OUT = 2.72;
const SUCCESS_IN = 2.95;
const BAR_IN = 3.05;
const CD_START = 3.3;
const CD_DUR = 0.9;
const DROPS = 4;
const DURATION = 4.7;

/** Parse the queue position out of a text value ("214" → 214). */
function parsePosition(v: unknown): number {
  if (typeof v === "string") {
    const digits = v.replace(/[^0-9]/g, "");
    if (digits.length > 0) {
      const n = parseInt(digits, 10);
      if (Number.isFinite(n) && n > 0) return Math.min(999999, n);
    }
  }
  return 214;
}

/** A small envelope glyph for the input pill, centered at (0,0). */
function mailGlyph(s: number, color: string): Graphics {
  const w = s;
  const h = s * 0.72;
  const lw = Math.max(2, s * 0.09);
  const g = new Graphics();
  g.roundRect(-w / 2, -h / 2, w, h, s * 0.12).stroke({ color, width: lw });
  g.moveTo(-w / 2 + lw * 0.4, -h / 2 + lw * 0.5)
    .lineTo(0, h * 0.12)
    .lineTo(w / 2 - lw * 0.4, -h / 2 + lw * 0.5)
    .stroke({ color, width: lw, join: "round", cap: "round" });
  return g;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F1EEFA"));
  const cardColor = str(values.cardColor, pc("cardColor", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#1D1433"));
  const muted = pc("muted", "#6E6590");
  const inputBg = pc("inputBg", "#F4F2FA");
  const accent = str(values.accent, pc("accent", "#6D3BEA"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const name = str(values.name, "Lumen");
  const tagline = str(values.tagline, "Get early access");
  const email = str(values.email, "you@example.com");
  const cta = str(values.cta, "Join waitlist");
  const target = parsePosition(values.position);
  const prefix = typeof values.prefix === "string" ? values.prefix : "You're #";
  const suffix = typeof values.suffix === "string" ? values.suffix : "in line";
  const showLogo = values.showLogo !== false;
  const showBar = values.showBar !== false;

  const startPos = target + DROPS;
  const lineFor = (n: number): string => `${prefix}${n}${suffix.length > 0 ? ` ${suffix}` : ""}`;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height / 2;

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Card ---
  const cardW = Math.min(minDim * 0.84, zone.width * 0.94);
  const cardH = cardW * 0.695;
  const cardR = cardW * 0.055;
  const innerW = cardW * 0.78;
  const top = -cardH / 2;

  const yLogo = top + cardW * 0.15;
  const yTag = top + cardW * 0.265;
  const yInput = top + cardW * 0.4;
  const yBtn = top + cardW * 0.555;

  const card = new Container();
  card.position.set(cx, cy);
  root.addChild(card);
  const shadow = new Graphics().roundRect(-cardW / 2, -cardH / 2 + minDim * 0.014, cardW, cardH, cardR).fill({ color: 0x000000, alpha: 0.14 });
  card.addChild(shadow);
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardColor));
  card.alpha = 0;
  card.scale.set(0.93);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.35, ease: outQuad })
    .to(card, { prop: "y", from: cy + minDim * 0.045, to: cy, start: 0.1, duration: 0.7, ease: spring(0.5) })
    .to(card, { prop: "scale.x", from: 0.93, to: 1, start: 0.1, duration: 0.7, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0.93, to: 1, start: 0.1, duration: 0.7, ease: spring(0.5) });

  // --- Logo mark + product name ---
  const markS = cardW * 0.1;
  const nameSize = fitSize(fonts, name, "display", 700, Math.round(cardW * 0.062), innerW - (showLogo ? markS + cardW * 0.035 : 0));
  const nameText = makeText(fonts, { text: name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  const logoRowW = (showLogo ? markS + cardW * 0.035 : 0) + nameText.width;
  const logoLeft = -logoRowW / 2;
  if (showLogo) {
    const mark = new Container();
    mark.addChild(new Graphics().roundRect(-markS / 2, -markS / 2, markS, markS, markS * 0.3).fill(accent));
    mark.addChild(makeIcon("bolt", markS * 0.62, { color: onAccent }));
    mark.position.set(logoLeft + markS / 2, yLogo);
    mark.scale.set(0);
    card.addChild(mark);
    timeline
      .to(mark, { prop: "scale.x", from: 0, to: 1, start: 0.32, duration: 0.5, ease: makeOutBack(2) })
      .to(mark, { prop: "scale.y", from: 0, to: 1, start: 0.32, duration: 0.5, ease: makeOutBack(2) });
  }
  nameText.position.set(logoLeft + (showLogo ? markS + cardW * 0.035 : 0), yLogo);
  nameText.alpha = 0;
  card.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.42, duration: 0.35, ease: outQuad })
    .to(nameText, { prop: "y", from: yLogo + 10, to: yLogo, start: 0.42, duration: 0.5, ease: outQuint });

  // --- Tagline ---
  const tagSize = fitSize(fonts, tagline, "body", 600, Math.round(cardW * 0.034), innerW);
  const tagText = makeText(fonts, { text: tagline, role: "body", weight: 600, size: tagSize, color: muted, anchor: 0.5 });
  tagText.position.set(0, yTag);
  tagText.alpha = 0;
  card.addChild(tagText);
  timeline.to(tagText, { prop: "alpha", from: 0, to: 1, start: 0.55, duration: 0.4, ease: outQuad });

  // --- Email input pill (types the address in) ---
  const inH = cardW * 0.105;
  const inputRow = new Container();
  inputRow.position.set(0, yInput);
  inputRow.addChild(new Graphics().roundRect(-innerW / 2, -inH / 2, innerW, inH, inH / 2).fill(inputBg));
  inputRow.addChild(new Graphics().roundRect(-innerW / 2, -inH / 2, innerW, inH, inH / 2).stroke({ color: muted, width: 2, alpha: 0.4 }));
  const glyphS = inH * 0.42;
  const mail = mailGlyph(glyphS, muted);
  mail.position.set(-innerW / 2 + inH * 0.52, 0);
  inputRow.addChild(mail);
  const typeMaxW = innerW - inH * 1.5 - inH * 0.4;
  const typeSize = fitSize(fonts, `${email}|`, "body", 600, Math.round(inH * 0.34), typeMaxW);
  const typed = makeText(fonts, { text: "", role: "body", weight: 600, size: typeSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  typed.position.set(-innerW / 2 + inH * 0.98, 0);
  inputRow.addChild(typed);
  inputRow.alpha = 0;
  card.addChild(inputRow);
  timeline
    .to(inputRow, { prop: "alpha", from: 0, to: 1, start: 0.72, duration: 0.35, ease: outQuad })
    .to(inputRow, { prop: "y", from: yInput + 14, to: yInput, start: 0.72, duration: 0.5, ease: outQuint })
    // The join-flow hands over to the queue status.
    .to(inputRow, { prop: "alpha", from: 1, to: 0, start: SWAP_OUT, duration: 0.28, ease: outQuad })
    .to(inputRow, { prop: "y", from: yInput, to: yInput - 14, start: SWAP_OUT, duration: 0.3, ease: inQuad });

  // --- Join button (presses, then makes way for the queue bar) ---
  const btnH = cardW * 0.092;
  const ctaSize = fitSize(fonts, cta, "display", 700, Math.round(btnH * 0.38), innerW * 0.8);
  const ctaLabel = makeText(fonts, { text: cta, role: "display", weight: 700, size: ctaSize, color: onAccent, anchor: 0.5 });
  const btnW = Math.max(innerW * 0.5, ctaLabel.width + btnH * 1.2);
  const btn = new Container();
  btn.position.set(0, yBtn);
  btn.addChild(new Graphics().roundRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2).fill(accent));
  btn.addChild(ctaLabel);
  btn.alpha = 0;
  card.addChild(btn);
  timeline
    .to(btn, { prop: "alpha", from: 0, to: 1, start: 0.85, duration: 0.35, ease: outQuad })
    .to(btn, { prop: "y", from: yBtn + 14, to: yBtn, start: 0.85, duration: 0.5, ease: outQuint })
    // Press: dip, release…
    .to(btn, { prop: "scale.x", from: 1, to: 0.92, start: PRESS, duration: 0.1, ease: inQuad })
    .to(btn, { prop: "scale.y", from: 1, to: 0.92, start: PRESS, duration: 0.1, ease: inQuad })
    .to(btn, { prop: "scale.x", from: 0.92, to: 1, start: PRESS + 0.1, duration: 0.18, ease: makeOutBack(2.5) })
    .to(btn, { prop: "scale.y", from: 0.92, to: 1, start: PRESS + 0.1, duration: 0.18, ease: makeOutBack(2.5) })
    // …then fade out for the swap.
    .to(btn, { prop: "alpha", from: 1, to: 0, start: SWAP_OUT, duration: 0.28, ease: outQuad });

  // Press ripple.
  const ripple = new Graphics().roundRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2).stroke({ color: accent, width: 3 });
  ripple.position.set(0, yBtn);
  ripple.alpha = 0;
  card.addChild(ripple);
  timeline
    .to(ripple, { prop: "alpha", from: 0, to: 0.55, start: PRESS + 0.08, duration: 0.06, ease: outQuad })
    .to(ripple, { prop: "alpha", from: 0.55, to: 0, start: PRESS + 0.14, duration: 0.3, ease: outQuad })
    .to(ripple, { prop: "scale.x", from: 1, to: 1.18, start: PRESS + 0.08, duration: 0.36, ease: outCubic })
    .to(ripple, { prop: "scale.y", from: 1, to: 1.35, start: PRESS + 0.08, duration: 0.36, ease: outCubic });

  // --- Queue position line (counts down 218 → 214) ---
  const longest = lineFor(startPos);
  const posSize = fitSize(fonts, longest, "display", 700, Math.round(cardW * 0.047), innerW);
  const posText = makeText(fonts, { text: lineFor(startPos), role: "display", weight: 700, size: posSize, color: textColor, anchor: 0.5, align: "center" });
  const successRow = new Container();
  successRow.position.set(0, yInput);
  successRow.addChild(posText);
  successRow.alpha = 0;
  card.addChild(successRow);
  timeline
    .to(successRow, { prop: "alpha", from: 0, to: 1, start: SUCCESS_IN, duration: 0.35, ease: outQuad })
    .to(successRow, { prop: "y", from: yInput + 16, to: yInput, start: SUCCESS_IN, duration: 0.5, ease: outQuint })
    // A small pulse as the final position lands.
    .to(successRow, { prop: "scale.x", from: 1, to: 1.06, start: CD_START + CD_DUR + 0.05, duration: 0.1, ease: outQuad })
    .to(successRow, { prop: "scale.x", from: 1.06, to: 1, start: CD_START + CD_DUR + 0.15, duration: 0.2, ease: outQuad })
    .to(successRow, { prop: "scale.y", from: 1, to: 1.06, start: CD_START + CD_DUR + 0.05, duration: 0.1, ease: outQuad })
    .to(successRow, { prop: "scale.y", from: 1.06, to: 1, start: CD_START + CD_DUR + 0.15, duration: 0.2, ease: outQuad });

  // --- Queue bar: your marker steps toward the front as the number drops ---
  if (showBar) {
    const bw = innerW;
    const trackH = Math.max(3, cardW * 0.012);
    const barC = new Container();
    barC.position.set(0, yBtn);
    barC.alpha = 0;
    card.addChild(barC);
    timeline.to(barC, { prop: "alpha", from: 0, to: 1, start: BAR_IN, duration: 0.35, ease: outQuad });

    barC.addChild(new Graphics().roundRect(-bw / 2, -trackH / 2, bw, trackH, trackH / 2).fill({ color: muted, alpha: 0.35 }));

    // Front-of-line cap.
    const front = new Container();
    front.addChild(new Graphics().circle(0, 0, cardW * 0.024).fill(accent));
    front.addChild(makeIcon("check", cardW * 0.028, { color: onAccent }));
    front.position.set(-bw / 2, 0);
    front.scale.set(0);
    barC.addChild(front);
    timeline
      .to(front, { prop: "scale.x", from: 0, to: 1, start: BAR_IN + 0.1, duration: 0.4, ease: makeOutBack(2) })
      .to(front, { prop: "scale.y", from: 0, to: 1, start: BAR_IN + 0.1, duration: 0.4, ease: makeOutBack(2) });

    // Queue ahead of you (left of the marker) shrinks in stepped drops.
    const f0 = 0.68;
    const f1 = 0.52;
    const fillG = new Graphics().roundRect(0, -trackH / 2, bw, trackH, trackH / 2).fill({ color: accent, alpha: 0.4 });
    fillG.position.set(-bw / 2, 0);
    fillG.scale.set(f0, 1);
    barC.addChild(fillG);
    timeline.to(fillG, { prop: "scale.x", from: f0, to: f1, start: CD_START, duration: CD_DUR, ease: steps(DROPS) });

    const marker = new Container();
    marker.addChild(new Graphics().circle(0, 0, cardW * 0.02).fill(accent));
    marker.addChild(new Graphics().circle(0, 0, cardW * 0.02).stroke({ color: cardColor, width: Math.max(2, cardW * 0.006) }));
    const youLabel = makeText(fonts, { text: "you", role: "body", weight: 700, size: Math.round(cardW * 0.026), color: muted, anchor: { x: 0.5, y: 1 } });
    youLabel.position.set(0, -cardW * 0.032);
    marker.addChild(youLabel);
    const x0 = -bw / 2 + bw * f0;
    const x1 = -bw / 2 + bw * f1;
    marker.position.set(x0, 0);
    marker.scale.set(0);
    barC.addChild(marker);
    timeline
      .to(marker, { prop: "scale.x", from: 0, to: 1, start: BAR_IN + 0.18, duration: 0.4, ease: makeOutBack(2) })
      .to(marker, { prop: "scale.y", from: 0, to: 1, start: BAR_IN + 0.18, duration: 0.4, ease: makeOutBack(2) })
      .to(marker, { prop: "x", from: x0, to: x1, start: CD_START, duration: CD_DUR, ease: steps(DROPS) });
  }

  // --- Pure per-frame hook: typewriter + stepped count-down ---
  const perChar = TYPE_BUDGET / Math.max(1, email.length);
  const update = (t: number): void => {
    const elapsed = t - TYPE_START;
    const shown = elapsed <= 0 ? 0 : Math.min(email.length, Math.floor(elapsed / perChar));
    const blinkOn = t >= TYPE_START - 0.15 && t < PRESS + 0.1 && t % 0.8 < 0.45;
    typed.text = email.slice(0, shown) + (blinkOn ? "|" : "");

    // Mirrors the steps(DROPS) easing on the bar so number and marker agree.
    const u = clamp01((t - CD_START) / CD_DUR);
    const k = t < CD_START ? 0 : Math.min(DROPS, Math.floor(u * DROPS));
    posText.text = lineFor(startPos - k);
  };

  return { timeline, duration: DURATION, update };
}

export const waitlistCard: TemplateDefinition = {
  id: "waitlist-card",
  name: "Waitlist",
  tagline: "An email types in, the button presses, and your queue spot counts down.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 4.6,
  fontRoles: { name: "display", cta: "display" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Product name", default: "Lumen", maxLength: 20, shrinkToFit: true },
    { key: "tagline", type: "text", label: "Tagline", default: "Get early access", maxLength: 40, shrinkToFit: true },
    { key: "email", type: "text", label: "Typed email", default: "you@example.com", maxLength: 28 },
    { key: "cta", type: "text", label: "Button", default: "Join waitlist", maxLength: 18, shrinkToFit: true },
    { key: "position", type: "text", label: "Queue position", default: "214", maxLength: 6, help: "Counts down the last 4 places to land here." },
    { key: "prefix", type: "text", label: "Before the number", default: "You're #", maxLength: 16, optional: true },
    { key: "suffix", type: "text", label: "After the number", default: "in line", maxLength: 16, optional: true },
    { key: "showLogo", type: "toggle", label: "Logo mark", default: true },
    { key: "showBar", type: "toggle", label: "Queue bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "cardColor", type: "color", label: "Card", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
