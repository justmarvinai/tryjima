import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outQuint,
  spring,
  safeZone,
  TRANSPARENT_BG,
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

/** Like `str`, but an explicit empty string is kept (clears optional rows). */
const strOpt = (v: unknown, fallback: string): string => (typeof v === "string" ? v : fallback);

/** Largest size <= size0 at which `text` fits `maxWidth` (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  letterSpacing = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0, letterSpacing });
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

// A broadcast "coming up" queue card docked lower-right: a kicker chip, a title,
// a timing line and a drawn thumbnail placeholder with a play glyph, plus a
// progress underline that fills while the card holds. Unlike chapter-marker
// (a bare lower-left chapter label), this is a self-contained queue card with
// thumbnail + schedule line. Only the full-frame `bg` rect is tied to the
// background field (defaults to the transparent sentinel so it composites
// straight onto footage); the card uses its own palette-only `cardBg` (with a
// soft shadow) and the thumbnail its own `thumbBg`, so both survive as overlay
// content once the canvas fill is gone. `accentText` is a fixed,
// contrast-checked color for text sitting on the accent chip/play button.
const PALETTES: Palette[] = [
  { id: "studio", name: "Studio", colors: { cardBg: "#FFFFFF", thumbBg: "#23262E", textColor: "#0B0B0F", accent: "#C81E3C", accentText: "#FFFFFF" } },
  { id: "broadcast-navy", name: "Broadcast navy", colors: { cardBg: "#101423", thumbBg: "#232A44", textColor: "#FFFFFF", accent: "#FFC53D", accentText: "#14120B" } },
  { id: "paper", name: "Paper", colors: { cardBg: "#FAF6EE", thumbBg: "#2A2317", textColor: "#221A0A", accent: "#B4530A", accentText: "#FFFFFF" } },
  { id: "emerald", name: "Emerald", colors: { cardBg: "#FFFFFF", thumbBg: "#10241B", textColor: "#0B1F16", accent: "#0B7A4B", accentText: "#FFFFFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const cardBg = pc("cardBg", "#FFFFFF");
  const thumbBg = pc("thumbBg", "#23262E");
  const textColor = str(values.textColor, pc("textColor", "#0B0B0F"));
  const accent = str(values.accent, pc("accent", "#C81E3C"));
  const accentText = pc("accentText", "#FFFFFF");

  const kicker = str(values.kicker, "UP NEXT").toUpperCase();
  const title = str(values.title, "The Studio Tour");
  const detail = strOpt(values.detail, "Tonight · 9:00 PM");
  const showThumb = values.showThumb !== false;
  const showProgress = values.showProgress !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const thumbH = Math.round(minDim * 0.105);
  const thumbW = Math.round(thumbH * 1.6);
  const padX = Math.round(minDim * 0.028);
  const padY = Math.round(minDim * 0.024);
  const gap = Math.round(minDim * 0.024);
  const rowGap = Math.round(minDim * 0.011);

  const kickSize0 = Math.round(minDim * 0.0165);
  const kickLS = kickSize0 * 0.16;
  const chipPadX = Math.round(kickSize0 * 0.9);
  const chipH = Math.round(kickSize0 * 2.1);

  const safeW = w - zone.left - zone.right;
  const cardMaxW = Math.min(safeW, Math.round(minDim * 0.78));
  const thumbBlock = showThumb ? thumbW + gap : 0;
  const maxTextW = Math.max(120, cardMaxW - padX * 2 - thumbBlock);

  const kickSize = fitSize(fonts, kicker, "body", 700, kickSize0, maxTextW - chipPadX * 2, kickLS);
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.034), maxTextW);
  const detailSize = detail.length > 0 ? fitSize(fonts, detail, "body", 600, Math.round(minDim * 0.02), maxTextW) : 0;

  const kickW = fonts.measure(kicker, { family: fonts.family("body"), weight: 700, size: kickSize, letterSpacing: kickLS });
  const chipW = Math.round(kickW + chipPadX * 2);
  const titleW = fonts.measure(title, { family: fonts.family("display"), weight: 700, size: titleSize });
  const detailW = detail.length > 0 ? fonts.measure(detail, { family: fonts.family("body"), weight: 600, size: detailSize }) : 0;
  const textBlockW = Math.max(chipW, titleW, detailW);

  const textColH = chipH + rowGap + titleSize + (detail.length > 0 ? Math.round(rowGap * 0.8) + detailSize : 0);
  const contentH = Math.max(showThumb ? thumbH : 0, textColH);
  const progH = showProgress ? Math.max(4, Math.round(minDim * 0.006)) : 0;
  const progGap = showProgress ? Math.round(minDim * 0.018) : 0;

  const cardW = padX * 2 + thumbBlock + textBlockW;
  const cardH = padY * 2 + contentH + progGap + progH;
  const cardRadius = Math.round(Math.min(cardH * 0.16, minDim * 0.024));

  const marginBottom = Math.round(minDim * 0.03);
  const cardCX = w - zone.right - cardW / 2;
  const cardCY = h - zone.bottom - marginBottom - cardH / 2;

  const card = new Container();
  card.position.set(cardCX, cardCY);
  card.alpha = 0;
  root.addChild(card);

  // Soft shadow so the card reads over any footage.
  const e = Math.round(cardH * 0.03);
  const off = Math.round(cardH * 0.05);
  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2 - e, -cardH / 2 - e + off, cardW + e * 2, cardH + e * 2, cardRadius + e)
      .fill({ color: "#000000", alpha: 0.16 }),
  );
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardRadius).fill(cardBg));

  const left = -cardW / 2 + padX;
  const contentTop = -cardH / 2 + padY;
  const contentCY = contentTop + contentH / 2;

  // --- Thumbnail placeholder (drawn — no real image needed) with play glyph. ---
  let playG: Container | undefined;
  if (showThumb) {
    const thumb = new Container();
    thumb.position.set(left + thumbW / 2, contentCY);
    card.addChild(thumb);

    const tr = Math.round(thumbH * 0.14);
    thumb.addChild(new Graphics().roundRect(-thumbW / 2, -thumbH / 2, thumbW, thumbH, tr).fill(thumbBg));
    // Faint "photo" placeholder art: a sun + two mountain wedges, kept inside
    // the rect bounds so no clipping is needed.
    const art = new Graphics();
    art.circle(-thumbW * 0.24, -thumbH * 0.2, thumbH * 0.13).fill({ color: "#FFFFFF", alpha: 0.2 });
    art
      .poly([-thumbW * 0.44, thumbH * 0.42, -thumbW * 0.1, -thumbH * 0.06, thumbW * 0.22, thumbH * 0.42])
      .fill({ color: "#FFFFFF", alpha: 0.13 });
    art
      .poly([thumbW * 0.02, thumbH * 0.42, thumbW * 0.28, thumbH * 0.02, thumbW * 0.46, thumbH * 0.42])
      .fill({ color: "#FFFFFF", alpha: 0.18 });
    thumb.addChild(art);

    playG = new Container();
    playG.scale.set(0);
    thumb.addChild(playG);
    playG.addChild(new Graphics().circle(0, 0, thumbH * 0.3).fill(accent));
    const tri = makeIcon("play", thumbH * 0.3, { color: accentText });
    tri.position.set(thumbH * 0.02, 0);
    playG.addChild(tri);
  }

  // --- Text column: kicker chip, title, detail. ---
  const textLeft = left + thumbBlock;
  const colTop = contentCY - textColH / 2;

  const chipC = new Container();
  chipC.position.set(textLeft + chipW / 2, colTop + chipH / 2);
  chipC.scale.set(0);
  card.addChild(chipC);
  chipC.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill(accent));
  const kickText = makeText(fonts, {
    text: kicker,
    role: "body",
    weight: 700,
    size: kickSize,
    color: accentText,
    letterSpacing: kickLS,
    anchor: 0.5,
  });
  // Letter-spacing trails the last glyph; nudge left to re-center optically.
  kickText.position.set(-kickLS / 2, 0);
  chipC.addChild(kickText);

  const titleCY = colTop + chipH + rowGap + titleSize / 2;
  const titleText = makeText(fonts, {
    text: title,
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  const slideIn = Math.round(minDim * 0.018);
  titleText.position.set(textLeft - slideIn, titleCY);
  titleText.alpha = 0;
  card.addChild(titleText);

  let detailText: ReturnType<typeof makeText> | undefined;
  if (detail.length > 0) {
    const detailCY = colTop + chipH + rowGap + titleSize + Math.round(rowGap * 0.8) + detailSize / 2;
    detailText = makeText(fonts, {
      text: detail,
      role: "body",
      weight: 600,
      size: detailSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    detailText.alpha = 0;
    detailText.position.set(textLeft - slideIn, detailCY);
    card.addChild(detailText);
  }

  // --- Progress underline (track + accent fill growing left → right). ---
  let progFill: Container | undefined;
  if (showProgress) {
    const trackW = cardW - padX * 2;
    const progCY = contentTop + contentH + progGap + progH / 2;
    card.addChild(
      new Graphics()
        .roundRect(left, progCY - progH / 2, trackW, progH, progH / 2)
        .fill({ color: textColor, alpha: 0.14 }),
    );
    progFill = new Container();
    progFill.position.set(left, progCY);
    progFill.scale.set(0, 1);
    progFill.addChild(new Graphics().roundRect(0, -progH / 2, trackW, progH, progH / 2).fill(accent));
    card.addChild(progFill);
  }

  // --- Motion: card slides in from the right, contents stagger, bar fills. ---
  const slideDist = Math.round(minDim * 0.14);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.35, ease: outQuad })
    .to(card, { prop: "x", from: cardCX + slideDist, to: cardCX, start: 0.1, duration: 0.65, ease: outQuint })
    .to(chipC, { prop: "scale.x", from: 0, to: 1, start: 0.5, duration: 0.45, ease: makeOutBack(1.8) })
    .to(chipC, { prop: "scale.y", from: 0, to: 1, start: 0.5, duration: 0.45, ease: makeOutBack(1.8) })
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.62, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "x", from: textLeft - slideIn, to: textLeft, start: 0.62, duration: 0.5, ease: outQuint });
  if (detailText) {
    timeline
      .to(detailText, { prop: "alpha", from: 0, to: 0.72, start: 0.74, duration: 0.4, ease: outQuad })
      .to(detailText, { prop: "x", from: textLeft - slideIn, to: textLeft, start: 0.74, duration: 0.5, ease: outQuint });
  }
  if (playG) {
    timeline
      .to(playG, { prop: "scale.x", from: 0, to: 1, start: 0.7, duration: 0.55, ease: spring(0.45) })
      .to(playG, { prop: "scale.y", from: 0, to: 1, start: 0.7, duration: 0.55, ease: spring(0.45) });
  }
  if (progFill) {
    timeline.to(progFill, { prop: "scale.x", from: 0, to: 1, start: 1.0, duration: 2.4, ease: outQuad });
  }

  return { timeline, duration: 4.2 };
}

export const upNext: TemplateDefinition = {
  id: "up-next",
  name: "Up Next",
  tagline: "An up-next queue card slides in with a thumbnail, title, and timing line.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { kicker: "body", title: "display", detail: "body" },
  palettes: PALETTES,
  fields: [
    { key: "kicker", type: "text", label: "Kicker", default: "UP NEXT", maxLength: 14, shrinkToFit: true },
    { key: "title", type: "text", label: "Title", default: "The Studio Tour", maxLength: 40, shrinkToFit: true },
    { key: "detail", type: "text", label: "Time / detail", default: "Tonight · 9:00 PM", maxLength: 28, optional: true, shrinkToFit: true },
    { key: "showThumb", type: "toggle", label: "Thumbnail", default: true },
    { key: "showProgress", type: "toggle", label: "Progress line", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
