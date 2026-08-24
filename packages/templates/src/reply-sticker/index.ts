import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outBack,
  makeOutBack,
  spring,
  fitBox,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const DEG = Math.PI / 180;
const AVATAR_BG = "#9AA0AE";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

// Accent doubles as the outgoing reply bubble's fill, carrying real
// sentence-length body text in `onAccent` — so these are picked (and verified)
// for ≥4.5:1 contrast against white, not just against bold display glyphs.
const PALETTES: Palette[] = [
  { id: "daylight", name: "Daylight", colors: { background: "#F4F5F7", incoming: "#FFFFFF", textColor: "#101014", accent: "#4457E8", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0B0B10", incoming: "#1C1C24", textColor: "#FFFFFF", accent: "#C93D0E", onAccent: "#FFFFFF" } },
  { id: "emerald", name: "Emerald", colors: { background: "#E9F7F0", incoming: "#FFFFFF", textColor: "#08221A", accent: "#097349", onAccent: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F2EEFF", incoming: "#FFFFFF", textColor: "#241452", accent: "#6A46E0", onAccent: "#FFFFFF" } },
];

/** A small left-pointing reply-arrow glyph, centered at (0,0). */
function replyArrow(size: number, color: string): Graphics {
  const s = size;
  return new Graphics()
    .moveTo(0.4 * s, 0)
    .lineTo(-0.26 * s, 0)
    .stroke({ color, width: Math.max(2, 0.16 * s), cap: "round" })
    .poly([-0.14 * s, -0.26 * s, -0.48 * s, 0, -0.14 * s, 0.26 * s])
    .fill(color);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F5F7"));
  const incoming = pc("incoming", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#4457E8"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const handle = str(values.handle, "@fan_account");
  const comment = str(values.comment, "wait this is actually insane \u{1F60D}");
  const reply = str(values.reply, "thank you!! \u{1F64F}");
  const showSticker = values.showSticker !== false;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const k = minDim / 1080;
  const safe = safeRect(ctx.aspect);

  const avatarR = 42 * k;
  const avatarGap = 16 * k;
  const padX = 28 * k;
  const padY = 22 * k;
  const msgSize0 = Math.round(33 * k);
  const radius = 24 * k;
  const unameSize = Math.round(27 * k);
  const maxBubbleW = Math.min(safe.width * 0.72, minDim * 0.72);

  const familyBody = fonts.family("body");
  const measureBody = (s: string, sz: number): number => fonts.measure(s, { family: familyBody, weight: 500, size: sz });
  const familyDisplay = fonts.family("display");
  const measureDisplay = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });

  // --- Bubble 1: the incoming comment (avatar + handle + text) ---
  const bubbleLeft = avatarR * 2 + avatarGap;
  const textMaxW1 = maxBubbleW - bubbleLeft - padX;
  const { lines: c1Lines, fontSize: c1Size } = fitBox(comment, measureBody, {
    maxWidth: textMaxW1,
    baseSize: msgSize0,
    minSize: Math.round(msgSize0 * 0.65),
    maxLines: 3,
  });
  const c1LH = Math.round(c1Size * 1.32);
  const nameLH = Math.round(unameSize * 1.3);
  const c1TextW = Math.max(...c1Lines.map((l) => measureBody(l, c1Size)));
  const bubble1InnerW = Math.min(textMaxW1, Math.max(c1TextW, measureDisplay(handle, unameSize)));
  const bubble1W = bubble1InnerW + padX * 2;
  const bubble1H = padY * 2 + nameLH + 6 * k + c1Lines.length * c1LH;

  const group1 = new Container();
  const av1 = new Container();
  av1.addChild(new Graphics().circle(0, 0, avatarR).fill(AVATAR_BG));
  av1.addChild(makeIcon("user", avatarR * 1.05, { color: "#FFFFFF" }));
  av1.position.set(avatarR, bubble1H / 2);
  group1.addChild(av1);

  const midY1 = bubble1H / 2;
  const bub1 = new Graphics().roundRect(bubbleLeft, 0, bubble1W, bubble1H, radius).fill(incoming);
  bub1.poly([bubbleLeft, midY1 - 10 * k, bubbleLeft - 10 * k, midY1, bubbleLeft, midY1 + 10 * k]).fill(incoming);
  group1.addChild(bub1);

  const handleText = makeText(fonts, { text: handle, role: "display", weight: 700, size: unameSize, color: textColor, anchor: { x: 0, y: 0 } });
  handleText.position.set(bubbleLeft + padX, padY * 0.85);
  group1.addChild(handleText);

  const commentText = makeText(fonts, {
    text: c1Lines.join("\n"),
    role: "body",
    weight: 500,
    size: c1Size,
    color: textColor,
    anchor: { x: 0, y: 0 },
    lineHeight: c1LH,
  });
  commentText.position.set(bubbleLeft + padX, padY * 0.85 + nameLH + 6 * k);
  group1.addChild(commentText);

  const bubbleGroupW = bubbleLeft + bubble1W;
  const restX1 = safe.x;
  const restY1 = safe.y + safe.height * 0.36 - bubble1H / 2;
  const riseX = minDim * 0.09;
  const riseY = minDim * 0.075;

  group1.position.set(restX1 - riseX, restY1 + riseY);
  group1.alpha = 0;
  group1.scale.set(0.85);
  root.addChild(group1);

  const G1_START = 0.1;
  const G1_DUR = 0.55;
  timeline
    .to(group1, { prop: "alpha", from: 0, to: 1, start: G1_START, duration: 0.3, ease: outQuad })
    .to(group1, { prop: "x", from: restX1 - riseX, to: restX1, start: G1_START, duration: G1_DUR, ease: spring(0.5) })
    .to(group1, { prop: "y", from: restY1 + riseY, to: restY1, start: G1_START, duration: G1_DUR, ease: spring(0.5) })
    .to(group1, { prop: "scale.x", from: 0.85, to: 1, start: G1_START, duration: G1_DUR, ease: makeOutBack(1.6) })
    .to(group1, { prop: "scale.y", from: 0.85, to: 1, start: G1_START, duration: G1_DUR, ease: makeOutBack(1.6) });

  // --- Reply sticker: slaps onto bubble 1's top-right corner ---
  const BADGE_START = G1_START + G1_DUR + 0.05;
  const BADGE_DUR = 0.5;
  if (showSticker) {
    const badgeFont = Math.round(25 * k);
    const arrowSize = badgeFont * 1.1;
    const gap = badgeFont * 0.3;
    const labelText = makeText(fonts, { text: "Reply", role: "display", weight: 700, size: badgeFont, color: onAccent, anchor: { x: 0, y: 0.5 } });
    const contentW = arrowSize + gap + labelText.width;
    const bPadX = badgeFont * 0.6;
    const bPadY = badgeFont * 0.46;
    const badgeW = contentW + bPadX * 2;
    const badgeH = badgeFont + bPadY * 2;

    const badge = new Container();
    badge.addChild(new Graphics().roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, badgeH / 2).fill(accent));
    const arrow = replyArrow(arrowSize, onAccent);
    arrow.position.set(-badgeW / 2 + bPadX + arrowSize / 2, 0);
    badge.addChild(arrow);
    labelText.position.set(-badgeW / 2 + bPadX + arrowSize + gap, 0);
    badge.addChild(labelText);

    const cornerX = restX1 + bubbleGroupW;
    const cornerY = restY1;
    badge.position.set(cornerX - badgeW * 0.32, cornerY + badgeH * 0.06);

    const restTilt = -9 * DEG;
    const startTilt = -28 * DEG;
    badge.alpha = 0;
    badge.scale.set(0);
    badge.rotation = startTilt;
    root.addChild(badge);

    timeline
      .to(badge, { prop: "alpha", from: 0, to: 1, start: BADGE_START, duration: 0.12, ease: outQuad })
      .to(badge, { prop: "scale.x", from: 0, to: 1, start: BADGE_START, duration: BADGE_DUR, ease: makeOutBack(2.1) })
      .to(badge, { prop: "scale.y", from: 0, to: 1, start: BADGE_START, duration: BADGE_DUR, ease: makeOutBack(2.1) })
      .to(badge, { prop: "rotation", from: startTilt, to: restTilt, start: BADGE_START, duration: BADGE_DUR, ease: outBack });

    // A tiny "impact" dip on the comment bubble as the sticker lands.
    timeline
      .to(group1, { prop: "scale.x", from: 1, to: 0.97, start: BADGE_START, duration: 0.1, ease: outQuad })
      .to(group1, { prop: "scale.y", from: 1, to: 0.97, start: BADGE_START, duration: 0.1, ease: outQuad })
      .to(group1, { prop: "scale.x", from: 0.97, to: 1, start: BADGE_START + 0.1, duration: 0.22, ease: outQuad })
      .to(group1, { prop: "scale.y", from: 0.97, to: 1, start: BADGE_START + 0.1, duration: 0.22, ease: outQuad });
  }

  // --- Bubble 2: your reply, arriving from the bottom-right ---
  const BUBBLE2_START = BADGE_START + BADGE_DUR + (showSticker ? 0 : -0.35);
  const textMaxW2 = maxBubbleW - padX * 2;
  const { lines: c2Lines, fontSize: c2Size } = fitBox(reply, measureBody, {
    maxWidth: textMaxW2,
    baseSize: msgSize0,
    minSize: Math.round(msgSize0 * 0.65),
    maxLines: 2,
  });
  const c2LH = Math.round(c2Size * 1.3);
  const c2TextW = Math.max(...c2Lines.map((l) => measureBody(l, c2Size)));
  const bubble2W = Math.min(textMaxW2, c2TextW) + padX * 2;
  const bubble2H = padY * 2 + c2Lines.length * c2LH;

  const group2 = new Container();
  const midY2 = bubble2H / 2;
  const bub2 = new Graphics().roundRect(0, 0, bubble2W, bubble2H, radius).fill(accent);
  bub2.poly([bubble2W, midY2 - 10 * k, bubble2W + 10 * k, midY2, bubble2W, midY2 + 10 * k]).fill(accent);
  group2.addChild(bub2);
  const replyText = makeText(fonts, {
    text: c2Lines.join("\n"),
    role: "body",
    weight: 500,
    size: c2Size,
    color: onAccent,
    anchor: { x: 0, y: 0 },
    lineHeight: c2LH,
  });
  replyText.position.set(padX, padY);
  group2.addChild(replyText);

  const gapBubbles = minDim * 0.045;
  const restX2 = safe.x + safe.width - bubble2W;
  const restY2 = restY1 + bubble1H + gapBubbles;

  group2.position.set(restX2 + riseX, restY2 + riseY);
  group2.alpha = 0;
  group2.scale.set(0.85);
  root.addChild(group2);

  const G2_DUR = 0.55;
  timeline
    .to(group2, { prop: "alpha", from: 0, to: 1, start: BUBBLE2_START, duration: 0.3, ease: outQuad })
    .to(group2, { prop: "x", from: restX2 + riseX, to: restX2, start: BUBBLE2_START, duration: G2_DUR, ease: spring(0.5) })
    .to(group2, { prop: "y", from: restY2 + riseY, to: restY2, start: BUBBLE2_START, duration: G2_DUR, ease: spring(0.5) })
    .to(group2, { prop: "scale.x", from: 0.85, to: 1, start: BUBBLE2_START, duration: G2_DUR, ease: makeOutBack(1.6) })
    .to(group2, { prop: "scale.y", from: 0.85, to: 1, start: BUBBLE2_START, duration: G2_DUR, ease: makeOutBack(1.6) });

  return { timeline, duration: 2.4 };
}

export const replySticker: TemplateDefinition = {
  id: "reply-sticker",
  name: "Reply Sticker",
  tagline: "A comment lands, a reply sticker slaps on, then your reply pops in.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 1.9,
  fontRoles: { handle: "display", comment: "body", reply: "body" },
  palettes: PALETTES,
  fields: [
    { key: "handle", type: "text", label: "Handle", default: "@fan_account", maxLength: 24, shrinkToFit: true },
    { key: "comment", type: "text", label: "Comment", default: "wait this is actually insane \u{1F60D}", maxLength: 80 },
    { key: "reply", type: "text", label: "Reply", default: "thank you!! \u{1F64F}", maxLength: 60 },
    { key: "showSticker", type: "toggle", label: "Reply sticker", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
