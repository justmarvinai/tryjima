import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
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

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);

/** Rough perceived luminance of a #rrggbb color (0..1) — picks placeholder ink. */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
  letterSpacing = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size,
    ...(letterSpacing ? { letterSpacing } : {}),
  });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

// cardColor / onAccent / imageBack / empty are palette-only roles (not exposed
// as fields) — they keep the card panel, price pill and star-fill legible no
// matter which background/textColor/accent the user picks.
const PALETTES: Palette[] = [
  { id: "sunlit-ivory", name: "Sunlit ivory", colors: { background: "#FBF7EF", cardColor: "#FFFFFF", textColor: "#241C10", accent: "#B5892A", onAccent: "#241C10", imageBack: "#ECE4D2", empty: "#E3D9C2" } },
  { id: "ocean-suite", name: "Ocean suite", colors: { background: "#EAF4F6", cardColor: "#FFFFFF", textColor: "#0B2A33", accent: "#147D94", onAccent: "#FFFFFF", imageBack: "#D8ECEF", empty: "#CBE2E6" } },
  { id: "midnight-concierge", name: "Midnight concierge", colors: { background: "#14151C", cardColor: "#1E1F29", textColor: "#F4F1E9", accent: "#E8B54A", onAccent: "#1E1F29", imageBack: "#2A2B38", empty: "#3A3B47" } },
  { id: "blush-retreat", name: "Blush retreat", colors: { background: "#FFF1F0", cardColor: "#FFFFFF", textColor: "#35171A", accent: "#C6434B", onAccent: "#FFFFFF", imageBack: "#F6DEDD", empty: "#F0D3D1" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FBF7EF"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#241C10"));
  const accent = str(values.accent, pc("accent", "#B5892A"));
  const onAccent = pc("onAccent", "#241C10");
  const imageBack = pc("imageBack", "#ECE4D2");
  const emptyColor = pc("empty", "#E3D9C2");
  const showStars = values.showStars !== false;

  const name = str(values.name, "The Marchetti");
  const location = str(values.location, "Lisbon, Portugal");
  const rating = Math.max(1, Math.min(5, Math.round(num(values.rating, 4))));
  const checkIn = str(values.checkIn, "Fri, Aug 14");
  const checkOut = str(values.checkOut, "Sun, Aug 16");
  const price = str(values.price, "$129/night");

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h); // 1080 for every aspect

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const cardW = minDim * 0.74;
  const cardH = minDim * 0.82;
  const radius = cardW * 0.05;
  const rect = safeRect(ctx.aspect);
  const cardCx = w / 2;
  const cardCy = rect.y + rect.height / 2;

  const pad = cardW * 0.075;
  const contentLeft = -cardW / 2 + pad;
  const contentRight = cardW / 2 - pad;
  const contentW = contentRight - contentLeft;

  // --- Card assembly ---
  const card = new Container();
  card.position.set(cardCx, cardCy);
  card.scale.set(0.92);
  card.alpha = 0;
  root.addChild(card);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.32, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.92, to: 1, start: 0, duration: 0.42, ease: makeOutBack(1.35) })
    .to(card, { prop: "scale.y", from: 0.92, to: 1, start: 0, duration: 0.42, ease: makeOutBack(1.35) });

  const shadow = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius).fill({ color: 0x000000, alpha: 0.16 });
  shadow.position.set(0, cardH * 0.022);
  card.addChild(shadow);
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius).fill(cardColor));

  // --- Photo strip (top, clipped to the card's rounded shape) ---
  const photoH = cardH * 0.42;
  const photoTop = -cardH / 2;
  const photoCy = photoTop + photoH / 2;

  const photoHolder = new Container();
  photoHolder.position.set(0, photoCy);
  card.addChild(photoHolder);

  const tex: Texture | null = images.image ?? null;
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(cardW / tex.width, photoH / tex.height);
    s.scale.set(cover);
    photoHolder.addChild(s);
  } else {
    photoHolder.addChild(new Graphics().rect(-cardW / 2, -photoH / 2, cardW, photoH).fill(imageBack));
    const iconColor = luminance(imageBack) < 0.5 ? "#9AA0AC" : "#B7BCC6";
    const placeholderIcon = makeIcon("pin", photoH * 0.3, { color: iconColor });
    placeholderIcon.position.set(0, -photoH * 0.04);
    photoHolder.addChild(placeholderIcon);
  }
  // Gentle Ken Burns drift so the strip never feels static.
  timeline
    .to(photoHolder, { prop: "scale.x", from: 1.0, to: 1.05, start: 0.1, duration: 3.6, ease: outQuad })
    .to(photoHolder, { prop: "scale.y", from: 1.0, to: 1.05, start: 0.1, duration: 3.6, ease: outQuad });

  // Left -> right reveal wipe, masked to the card's own rounded silhouette so
  // the strip's top corners match the card exactly.
  const photoMask = new Graphics().roundRect(0, -cardH / 2, cardW, cardH, radius).fill(0xffffff);
  photoMask.position.set(-cardW / 2, 0);
  photoMask.scale.set(0, 1);
  card.addChild(photoMask);
  photoHolder.mask = photoMask;
  timeline.to(photoMask, { prop: "scale.x", from: 0, to: 1, start: 0.14, duration: 0.7, ease: outExpo });

  // --- Price pill (floats on the photo's bottom-right corner) ---
  const pillH = Math.round(cardW * 0.062);
  const pillPadX = cardW * 0.026;
  const priceSize = Math.round(pillH * 0.42);
  const priceLabel = makeText(fonts, { text: price, role: "display", weight: 700, size: fitSize(fonts, price, "display", 700, priceSize, cardW * 0.42), color: onAccent, anchor: 0.5 });
  const pillW = priceLabel.width + pillPadX * 2;
  const pillC = new Container();
  pillC.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(accent));
  pillC.addChild(priceLabel);
  const pillCx = contentRight - pillW / 2;
  const pillCy = photoTop + photoH - pillH / 2 - cardW * 0.035;
  pillC.position.set(pillCx, pillCy);
  pillC.scale.set(0);
  card.addChild(pillC);
  timeline
    .to(pillC, { prop: "scale.x", from: 0, to: 1, start: 0.58, duration: 0.5, ease: makeOutBack(1.8) })
    .to(pillC, { prop: "scale.y", from: 0, to: 1, start: 0.58, duration: 0.5, ease: makeOutBack(1.8) });

  // --- Vertical content rhythm below the photo ---
  let cursor = photoTop + photoH + cardH * 0.065;

  const nameSize = fitSize(fonts, name, "display", 700, Math.round(cardW * 0.088), contentW);
  const nameText = makeText(fonts, { text: name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0, y: 0 } });
  nameText.position.set(contentLeft, cursor);
  nameText.alpha = 0;
  card.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.78, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: cursor + 14, to: cursor, start: 0.78, duration: 0.45, ease: outExpo });
  cursor += nameSize * 1.22;

  // Star rating (toggle).
  if (showStars) {
    const starSize = Math.round(cardW * 0.05);
    const starGap = starSize * 1.15;
    const starsY = cursor + starSize * 0.55;
    for (let i = 0; i < 5; i++) {
      const holder = new Container();
      holder.addChild(makeIcon("star", starSize, { color: i < rating ? accent : emptyColor }));
      holder.position.set(contentLeft + starSize * 0.5 + i * starGap, starsY);
      holder.scale.set(0);
      card.addChild(holder);
      const start = 0.98 + i * 0.08;
      timeline
        .to(holder, { prop: "scale.x", from: 0, to: 1, start, duration: 0.4, ease: makeOutBack(1.8) })
        .to(holder, { prop: "scale.y", from: 0, to: 1, start, duration: 0.4, ease: makeOutBack(1.8) });
    }
    cursor += starSize * 1.55;
  } else {
    cursor += cardH * 0.02;
  }

  // Location line (pin icon + text).
  const locSize = Math.round(cardW * 0.036);
  const pinIconSize = locSize * 1.35;
  const locY = cursor + locSize * 0.62;
  const locHolder = new Container();
  locHolder.alpha = 0;
  const locPin = makeIcon("pin", pinIconSize, { color: accent, holeColor: cardColor });
  locPin.position.set(contentLeft + pinIconSize * 0.42, locY - locSize * 0.04);
  locHolder.addChild(locPin);
  const locMaxW = Math.max(20, contentW - pinIconSize * 1.3);
  const locText = makeText(fonts, { text: location, role: "body", weight: 500, size: fitSize(fonts, location, "body", 500, locSize, locMaxW), color: textColor, anchor: { x: 0, y: 0.5 } });
  locText.position.set(contentLeft + pinIconSize * 1.15, locY);
  locHolder.addChild(locText);
  card.addChild(locHolder);
  timeline
    .to(locHolder, { prop: "alpha", from: 0, to: 1, start: 1.28, duration: 0.4, ease: outQuad })
    .to(locHolder, { prop: "y", from: 10, to: 0, start: 1.28, duration: 0.42, ease: outQuint });
  cursor += locSize * 1.7;

  // Divider.
  const dividerY = cursor + cardH * 0.015;
  const divider = new Graphics().roundRect(0, 0, contentW, Math.max(2, cardH * 0.003), 1).fill({ color: textColor, alpha: 0.14 });
  divider.position.set(contentLeft, dividerY);
  divider.scale.set(0, 1);
  card.addChild(divider);
  timeline.to(divider, { prop: "scale.x", from: 0, to: 1, start: 1.48, duration: 0.4, ease: outExpo });

  // Check-in / Check-out columns.
  const rowTop = dividerY + cardH * 0.05;
  const labelSize = Math.round(cardW * 0.026);
  const valueSize = Math.round(cardW * 0.046);
  const col1X = contentLeft;
  const col2X = contentLeft + contentW / 2 + cardW * 0.02;
  const colMaxW = contentW / 2 - cardW * 0.03;
  const cols: { label: string; value: string; x: number }[] = [
    { label: "CHECK-IN", value: checkIn, x: col1X },
    { label: "CHECK-OUT", value: checkOut, x: col2X },
  ];
  cols.forEach((col, i) => {
    const holder = new Container();
    holder.alpha = 0;
    const lblSize = fitSize(fonts, col.label, "body", 600, labelSize, colMaxW, 1.5);
    const lbl = makeText(fonts, { text: col.label, role: "body", weight: 600, size: lblSize, color: accent, anchor: { x: 0, y: 0 }, letterSpacing: 1.5 });
    lbl.position.set(col.x, rowTop);
    holder.addChild(lbl);
    const valSize = fitSize(fonts, col.value, "display", 700, valueSize, colMaxW);
    const val = makeText(fonts, { text: col.value, role: "display", weight: 700, size: valSize, color: textColor, anchor: { x: 0, y: 0 } });
    val.position.set(col.x, rowTop + labelSize * 1.35);
    holder.addChild(val);
    card.addChild(holder);
    const start = 1.72 + i * 0.13;
    timeline
      .to(holder, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(holder, { prop: "y", from: 14, to: 0, start, duration: 0.45, ease: outQuint });
  });

  return { timeline, duration: 4.0 };
}

export const hotelCard: TemplateDefinition = {
  id: "hotel-card",
  name: "Hotel Card",
  tagline: "A booking card settles in: photo, stars, and a price pill.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { name: "display" },
  palettes: PALETTES,
  fields: [
    { key: "image", type: "image", label: "Hotel photo", default: "", optional: true, help: "Fills the photo strip; a wide exterior or room shot works best." },
    { key: "name", type: "text", label: "Hotel name", default: "The Marchetti", maxLength: 32, shrinkToFit: true },
    { key: "location", type: "text", label: "Location", default: "Lisbon, Portugal", maxLength: 40, shrinkToFit: true },
    { key: "rating", type: "slider", label: "Star rating", default: 4, min: 1, max: 5, step: 1 },
    { key: "checkIn", type: "text", label: "Check-in", default: "Fri, Aug 14", maxLength: 18 },
    { key: "checkOut", type: "text", label: "Check-out", default: "Sun, Aug 16", maxLength: 18 },
    { key: "price", type: "text", label: "Price", default: "$129/night", maxLength: 16 },
    { key: "showStars", type: "toggle", label: "Star rating", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
