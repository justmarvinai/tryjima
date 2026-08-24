import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { avatar } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);

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

function wrapText(
  fonts: FontRegistry,
  o: { text: string; role: FontRole; weight: number; size: number; color: string; width: number; lineHeight: number },
): Text {
  const t = makeText(fonts, { text: o.text, role: o.role, weight: o.weight, size: o.size, color: o.color, align: "left", anchor: { x: 0, y: 0 }, lineHeight: o.lineHeight });
  t.style.wordWrap = true;
  t.style.wordWrapWidth = o.width;
  return t;
}

// A verified-review card: avatar, name, a check, filling stars, and a quote. The
// card uses its own `cardBg`; the verified check circle uses the accent with a
// white glyph. Text sits on cardBg at ≥4.5:1.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#EEF1F7", textColor: "#0F1420", accent: "#3B4FD6", onAccent: "#FFFFFF", cardBg: "#FFFFFF", muted: "#CBD2DE", roleColor: "#5B6472", star: "#F5A623" } },
  { id: "cream", name: "Cream", colors: { background: "#F6EEE2", textColor: "#241A12", accent: "#C2410C", onAccent: "#FFFFFF", cardBg: "#FFFFFF", muted: "#E4D9C8", roleColor: "#7A6144", star: "#E8850C" } },
  { id: "mint", name: "Mint", colors: { background: "#E4F3EB", textColor: "#0B241A", accent: "#0A6B3A", onAccent: "#FFFFFF", cardBg: "#FFFFFF", muted: "#C4D9CD", roleColor: "#4C6B5C", star: "#0A9E52" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C1018", textColor: "#F2F5FA", accent: "#6EA8FE", onAccent: "#0C1018", cardBg: "#161C28", muted: "#38414F", roleColor: "#A7B0BF", star: "#F5B841" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F7"));
  const textColor = str(values.textColor, pc("textColor", "#0F1420"));
  const accent = str(values.accent, pc("accent", "#3B4FD6"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const cardBg = pc("cardBg", "#FFFFFF");
  const muted = pc("muted", "#CBD2DE");
  const roleColor = pc("roleColor", "#5B6472");
  const starColor = pc("star", "#F5A623");

  const name = str(values.name, "Alex Morgan");
  const quote = str(values.quote, "Exactly what I needed — polished results in minutes, zero fuss.");
  const rating = Math.max(1, Math.min(5, Math.round(num(values.rating, 5))));
  const showVerified = values.showVerified !== false;

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height * 0.5;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const cardW = Math.min(zone.width * 0.86, minDim * 0.82);
  const cardH = Math.min(zone.height * 0.72, minDim * 0.62);
  const cardR = Math.round(minDim * 0.03);
  const pad = cardW * 0.075;

  const card = new Container();
  card.position.set(cx, cy);
  card.scale.set(0);
  root.addChild(card);
  const e = Math.round(minDim * 0.006);
  const off = Math.round(minDim * 0.012);
  card.addChild(new Graphics().roundRect(-cardW / 2 - e, -cardH / 2 - e + off, cardW + e * 2, cardH + e * 2, cardR + e).fill({ color: "#000000", alpha: 0.12 }));
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardBg));
  timeline
    .to(card, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.5, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.5, ease: makeOutBack(1.5) });

  const left = -cardW / 2 + pad;
  const top = -cardH / 2 + pad;

  // --- Header: avatar + name (+ verified) ---
  const rA = cardW * 0.075;
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  const av = avatar(fonts, { radius: rA, bg: accent, initial, textColor: onAccent });
  av.position.set(left + rA, top + rA);
  av.scale.set(0);
  card.addChild(av);
  timeline
    .to(av, { prop: "scale.x", from: 0, to: 1, start: 0.4, duration: 0.45, ease: makeOutBack(1.7) })
    .to(av, { prop: "scale.y", from: 0, to: 1, start: 0.4, duration: 0.45, ease: makeOutBack(1.7) });

  const nameSize = fitSize(fonts, name, "display", 700, Math.round(cardW * 0.05), cardW - pad * 2 - rA * 2 - cardW * 0.14);
  const nameX = left + rA * 2 + pad * 0.5;
  const nameText = makeText(fonts, { text: name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  nameText.position.set(nameX, top + rA - nameSize * 0.15);
  nameText.alpha = 0;
  card.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "x", from: nameX - 10, to: nameX, start: 0.5, duration: 0.4, ease: outExpo });

  if (showVerified) {
    const nameW = fonts.measure(name, { family: fonts.family("display"), weight: 700, size: nameSize });
    const vR = nameSize * 0.44;
    const vx = Math.min(nameX + nameW + vR * 1.6, cardW / 2 - pad - vR);
    const vBadge = new Container();
    vBadge.position.set(vx, top + rA - nameSize * 0.15);
    vBadge.scale.set(0);
    card.addChild(vBadge);
    vBadge.addChild(new Graphics().circle(0, 0, vR).fill(accent));
    vBadge.addChild(makeIcon("check", vR * 1.2, { color: onAccent }));
    timeline
      .to(vBadge, { prop: "scale.x", from: 0, to: 1, start: 0.75, duration: 0.4, ease: makeOutBack(2) })
      .to(vBadge, { prop: "scale.y", from: 0, to: 1, start: 0.75, duration: 0.4, ease: makeOutBack(2) });

    const vLabel = makeText(fonts, { text: "Verified review", role: "body", weight: 500, size: Math.round(nameSize * 0.5), color: roleColor, anchor: { x: 0, y: 0.5 } });
    vLabel.position.set(nameX, top + rA + nameSize * 0.62);
    vLabel.alpha = 0;
    card.addChild(vLabel);
    timeline.to(vLabel, { prop: "alpha", from: 0, to: 0.85, start: 0.9, duration: 0.4, ease: outQuad });
  }

  // --- Star row (fills to rating) ---
  const starSize = Math.round(cardW * 0.062);
  const starGap = starSize * 1.28;
  const starsY = top + rA * 2 + cardH * 0.13;
  for (let i = 0; i < 5; i++) {
    const holder = new Container();
    holder.addChild(makeIcon("star", starSize, { color: i < rating ? starColor : muted }));
    holder.position.set(left + starSize / 2 + i * starGap, starsY);
    holder.scale.set(0);
    card.addChild(holder);
    const start = 0.95 + i * 0.11;
    timeline
      .to(holder, { prop: "scale.x", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(1.9) })
      .to(holder, { prop: "scale.y", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(1.9) });
  }

  // --- Quote ---
  const quoteSize = Math.round(cardW * 0.05);
  const quoteBlock = wrapText(fonts, { text: `“${quote}”`, role: "serif", weight: 600, size: quoteSize, color: textColor, width: cardW - pad * 2, lineHeight: Math.round(quoteSize * 1.36) });
  quoteBlock.position.set(left, starsY + starSize * 0.9);
  quoteBlock.alpha = 0;
  card.addChild(quoteBlock);
  timeline
    .to(quoteBlock, { prop: "alpha", from: 0, to: 1, start: 1.55, duration: 0.5, ease: outQuad })
    .to(quoteBlock, { prop: "y", from: starsY + starSize * 0.9 + 12, to: starsY + starSize * 0.9, start: 1.55, duration: 0.5, ease: outExpo });

  return { timeline, duration: 4.2 };
}

export const reviewBadge: TemplateDefinition = {
  id: "review-badge",
  name: "Review Badge",
  tagline: "A verified-review card with filling stars and a quote.",
  category: "testimonial",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { name: "display" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Name", default: "Alex Morgan", maxLength: 26, shrinkToFit: true },
    { key: "quote", type: "textarea", label: "Quote", default: "Exactly what I needed — polished results in minutes, zero fuss.", maxLength: 140, shrinkToFit: true },
    { key: "rating", type: "slider", label: "Rating", default: 5, min: 1, max: 5, step: 1 },
    { key: "showVerified", type: "toggle", label: "Verified check", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
