import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  spring,
  fitBox,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Rough perceived luminance of a #rrggbb color (0..1). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const PALETTES: Palette[] = [
  { id: "midnight", name: "Midnight", colors: { background: "#0A0A10", senderBubble: "#FF2E9E", replierBubble: "#2E7DF6", textColor: "#FFFFFF" } },
  { id: "noir-violet", name: "Noir violet", colors: { background: "#0C0A16", senderBubble: "#C13DFF", replierBubble: "#33D9F0", textColor: "#FFFFFF" } },
  { id: "blackout-ember", name: "Blackout ember", colors: { background: "#100A08", senderBubble: "#FF6A3D", replierBubble: "#2ED8B8", textColor: "#FFFFFF" } },
  { id: "deep-rose", name: "Deep rose", colors: { background: "#120810", senderBubble: "#FF4FA3", replierBubble: "#5B8CFF", textColor: "#FFFFFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0A0A10"));
  const senderBubble = str(values.senderBubble, pc("senderBubble", "#FF2E9E"));
  const replierBubble = str(values.replierBubble, pc("replierBubble", "#2E7DF6"));
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const onSender = luminance(senderBubble) < 0.5 ? "#FFFFFF" : "#101014";
  const onReplier = luminance(replierBubble) < 0.5 ? "#FFFFFF" : "#101014";
  const senderName = str(values.sender, "Sender");
  const replierName = str(values.replier, "Replier");
  const msg1 = str(values.msg1, "Heyy, bro!");
  const msg2 = str(values.msg2, "Yooo, what are you doing tonight? Let's make some content?");
  const showCaret = values.showCaret !== false;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  // Subtle radial vignette/glow, centered.
  const glow = new Sprite(radialGlowTexture());
  glow.anchor.set(0.5);
  glow.tint = "#FFFFFF";
  const glowSize = Math.max(size.width, size.height) * 1.5;
  glow.width = glowSize;
  glow.height = glowSize;
  glow.alpha = 0.1;
  glow.position.set(size.width / 2, size.height * 0.42);
  root.addChild(glow);

  const timeline = new JimaTimeline();
  timeline.to(glow, { prop: "alpha", from: 0.1, to: 0.17, start: 0, duration: 3.2, ease: outQuad });

  const minDim = Math.min(size.width, size.height);
  const k = minDim / 1080;
  const safe = safeRect(ctx.aspect);

  const avatarR = 46 * k;
  const avatarGap = 16 * k;
  const padX = 34 * k;
  const padY = 26 * k;
  const nameSize = Math.round(27 * k);
  const nameLineH = Math.round(nameSize * 1.3);
  const gapNameBubble = 10 * k;
  const msgSize0 = Math.round(40 * k);
  const bubbleRadius = 30 * k;
  const tailLen = 16 * k;

  const maxBubbleW = Math.min(safe.width - (avatarR * 2 + avatarGap) - 16 * k, minDim * 0.58);
  const maxTextW = maxBubbleW - padX * 2;

  const familyBody = fonts.family("body");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family: familyBody, weight: 500, size: sz });

  const fit1 = fitBox(msg1, measure, { maxWidth: maxTextW, baseSize: msgSize0, minSize: Math.round(msgSize0 * 0.6), maxLines: 2 });
  const fit2 = fitBox(msg2, measure, { maxWidth: maxTextW, baseSize: msgSize0, minSize: Math.round(msgSize0 * 0.6), maxLines: 3 });

  const lh1 = Math.round(fit1.fontSize * 1.3);
  const lh2 = Math.round(fit2.fontSize * 1.3);
  const widest1 = Math.max(...fit1.lines.map((l) => measure(l, fit1.fontSize)));
  const widest2 = Math.max(...fit2.lines.map((l) => measure(l, fit2.fontSize)));
  const w1 = Math.min(maxBubbleW, widest1 + padX * 2);
  const w2 = Math.min(maxBubbleW, widest2 + padX * 2);
  const h1 = fit1.lines.length * lh1 + padY * 2;
  const h2 = fit2.lines.length * lh2 + padY * 2;

  const gapMessages = 40 * k;
  const totalH = nameLineH + gapNameBubble + h1 + gapMessages + nameLineH + gapNameBubble + h2;
  const top = safe.y + Math.max(0, (safe.height - totalH) / 2);

  const label1CY = top + nameLineH / 2;
  const bubble1CY = top + nameLineH + gapNameBubble + h1 / 2;
  const label2CY = bubble1CY + h1 / 2 + gapMessages + nameLineH / 2;
  const bubble2CY = label2CY + nameLineH / 2 + gapNameBubble + h2 / 2;

  const rightEdge = safe.x + safe.width;
  const leftEdge = safe.x;
  const bubble1CX = rightEdge - (avatarR * 2 + avatarGap) - w1 / 2;
  const avatar1CX = rightEdge - avatarR;
  const bubble2CX = leftEdge + (avatarR * 2 + avatarGap) + w2 / 2;
  const avatar2CX = leftEdge + avatarR;

  const riseAmt = 40 * k;

  // --- Sender name label (right-aligned above its bubble) ---
  const label1 = makeText(fonts, { text: senderName, role: "body", weight: 600, size: nameSize, color: textColor, anchor: 0.5, align: "center" });
  label1.alpha = 0;
  label1.position.set(bubble1CX, label1CY + 14 * k);
  root.addChild(label1);
  timeline
    .to(label1, { prop: "alpha", from: 0, to: 0.62, start: 0.15, duration: 0.35, ease: outQuad })
    .to(label1, { prop: "y", from: label1CY + 14 * k, to: label1CY, start: 0.15, duration: 0.5, ease: outExpo });

  // --- Sender avatar ---
  const av1 = new Container();
  av1.addChild(new Graphics().circle(0, 0, avatarR).fill(senderBubble));
  av1.addChild(makeIcon("user", avatarR * 1.15, { color: onSender }));
  av1.position.set(avatar1CX, bubble1CY);
  av1.scale.set(0);
  root.addChild(av1);
  timeline
    .to(av1, { prop: "scale.x", from: 0, to: 1, start: 0.32, duration: 0.55, ease: makeOutBack(1.8) })
    .to(av1, { prop: "scale.y", from: 0, to: 1, start: 0.32, duration: 0.55, ease: makeOutBack(1.8) });

  // --- Sender bubble (pink/magenta, static text) ---
  const bubble1 = new Container();
  bubble1.addChild(new Graphics().roundRect(-w1 / 2, -h1 / 2, w1, h1, bubbleRadius).fill(senderBubble));
  bubble1.addChild(
    new Graphics()
      .poly([w1 / 2, h1 / 2 - tailLen * 1.6, w1 / 2 + tailLen, h1 / 2 - tailLen * 0.5, w1 / 2, h1 / 2 + tailLen * 0.15])
      .fill(senderBubble),
  );
  const text1 = makeText(fonts, {
    text: fit1.lines.join("\n"),
    role: "body",
    weight: 500,
    size: fit1.fontSize,
    color: onSender,
    anchor: { x: 0, y: 0 },
    lineHeight: lh1,
    align: "left",
  });
  text1.position.set(-w1 / 2 + padX, -h1 / 2 + padY);
  bubble1.addChild(text1);
  bubble1.position.set(bubble1CX, bubble1CY + riseAmt);
  bubble1.alpha = 0;
  bubble1.scale.set(0.7);
  root.addChild(bubble1);

  const B1 = 0.3;
  timeline
    .to(bubble1, { prop: "alpha", from: 0, to: 1, start: B1, duration: 0.3, ease: outQuad })
    .to(bubble1, { prop: "y", from: bubble1CY + riseAmt, to: bubble1CY, start: B1, duration: 0.6, ease: spring(0.5) })
    .to(bubble1, { prop: "scale.x", from: 0.7, to: 1, start: B1, duration: 0.55, ease: makeOutBack(1.7) })
    .to(bubble1, { prop: "scale.y", from: 0.7, to: 1, start: B1, duration: 0.55, ease: makeOutBack(1.7) });

  // --- Replier name label (left-aligned above its bubble) ---
  const label2 = makeText(fonts, { text: replierName, role: "body", weight: 600, size: nameSize, color: textColor, anchor: 0.5, align: "center" });
  label2.alpha = 0;
  label2.position.set(bubble2CX, label2CY + 14 * k);
  root.addChild(label2);
  const L2_START = 0.85;
  timeline
    .to(label2, { prop: "alpha", from: 0, to: 0.62, start: L2_START, duration: 0.35, ease: outQuad })
    .to(label2, { prop: "y", from: label2CY + 14 * k, to: label2CY, start: L2_START, duration: 0.5, ease: outExpo });

  // --- Replier avatar ---
  const av2 = new Container();
  av2.addChild(new Graphics().circle(0, 0, avatarR).fill(replierBubble));
  av2.addChild(makeIcon("user", avatarR * 1.15, { color: onReplier }));
  av2.position.set(avatar2CX, bubble2CY);
  av2.scale.set(0);
  root.addChild(av2);
  timeline
    .to(av2, { prop: "scale.x", from: 0, to: 1, start: L2_START + 0.17, duration: 0.55, ease: makeOutBack(1.8) })
    .to(av2, { prop: "scale.y", from: 0, to: 1, start: L2_START + 0.17, duration: 0.55, ease: makeOutBack(1.8) });

  // --- Replier bubble (blue, typed live) ---
  const bubble2 = new Container();
  bubble2.addChild(new Graphics().roundRect(-w2 / 2, -h2 / 2, w2, h2, bubbleRadius).fill(replierBubble));
  bubble2.addChild(
    new Graphics()
      .poly([-w2 / 2, h2 / 2 - tailLen * 1.6, -w2 / 2 - tailLen, h2 / 2 - tailLen * 0.5, -w2 / 2, h2 / 2 + tailLen * 0.15])
      .fill(replierBubble),
  );
  const text2 = makeText(fonts, {
    text: "",
    role: "body",
    weight: 500,
    size: fit2.fontSize,
    color: onReplier,
    anchor: { x: 0, y: 0 },
    lineHeight: lh2,
    align: "left",
  });
  text2.position.set(-w2 / 2 + padX, -h2 / 2 + padY);
  bubble2.addChild(text2);
  bubble2.position.set(bubble2CX, bubble2CY + riseAmt);
  bubble2.alpha = 0;
  bubble2.scale.set(0.7);
  root.addChild(bubble2);

  const B2 = L2_START;
  timeline
    .to(bubble2, { prop: "alpha", from: 0, to: 1, start: B2, duration: 0.3, ease: outQuad })
    .to(bubble2, { prop: "y", from: bubble2CY + riseAmt, to: bubble2CY, start: B2, duration: 0.6, ease: spring(0.5) })
    .to(bubble2, { prop: "scale.x", from: 0.7, to: 1, start: B2, duration: 0.55, ease: makeOutBack(1.7) })
    .to(bubble2, { prop: "scale.y", from: 0.7, to: 1, start: B2, duration: 0.55, ease: makeOutBack(1.7) });

  // --- Typewriter reveal (only the replier's — the last — bubble types) ---
  const fullWrapped2 = fit2.lines.join("\n");
  const TYPE_START = B2 + 0.45;
  const TYPE_BUDGET = 1.7;
  const speed = TYPE_BUDGET / Math.max(1, fullWrapped2.length);

  const update = (t: number): void => {
    const elapsed = t - TYPE_START;
    const shown = elapsed <= 0 ? 0 : Math.min(fullWrapped2.length, Math.floor(elapsed / speed));
    const blinkOn = showCaret && t >= TYPE_START - 0.15 && t % 0.9 < 0.5;
    text2.text = fullWrapped2.slice(0, shown) + (blinkOn ? "|" : "");
  };

  return { timeline, duration: 5.2, update };
}

export const chatConvo: TemplateDefinition = {
  id: "chat-convo",
  name: "Chat Convo",
  tagline: "Two DM bubbles pop in and the reply types itself out live.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 4.2,
  palettes: PALETTES,
  fields: [
    { key: "sender", type: "text", label: "Sender name", default: "Sender", maxLength: 20 },
    { key: "replier", type: "text", label: "Replier name", default: "Replier", maxLength: 20 },
    { key: "msg1", type: "text", label: "First message", default: "Heyy, bro!", maxLength: 40 },
    {
      key: "msg2",
      type: "textarea",
      label: "Reply",
      default: "Yooo, what are you doing tonight? Let's make some content?",
      maxLength: 120,
      maxLines: 3,
    },
    { key: "showCaret", type: "toggle", label: "Blinking caret", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "senderBubble", type: "color", label: "Sender bubble", default: "", optional: true },
    { key: "replierBubble", type: "color", label: "Replier bubble", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
  ],
  build,
};
