import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  outQuint,
  spring,
  fitBox,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

// A comment row that the creator hearts: the comment card settles in, then a
// heart pops and a "Liked by creator" badge appears. Full-frame `bg` carries the
// background field; the card carries its own `card` role and a soft shadow.
const PALETTES: Palette[] = [
  { id: "daylight", name: "Daylight", colors: { background: "#F5F6FA", card: "#FFFFFF", textColor: "#101014", accent: "#FF2E5B", muted: "#C2C6CC" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0B0B10", card: "#1C1C22", textColor: "#FFFFFF", accent: "#FF3B5C", muted: "#4A4A55" } },
  { id: "blush", name: "Blush", colors: { background: "#FFF1F5", card: "#FFFFFF", textColor: "#3A0A28", accent: "#FF2E9E", muted: "#E6A9C4" } },
  { id: "forest", name: "Forest", colors: { background: "#EAF7EE", card: "#FFFFFF", textColor: "#08221A", accent: "#17A34A", muted: "#A9CBB6" } },
];

const RISE_START = 0.15;
const RISE_DUR = 0.55;
const LIKE_AT = 1.15;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F6FA"));
  const card = str(values.card, pc("card", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF2E5B"));
  const muted = pc("muted", "#C2C6CC");
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";

  const user = str(values.user, "@devnotes");
  const timestamp = str(values.timestamp, "3h");
  const comment = str(values.comment, "the way you explained this finally made it click");
  const likes = str(values.likes, "1.2K");
  const showBadge = on(values.showBadge);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const k = minDim / 1080;
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const cardW = Math.min(safe.width * 0.9, minDim * 0.94);
  const avatarR = 52 * k;
  const padX = 38 * k;
  const padY = 34 * k;
  const gapAT = 20 * k;
  const nameSize = Math.round(34 * k);
  const nameLineH = Math.round(nameSize * 1.25);
  const gapNameMsg = 16 * k;
  const msgSize0 = Math.round(38 * k);
  const gapMsgFooter = 22 * k;
  const footerIcon = Math.round(34 * k);
  const footerText = Math.round(30 * k);
  const footerH = 44 * k;
  const cardR = 32 * k;

  const textLeft = padX + avatarR * 2 + gapAT;
  const textMaxW = cardW - textLeft - padX;

  const familyBody = fonts.family("body");
  const measureBody = (s: string, sz: number): number => fonts.measure(s, { family: familyBody, weight: 500, size: sz });
  const { fontSize: msgSize, lines } = fitBox(comment, measureBody, { maxWidth: textMaxW, baseSize: msgSize0, minSize: Math.round(msgSize0 * 0.62), maxLines: 3 });
  const msgLH = Math.round(msgSize * 1.34);

  const cardH = padY * 2 + nameLineH + gapNameMsg + lines.length * msgLH + gapMsgFooter + footerH;
  const cardCy = safe.y + safe.height * 0.5;

  const cardBox = new Container();
  cardBox.position.set(cx, cardCy + minDim * 0.08);
  cardBox.alpha = 0;
  root.addChild(cardBox);
  cardBox.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.03, cardW, cardH, cardR).fill({ color: "#000000", alpha: 0.14 }));
  cardBox.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(card));

  const av = new Container();
  av.addChild(new Graphics().circle(0, 0, avatarR).fill(accent));
  av.addChild(makeIcon("user", avatarR * 1.15, { color: onAccent }));
  av.position.set(-cardW / 2 + padX + avatarR, -cardH / 2 + padY + nameLineH / 2);
  cardBox.addChild(av);

  const nameY = -cardH / 2 + padY + nameLineH / 2;
  const uname = makeText(fonts, { text: user, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  uname.position.set(-cardW / 2 + textLeft, nameY);
  cardBox.addChild(uname);
  if (timestamp.length > 0) {
    const ts = makeText(fonts, { text: ` · ${timestamp}`, role: "body", weight: 500, size: Math.round(nameSize * 0.72), color: textColor, anchor: { x: 0, y: 0.5 } });
    ts.alpha = 0.52;
    ts.position.set(-cardW / 2 + textLeft + uname.width, nameY + 1 * k);
    cardBox.addChild(ts);
  }

  const msgText = makeText(fonts, { text: lines.join("\n"), role: "body", weight: 500, size: msgSize, color: textColor, anchor: { x: 0, y: 0 }, lineHeight: msgLH });
  msgText.position.set(-cardW / 2 + textLeft, -cardH / 2 + padY + nameLineH + gapNameMsg);
  cardBox.addChild(msgText);

  // Footer: a muted heart + like count (always), then a creator heart pops.
  const footerY = -cardH / 2 + padY + nameLineH + gapNameMsg + lines.length * msgLH + gapMsgFooter + footerH / 2;
  const heartX = -cardW / 2 + textLeft + footerIcon * 0.5;
  const restHeart = makeIcon("heart", footerIcon, { color: muted });
  restHeart.position.set(heartX, footerY);
  cardBox.addChild(restHeart);
  const likeText = makeText(fonts, { text: likes, role: "body", weight: 600, size: footerText, color: textColor, anchor: { x: 0, y: 0.5 } });
  likeText.alpha = 0.85;
  likeText.position.set(-cardW / 2 + textLeft + footerIcon + 14 * k, footerY);
  cardBox.addChild(likeText);

  timeline
    .to(cardBox, { prop: "alpha", from: 0, to: 1, start: RISE_START, duration: 0.3, ease: outQuad })
    .to(cardBox, { prop: "y", from: cardCy + minDim * 0.08, to: cardCy, start: RISE_START, duration: RISE_DUR, ease: outExpo });

  let duration = 3.6;

  if (showBadge) {
    // Accent heart pops over the muted one.
    const liveHeart = makeIcon("heart", footerIcon * 1.05, { color: accent });
    liveHeart.position.set(heartX, footerY);
    liveHeart.scale.set(0);
    cardBox.addChild(liveHeart);
    timeline
      .to(liveHeart, { prop: "scale.x", from: 0, to: 1, start: LIKE_AT, duration: 0.45, ease: makeOutBack(2.4) })
      .to(liveHeart, { prop: "scale.y", from: 0, to: 1, start: LIKE_AT, duration: 0.45, ease: makeOutBack(2.4) });

    // Expanding ring on the like.
    const ring = new Graphics().circle(0, 0, footerIcon * 0.6).stroke({ color: accent, width: Math.max(2, 4 * k) });
    ring.position.set(heartX, footerY);
    ring.alpha = 0;
    cardBox.addChild(ring);
    timeline
      .to(ring, { prop: "alpha", from: 0.8, to: 0, start: LIKE_AT, duration: 0.6, ease: outQuad })
      .to(ring, { prop: "scale.x", from: 0.5, to: 1.9, start: LIKE_AT, duration: 0.6, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 0.5, to: 1.9, start: LIKE_AT, duration: 0.6, ease: outExpo });

    // "Liked by creator" badge pill, to the right of the footer.
    const bSize = Math.round(footerText * 0.86);
    const bHeart = footerIcon * 0.62;
    const bText = "Liked by creator";
    const bTextW = fonts.measure(bText, { family: fonts.family("display"), weight: 700, size: bSize });
    const bW = bHeart + bTextW + footerIcon * 1.5;
    const bH = footerH * 1.02;
    const badge = new Container();
    const badgeX = cardW / 2 - padX - bW / 2;
    badge.position.set(badgeX, footerY);
    badge.scale.set(0);
    cardBox.addChild(badge);
    badge.addChild(new Graphics().roundRect(-bW / 2, -bH / 2, bW, bH, bH / 2).fill(accent));
    const bh = makeIcon("heart", bHeart, { color: onAccent });
    bh.position.set(-bW / 2 + footerIcon * 0.5 + bHeart * 0.5, 0);
    badge.addChild(bh);
    const bt = makeText(fonts, { text: bText, role: "display", weight: 700, size: bSize, color: onAccent, anchor: { x: 0, y: 0.5 } });
    bt.position.set(-bW / 2 + footerIcon * 0.5 + bHeart + footerIcon * 0.4, 0);
    badge.addChild(bt);
    timeline
      .to(badge, { prop: "scale.x", from: 0, to: 1, start: LIKE_AT + 0.18, duration: 0.5, ease: spring(0.44) })
      .to(badge, { prop: "scale.y", from: 0, to: 1, start: LIKE_AT + 0.18, duration: 0.5, ease: outQuint });
    duration = 3.8;
  }

  return { timeline, duration };
}

export const creatorLike: TemplateDefinition = {
  id: "creator-like",
  name: "Creator Like",
  tagline: "A comment settles in, then the creator hearts it with a Liked by creator badge.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { user: "display", comment: "body" },
  palettes: PALETTES,
  fields: [
    { key: "user", type: "text", label: "Username", default: "@devnotes", maxLength: 24 },
    { key: "timestamp", type: "text", label: "Timestamp", default: "3h", maxLength: 8, optional: true },
    { key: "comment", type: "textarea", label: "Comment", default: "the way you explained this finally made it click", maxLength: 110, maxLines: 3 },
    { key: "likes", type: "text", label: "Likes", default: "1.2K", maxLength: 10, optional: true },
    { key: "showBadge", type: "toggle", label: "Liked by creator badge", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "card", type: "color", label: "Card", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
