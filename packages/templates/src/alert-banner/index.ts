import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  makeOutBack,
  safeZone,
  TRANSPARENT_BG,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon, type IconName } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Shrink a single-line size so `text` fits `maxWidth`. */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

interface ToneSpec {
  accent: string;
  accentText: string;
  icon: IconName;
}

// `tone` maps straight to an accent + icon pair, independent of the chosen
// palette, so info/success/warning always read as the same color language no
// matter which card look is picked. `accentText` is fixed (contrast-checked
// against its own accent below), not user-editable.
const TONES: Record<string, ToneSpec> = {
  info: { accent: "#2E7DF6", accentText: "#101014", icon: "bell" },
  success: { accent: "#1FA463", accentText: "#101014", icon: "check" },
  warning: { accent: "#E0A100", accentText: "#101014", icon: "bolt" },
};

function toneOf(tone: string): ToneSpec {
  return TONES[tone] ?? TONES.info!;
}

// A top drop-down alert/notification banner — a floating rounded card slides
// down from the top edge with a tone-colored icon badge, a bold title +
// message, and a soft pulsing glow. Only the full-frame `bg` rect is tied to
// the background field (defaults to the transparent sentinel so it
// composites straight onto footage); the card uses its own palette-only
// `bannerBg` surface so the notification stays legible once the canvas fill
// is gone.
const PALETTES: Palette[] = [
  { id: "midnight", name: "Midnight", colors: { bannerBg: "#17171C", textColor: "#FFFFFF" } },
  { id: "paper", name: "Paper", colors: { bannerBg: "#FFFFFF", textColor: "#101014" } },
  { id: "navy", name: "Navy", colors: { bannerBg: "#0B1F3D", textColor: "#FFFFFF" } },
  { id: "cream", name: "Cream", colors: { bannerBg: "#FFF8EC", textColor: "#241C10" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const bannerBg = pc("bannerBg", "#17171C");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const tone = toneOf(str(values.tone, "info"));
  const accent = str(values.accent, tone.accent);
  const title = str(values.title, "Achievement unlocked");
  const message = str(values.message, "You just hit 10K followers!");
  const showIcon = values.showIcon !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const cardW = w - zone.left - zone.right;
  const padX = Math.round(minDim * 0.034);
  const padY = Math.round(minDim * 0.028);
  const stripeW = Math.max(3, Math.round(minDim * 0.009));
  const stripeGap = Math.round(minDim * 0.022);
  const iconR = Math.round(minDim * 0.034);
  const gapIconText = Math.round(minDim * 0.026);
  const rowGap = Math.round(minDim * 0.008);

  const iconBlockW = showIcon ? iconR * 2 + gapIconText : 0;
  const leadW = stripeW + stripeGap + iconBlockW;
  const maxTextW = Math.max(120, cardW - padX * 2 - leadW);

  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.036), maxTextW);
  const msgSize = message.length > 0 ? fitSize(fonts, message, "body", 500, Math.round(minDim * 0.024), maxTextW) : 0;

  const textRowsH = message.length > 0 ? titleSize + rowGap + msgSize : titleSize;
  const contentH = Math.max(showIcon ? iconR * 2 : 0, textRowsH);
  const cardH = padY * 2 + contentH;
  const cardRadius = Math.round(minDim * 0.022);

  const marginTop = Math.round(minDim * 0.03);
  const restX = w / 2;
  const restY = zone.top + marginTop + cardH / 2;
  const startY = restY - (cardH + minDim * 0.08);

  const card = new Container();
  card.position.set(restX, startY);
  card.alpha = 0;
  root.addChild(card);

  // Soft shadow so the card reads as a distinct surface over any footage.
  const e = Math.round(cardRadius * 0.3);
  const off = Math.round(cardRadius * 0.55);
  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2 - e, -cardH / 2 - e + off, cardW + e * 2, cardH + e * 2, cardRadius + e)
      .fill({ color: "#000000", alpha: 0.2 }),
  );
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardRadius).fill(bannerBg));

  // --- Left accent stripe (permanent — the card's tone identity). ---
  const leftEdge = -cardW / 2 + padX;
  const stripeH = cardH * 0.6;
  const stripe = new Graphics().roundRect(0, 0, stripeW, stripeH, stripeW / 2).fill(accent);
  stripe.position.set(leftEdge, -stripeH / 2);
  card.addChild(stripe);

  let cursorX = leftEdge + stripeW + stripeGap;

  // --- Icon badge (toggleable) with a soft pulsing glow ring. ---
  let ring: Graphics | undefined;
  let badge: Container | undefined;
  if (showIcon) {
    const badgeX = cursorX + iconR;
    ring = new Graphics().circle(0, 0, iconR).stroke({ color: accent, width: Math.max(1.5, iconR * 0.2) });
    ring.position.set(badgeX, 0);
    ring.alpha = 0;
    card.addChild(ring);

    badge = new Container();
    badge.position.set(badgeX, 0);
    badge.scale.set(0);
    card.addChild(badge);
    badge.addChild(new Graphics().circle(0, 0, iconR).fill(accent));
    badge.addChild(makeIcon(tone.icon, iconR * 1.05, { color: tone.accentText }));

    cursorX += iconR * 2 + gapIconText;
  }

  const textX = cursorX;
  const blockH = textRowsH;
  const titleY = message.length > 0 ? -blockH / 2 + titleSize / 2 : 0;
  const msgY = message.length > 0 ? blockH / 2 - msgSize / 2 : 0;

  const titleText = makeText(fonts, {
    text: title,
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  titleText.position.set(textX, titleY);
  card.addChild(titleText);

  if (message.length > 0) {
    const msgText = makeText(fonts, {
      text: message,
      role: "body",
      weight: 500,
      size: msgSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    msgText.alpha = 0.78;
    msgText.position.set(textX, msgY);
    card.addChild(msgText);
  }

  // --- Entrance: the card drops down from above the frame, with a soft fade. ---
  const enterStart = 0.1;
  const enterDur = 0.55;
  const landTime = enterStart + enterDur;
  timeline
    .to(card, { prop: "y", from: startY, to: restY, start: enterStart, duration: enterDur, ease: makeOutBack(1.3) })
    .to(card, { prop: "alpha", from: 0, to: 1, start: enterStart, duration: 0.3, ease: outQuad });

  // --- Icon badge pops in just as the card lands (toggleable). ---
  if (badge) {
    const popStart = enterStart + enterDur * 0.8;
    timeline
      .to(badge, { prop: "scale.x", from: 0, to: 1, start: popStart, duration: 0.4, ease: makeOutBack(2.2) })
      .to(badge, { prop: "scale.y", from: 0, to: 1, start: popStart, duration: 0.4, ease: makeOutBack(2.2) });
  }

  // --- Soft pulsing glow ring around the icon (toggleable, pure fn of t). ---
  const PULSE_PERIOD = 1.3;
  const update = (t: number): void => {
    if (!ring) return;
    if (t < landTime) {
      ring.alpha = 0;
      return;
    }
    const u = ((t - landTime) % PULSE_PERIOD) / PULSE_PERIOD;
    ring.scale.set(1 + 0.5 * u);
    ring.alpha = 0.5 * Math.sin(u * Math.PI);
  };

  return { timeline, duration: 4.2, update };
}

export const alertBanner: TemplateDefinition = {
  id: "alert-banner",
  name: "Alert Banner",
  tagline: "A drop-down notification banner with a tone-colored icon and a soft pulse.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { title: "display", message: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Achievement unlocked", maxLength: 32, shrinkToFit: true },
    { key: "message", type: "text", label: "Message", default: "You just hit 10K followers!", maxLength: 56, optional: true, shrinkToFit: true },
    {
      key: "tone",
      type: "select",
      label: "Tone",
      default: "success",
      options: [
        { value: "info", label: "Info" },
        { value: "success", label: "Success" },
        { value: "warning", label: "Warning" },
      ],
    },
    { key: "showIcon", type: "toggle", label: "Status icon", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
