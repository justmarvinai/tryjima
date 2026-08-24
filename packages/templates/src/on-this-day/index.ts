import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  linear,
  outQuad,
  outCubic,
  outExpo,
  outQuint,
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
const on = (v: unknown): boolean => v !== false;

/** Rough perceived luminance of a #rrggbb color (0..1). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** Largest size <= size0 at which `text` fits maxWidth (crisp, single-line). */
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
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size: size0,
    ...(letterSpacing ? { letterSpacing } : {}),
  });
  return w > maxWidth ? Math.max(10, Math.floor((size0 * maxWidth) / w)) : size0;
}

// cardColor / kickerColor / onAccent / tape / photoBg are palette-only roles —
// the polaroid frame, tape strips and photo well keep their album look (and
// their contrast) whatever background/text/accent the user picks.
const PALETTES: Palette[] = [
  { id: "album-cream", name: "Album cream", colors: { background: "#F7F1E6", cardColor: "#FFFFFF", textColor: "#241B0E", kickerColor: "#8A5A14", accent: "#A4551E", onAccent: "#FFFFFF", tape: "#EAD9A8", photoBg: "#E9DFCC" } },
  { id: "sea-glass", name: "Sea glass", colors: { background: "#EAF4F6", cardColor: "#FFFFFF", textColor: "#0B2A33", kickerColor: "#0F6B80", accent: "#147D94", onAccent: "#FFFFFF", tape: "#CDE3DF", photoBg: "#D8E9EC" } },
  { id: "rose-album", name: "Rose album", colors: { background: "#FFF0F0", cardColor: "#FFFFFF", textColor: "#35171A", kickerColor: "#B23841", accent: "#C6434B", onAccent: "#FFFFFF", tape: "#F2D9B8", photoBg: "#F6DEDD" } },
  { id: "dusk-frame", name: "Dusk frame", colors: { background: "#14151C", cardColor: "#F5F1E8", textColor: "#241B0E", kickerColor: "#E8B54A", accent: "#E8B54A", onAccent: "#1E1F29", tape: "#D9C79A", photoBg: "#2A2B38" } },
];

const CARD_AT = 0.28;
const TAPE_AT = 1.05;
const CHIP_AT = 1.5;
const CAPTION_AT = 1.85;
const DURATION = 4.3;
const FINAL_TILT = -0.015;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F7F1E6"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#241B0E"));
  const kickerColor = pc("kickerColor", "#8A5A14");
  const accent = str(values.accent, pc("accent", "#A4551E"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const tapeColor = pc("tape", "#EAD9A8");
  const photoBg = pc("photoBg", "#E9DFCC");

  const kicker = str(values.kicker, "ON THIS DAY");
  const date = str(values.date, "July 25, 2025");
  const caption = str(values.caption, "Golden hour, one year ago");
  const showTape = on(values.showTape);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Polaroid geometry ---
  const ks = Math.round(minDim * 0.03);
  const kickerSize = fitSize(fonts, kicker, "body", 600, ks, safe.width * 0.86, 3);
  const kickerH = kickerSize * 1.3;
  const gapK = minDim * 0.032;
  const fw = Math.min(safe.width * 0.84, minDim * 0.68, (safe.height - kickerH - gapK) / 1.2);
  const m = fw * 0.05;
  const innerW = fw - 2 * m;
  const innerH = fw * 0.88;
  const bandH = fw * 0.22;
  const ch = m + innerH + bandH;

  const totalH = kickerH + gapK + ch;
  const top = safe.y + Math.max(0, (safe.height - totalH) / 2);

  // --- Kicker with flanking accent dots ---
  const kickerCy = top + kickerH / 2;
  const kickerC = new Container();
  const kText = makeText(fonts, { text: kicker, role: "body", weight: 600, size: kickerSize, color: kickerColor, anchor: 0.5, letterSpacing: 3 });
  kickerC.addChild(kText);
  const dotR = Math.max(3, kickerSize * 0.16);
  const dotGap = kText.width / 2 + kickerSize * 1.1;
  kickerC.addChild(new Graphics().circle(-dotGap, 0, dotR).fill(accent));
  kickerC.addChild(new Graphics().circle(dotGap, 0, dotR).fill(accent));
  kickerC.position.set(cx, kickerCy);
  kickerC.alpha = 0;
  root.addChild(kickerC);
  timeline
    .to(kickerC, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.45, ease: outQuad })
    .to(kickerC, { prop: "y", from: kickerCy - 12, to: kickerCy, start: 0.1, duration: 0.5, ease: outExpo });

  // --- Card (frame + photo + caption band), sliding up with a settling tilt ---
  const cardCy = top + kickerH + gapK + ch / 2;
  const cardC = new Container();
  cardC.position.set(cx, cardCy + minDim * 0.06);
  cardC.alpha = 0;
  cardC.rotation = -0.055;
  cardC.scale.set(0.97);
  root.addChild(cardC);

  const radius = fw * 0.02;
  const shadow = new Graphics().roundRect(-fw / 2, -ch / 2, fw, ch, radius).fill({ color: 0x000000, alpha: 0.16 });
  shadow.position.set(0, fw * 0.022);
  cardC.addChild(shadow);
  cardC.addChild(new Graphics().roundRect(-fw / 2, -ch / 2, fw, ch, radius).fill(cardColor));

  timeline
    .to(cardC, { prop: "alpha", from: 0, to: 1, start: CARD_AT, duration: 0.3, ease: outQuad })
    .to(cardC, { prop: "y", from: cardCy + minDim * 0.06, to: cardCy, start: CARD_AT, duration: 0.75, ease: outQuint })
    .to(cardC, { prop: "rotation", from: -0.055, to: FINAL_TILT, start: CARD_AT, duration: 0.8, ease: outCubic })
    .to(cardC, { prop: "scale.x", from: 0.97, to: 1, start: CARD_AT, duration: 0.7, ease: outCubic })
    .to(cardC, { prop: "scale.y", from: 0.97, to: 1, start: CARD_AT, duration: 0.7, ease: outCubic });

  // --- Photo well (image field with a drawn memory-scene fallback) ---
  const photoTop = -ch / 2 + m;
  const photoCy = photoTop + innerH / 2;
  const photoWrap = new Container();
  photoWrap.position.set(0, photoCy);
  cardC.addChild(photoWrap);
  const photoHolder = new Container();
  photoWrap.addChild(photoHolder);

  const tex: Texture | null = images.photo ?? null;
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(innerW / tex.width, innerH / tex.height);
    s.scale.set(cover);
    photoHolder.addChild(s);
  } else {
    const scene = new Graphics();
    const bleedW = innerW * 1.15;
    const bleedH = innerH * 1.15;
    scene.rect(-bleedW / 2, -bleedH / 2, bleedW, bleedH).fill(photoBg);
    // Warm sun + soft mountain silhouettes — a gentle memory placeholder.
    scene.circle(innerW * 0.2, -innerH * 0.2, innerW * 0.13).fill("#F6C15B");
    const inkAlpha = luminance(photoBg) < 0.5 ? { color: 0xffffff, alpha: 0.1 } : { color: 0x1b1d26, alpha: 0.12 };
    scene
      .poly([-bleedW / 2, bleedH / 2, -innerW * 0.16, -innerH * 0.06, innerW * 0.3, bleedH / 2])
      .fill(inkAlpha);
    scene
      .poly([-innerW * 0.05, bleedH / 2, innerW * 0.34, -innerH * 0.16, bleedW / 2, bleedH / 2])
      .fill(luminance(photoBg) < 0.5 ? { color: 0xffffff, alpha: 0.16 } : { color: 0x1b1d26, alpha: 0.18 });
    photoHolder.addChild(scene);
  }

  const photoMask = new Graphics().roundRect(-innerW / 2, -innerH / 2, innerW, innerH, fw * 0.012).fill(0xffffff);
  photoMask.position.set(0, photoCy);
  cardC.addChild(photoMask);
  photoWrap.mask = photoMask;

  // Ken-Burns-free hold: subtle scale drift only, no pan.
  timeline
    .to(photoHolder, { prop: "scale.x", from: 1.03, to: 1.065, start: 1.0, duration: 3.1, ease: linear })
    .to(photoHolder, { prop: "scale.y", from: 1.03, to: 1.065, start: 1.0, duration: 3.1, ease: linear });

  // --- Paper tape strips across the top corners ---
  if (showTape) {
    const tw = fw * 0.3;
    const th = fw * 0.078;
    const mkTape = (): Graphics =>
      new Graphics().roundRect(-tw / 2, -th / 2, tw, th, th * 0.22).fill({ color: tapeColor, alpha: 0.88 });
    const tapeL = mkTape();
    tapeL.position.set(-fw / 2 + fw * 0.035, -ch / 2 + fw * 0.035);
    tapeL.rotation = -Math.PI / 4;
    const tapeR = mkTape();
    tapeR.position.set(fw / 2 - fw * 0.035, -ch / 2 + fw * 0.035);
    tapeR.rotation = Math.PI / 4;
    for (const [tape, at] of [
      [tapeL, TAPE_AT],
      [tapeR, TAPE_AT + 0.13],
    ] as const) {
      tape.alpha = 0;
      tape.scale.set(1.35);
      cardC.addChild(tape);
      timeline
        .to(tape, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.2, ease: outQuad })
        .to(tape, { prop: "scale.x", from: 1.35, to: 1, start: at, duration: 0.35, ease: outCubic })
        .to(tape, { prop: "scale.y", from: 1.35, to: 1, start: at, duration: 0.35, ease: outCubic });
    }
  }

  // --- Date chip on the photo's bottom edge ---
  const chipH = fw * 0.085;
  const dateSize = fitSize(fonts, date, "body", 600, Math.round(chipH * 0.44), fw * 0.6);
  const dateText = makeText(fonts, { text: date, role: "body", weight: 600, size: dateSize, color: onAccent, anchor: { x: 0, y: 0.5 } });
  const heartS = chipH * 0.42;
  const chipPadX = chipH * 0.5;
  const chipW = chipPadX + heartS + chipH * 0.24 + dateText.width + chipPadX;
  const chip = new Container();
  chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill(accent));
  const heart = makeIcon("heart", heartS, { color: onAccent });
  heart.position.set(-chipW / 2 + chipPadX + heartS / 2, 0);
  chip.addChild(heart);
  dateText.position.set(-chipW / 2 + chipPadX + heartS + chipH * 0.24, 0);
  chip.addChild(dateText);
  chip.position.set(-fw / 2 + m + chipW / 2 + fw * 0.02, photoTop + innerH);
  chip.scale.set(0);
  cardC.addChild(chip);
  timeline
    .to(chip, { prop: "scale.x", from: 0, to: 1, start: CHIP_AT, duration: 0.5, ease: makeOutBack(1.8) })
    .to(chip, { prop: "scale.y", from: 0, to: 1, start: CHIP_AT, duration: 0.5, ease: makeOutBack(1.8) });

  // --- Handwritten caption on the frame's bottom band ---
  const capSize = fitSize(fonts, caption, "serif", 600, Math.round(fw * 0.072), innerW * 0.94);
  const capCy = photoTop + innerH + bandH * 0.56;
  const capText = makeText(fonts, { text: caption, role: "serif", weight: 600, size: capSize, color: textColor, anchor: 0.5 });
  capText.position.set(0, capCy);
  capText.alpha = 0;
  cardC.addChild(capText);
  timeline
    .to(capText, { prop: "alpha", from: 0, to: 1, start: CAPTION_AT, duration: 0.5, ease: outQuad })
    .to(capText, { prop: "y", from: capCy + 10, to: capCy, start: CAPTION_AT, duration: 0.5, ease: outCubic });

  return { timeline, duration: DURATION };
}

export const onThisDay: TemplateDefinition = {
  id: "on-this-day",
  name: "On This Day",
  tagline: "A taped-down memory slides in, gets its date stamp, and holds like a keepsake.",
  category: "social",
  aspects: ["4:5", "1:1", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { caption: "serif", kicker: "body", date: "body" },
  palettes: PALETTES,
  fields: [
    { key: "photo", type: "image", label: "Photo", default: "", optional: true, help: "Fills the frame; a favorite memory works best." },
    { key: "kicker", type: "text", label: "Kicker", default: "ON THIS DAY", maxLength: 20, shrinkToFit: true },
    { key: "date", type: "text", label: "Date", default: "July 25, 2025", maxLength: 24, shrinkToFit: true },
    { key: "caption", type: "text", label: "Caption", default: "Golden hour, one year ago", maxLength: 40, shrinkToFit: true },
    { key: "showTape", type: "toggle", label: "Tape corners", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Caption", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
