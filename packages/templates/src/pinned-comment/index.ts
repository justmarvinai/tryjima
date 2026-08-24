import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outQuint,
  outCubic,
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

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

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
  { id: "daylight", name: "Daylight", colors: { background: "#F5F6FA", card: "#FFFFFF", textColor: "#101014", accent: "#2E7DF6" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0B0B10", card: "#1C1C22", textColor: "#FFFFFF", accent: "#FFB020" } },
  { id: "blush", name: "Blush", colors: { background: "#FFF1F5", card: "#FFFFFF", textColor: "#3A0A28", accent: "#FF2E9E" } },
  { id: "forest", name: "Forest", colors: { background: "#EAF7EE", card: "#FFFFFF", textColor: "#08221A", accent: "#17A34A" } },
];

const DEG = Math.PI / 180;

const DROP_START = 0.1;
const DROP_DUR = 0.65;
const PIN_START = DROP_START + DROP_DUR + 0.25;
const PIN_DUR = 0.5;
const LABEL_START = PIN_START + 0.08;
const SWEEP_START = PIN_START + 0.4;
const SWEEP_DUR = 0.75;
const HOLD = 1.3;
const DURATION = SWEEP_START + SWEEP_DUR + HOLD;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F6FA"));
  const card = str(values.card, pc("card", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#2E7DF6"));
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";

  const user = str(values.user, "@bigfan22");
  const timestamp = str(values.timestamp, "2h");
  const comment = str(values.comment, "This edit is INSANE, the transitions are so clean \u{1F525}");
  const likes = str(values.likes, "2.4K");
  const showPin = on(values.showPin);
  const showSweep = on(values.showSweep);

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const k = minDim / 1080;
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const cardW = Math.min(safe.width * 0.88, minDim * 0.9);
  const avatarR = 52 * k;
  const padX = 36 * k;
  const padY = 32 * k;
  const gapAvatarText = 18 * k;
  const nameSize = Math.round(34 * k);
  const nameLineH = Math.round(nameSize * 1.25);
  const gapNameMsg = 16 * k;
  const msgSize0 = Math.round(38 * k);
  const gapMsgFooter = 20 * k;
  const footerIconSize = Math.round(30 * k);
  const footerTextSize = Math.round(28 * k);
  const footerH = 40 * k;
  const cardRadius = 30 * k;

  const textLeft = padX + avatarR * 2 + gapAvatarText;
  const textMaxW = cardW - textLeft - padX;

  const familyBody = fonts.family("body");
  const measureBody = (s: string, sz: number): number => fonts.measure(s, { family: familyBody, weight: 500, size: sz });
  const { fontSize: msgSize, lines } = fitBox(comment, measureBody, {
    maxWidth: textMaxW,
    baseSize: msgSize0,
    minSize: Math.round(msgSize0 * 0.62),
    maxLines: 3,
  });
  const msgLH = Math.round(msgSize * 1.34);

  const cardH = padY * 2 + nameLineH + gapNameMsg + lines.length * msgLH + gapMsgFooter + footerH;
  const cardCenterY = safe.y + safe.height * 0.54;

  // --- The comment card itself ---
  const cardBox = new Container();
  cardBox.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.03, cardW, cardH, cardRadius).fill({ color: "#000000", alpha: 0.14 }));
  cardBox.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardRadius).fill(card));

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

  const msgText = makeText(fonts, {
    text: lines.join("\n"),
    role: "body",
    weight: 500,
    size: msgSize,
    color: textColor,
    anchor: { x: 0, y: 0 },
    lineHeight: msgLH,
  });
  msgText.position.set(-cardW / 2 + textLeft, -cardH / 2 + padY + nameLineH + gapNameMsg);
  cardBox.addChild(msgText);

  const footerY = -cardH / 2 + padY + nameLineH + gapNameMsg + lines.length * msgLH + gapMsgFooter + footerH / 2;
  const heart = makeIcon("heart", footerIconSize, { color: accent });
  heart.position.set(-cardW / 2 + textLeft + footerIconSize * 0.5, footerY);
  heart.scale.set(0);
  cardBox.addChild(heart);
  const likeText = makeText(fonts, { text: likes, role: "body", weight: 600, size: footerTextSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  likeText.alpha = 0.85;
  likeText.position.set(-cardW / 2 + textLeft + footerIconSize + 12 * k, footerY);
  cardBox.addChild(likeText);

  // --- Highlight sweep: a soft glare band, masked to the card, sweeps once ---
  if (showSweep) {
    const sweepMask = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardRadius).fill(0xffffff);
    cardBox.addChild(sweepMask);
    const bandW = cardW * 0.34;
    const bandH = cardH * 2.6;
    const band = new Graphics().rect(-bandW / 2, -bandH / 2, bandW, bandH).fill({ color: "#FFFFFF", alpha: 0.28 });
    band.rotation = -0.3;
    const startX = -cardW / 2 - bandW;
    const endX = cardW / 2 + bandW;
    band.position.set(startX, 0);
    cardBox.addChild(band);
    band.mask = sweepMask;
    timeline.to(band, { prop: "x", from: startX, to: endX, start: SWEEP_START, duration: SWEEP_DUR, ease: outCubic });
  }

  const dropDist = minDim * 0.55;
  cardBox.position.set(cx, cardCenterY - dropDist);
  cardBox.alpha = 0;
  root.addChild(cardBox);

  timeline
    .to(cardBox, { prop: "alpha", from: 0, to: 1, start: DROP_START, duration: 0.2, ease: outQuad })
    .to(cardBox, { prop: "y", from: cardCenterY - dropDist, to: cardCenterY, start: DROP_START, duration: DROP_DUR, ease: spring(0.42) });

  // Squash + stretch right as the card lands.
  const landAt = DROP_START + DROP_DUR;
  timeline
    .to(cardBox, { prop: "scale.y", from: 1, to: 0.93, start: landAt, duration: 0.09, ease: outQuad })
    .to(cardBox, { prop: "scale.x", from: 1, to: 1.035, start: landAt, duration: 0.09, ease: outQuad })
    .to(cardBox, { prop: "scale.y", from: 0.93, to: 1, start: landAt + 0.09, duration: 0.22, ease: outQuint })
    .to(cardBox, { prop: "scale.x", from: 1.035, to: 1, start: landAt + 0.09, duration: 0.22, ease: outQuint });

  timeline
    .to(heart, { prop: "scale.x", from: 0, to: 1, start: landAt + 0.12, duration: 0.4, ease: makeOutBack(2) })
    .to(heart, { prop: "scale.y", from: 0, to: 1, start: landAt + 0.12, duration: 0.4, ease: makeOutBack(2) });

  // --- Pin attaches to the top-left corner, with a "Pinned by creator" tag ---
  if (showPin) {
    const pinR = Math.min(cardW, cardH) * 0.052;
    const pinCx = -cardW / 2 + pinR * 0.6;
    const pinCy = -cardH / 2 + pinR * 0.6;
    const pin = new Container();
    pin.addChild(new Graphics().circle(0, 0, pinR).fill(accent));
    pin.addChild(makeIcon("pin", pinR * 1.15, { color: onAccent, holeColor: accent }));
    pin.position.set(pinCx, pinCy);
    pin.scale.set(0);
    pin.rotation = -22 * DEG;
    cardBox.addChild(pin);
    timeline
      .to(pin, { prop: "scale.x", from: 0, to: 1, start: PIN_START, duration: PIN_DUR, ease: makeOutBack(2.2) })
      .to(pin, { prop: "scale.y", from: 0, to: 1, start: PIN_START, duration: PIN_DUR, ease: makeOutBack(2.2) })
      .to(pin, { prop: "rotation", from: -22 * DEG, to: -8 * DEG, start: PIN_START, duration: PIN_DUR, ease: outQuint });

    const labelSize = Math.round(nameSize * 0.56);
    const label = makeText(fonts, {
      text: "Pinned by creator",
      role: "body",
      weight: 700,
      size: labelSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
      letterSpacing: labelSize * 0.01,
    });
    label.position.set(pinCx + pinR * 1.5, pinCy - pinR * 1.6 + 8 * k);
    label.alpha = 0;
    cardBox.addChild(label);
    const labelRestY = pinCy - pinR * 1.6;
    timeline
      .to(label, { prop: "alpha", from: 0, to: 1, start: LABEL_START, duration: 0.35, ease: outQuad })
      .to(label, { prop: "y", from: labelRestY + 8 * k, to: labelRestY, start: LABEL_START, duration: 0.4, ease: outExpo });
  }

  return { timeline, duration: DURATION };
}

export const pinnedComment: TemplateDefinition = {
  id: "pinned-comment",
  name: "Pinned Comment",
  tagline: "A top comment drops in, then gets pinned with a glossy highlight sweep.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.5,
  fontRoles: { user: "display", comment: "body", likes: "body" },
  palettes: PALETTES,
  fields: [
    { key: "user", type: "text", label: "Username", default: "@bigfan22", maxLength: 24 },
    { key: "timestamp", type: "text", label: "Timestamp", default: "2h", maxLength: 8, optional: true },
    {
      key: "comment",
      type: "textarea",
      label: "Comment",
      default: "This edit is INSANE, the transitions are so clean \u{1F525}",
      maxLength: 110,
      maxLines: 3,
    },
    { key: "likes", type: "text", label: "Likes", default: "2.4K", maxLength: 10 },
    { key: "showPin", type: "toggle", label: "Pin badge", default: true },
    { key: "showSweep", type: "toggle", label: "Highlight sweep", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "card", type: "color", label: "Card", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
