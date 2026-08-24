import { Container, Graphics, FillGradient } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  inQuad,
  makeOutBack,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

function fitSize(fonts: FontRegistry, text: string, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family("display"), weight, size });
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}

// A photo card flips (scale.x through 0) to reveal a second photo — a clean
// before → after. Faces are gradient "photos"; the swap happens at the edge-on
// midpoint via a pure update(t) hook so re-seek stays pixel-identical.
const CHIP = "#111318";
const PALETTES: Palette[] = [
  { id: "pop", name: "Pop", colors: { background: "#EEF0F6", a1: "#8A93A6", a2: "#BBC2CE", b1: "#FF5FA2", b2: "#FFA45B", accent: "#FF4D6D", textColor: "#14151B" } },
  { id: "verdant", name: "Verdant", colors: { background: "#EAF3EC", a1: "#9AA79A", a2: "#C4CCBE", b1: "#12B76A", b2: "#8DD35F", accent: "#0E8F5B", textColor: "#08301F" } },
  { id: "azure", name: "Azure", colors: { background: "#EAF2FB", a1: "#8FA0B5", a2: "#BFCAD8", b1: "#2E9BFF", b2: "#7C5CFF", accent: "#2E5BD6", textColor: "#0F1B2A" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0E1017", a1: "#2A2E3C", a2: "#434A5E", b1: "#5B8CFF", b2: "#C13AE8", accent: "#5B8CFF", textColor: "#F2F4F8" } },
];

const RATIO: Record<Aspect, number> = { "16:9": 0.66, "1:1": 1.1, "4:5": 1.25, "9:16": 1.3 };

const FLIP_MID = 1.65;

function drawFace(pw: number, ph: number, r: number, c1: string, c2: string, label: string, showLabel: boolean, fonts: FontRegistry): Container {
  const c = new Container();
  const grad = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    colorStops: [
      { offset: 0, color: c1 },
      { offset: 1, color: c2 },
    ],
    textureSpace: "local",
  });
  c.addChild(new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, r).fill(grad));
  // Clipped decorative shapes.
  const clip = new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, r).fill(0xffffff);
  const shapes = new Container();
  shapes.addChild(new Graphics().circle(pw * 0.26, -ph * 0.22, pw * 0.34).fill({ color: "#FFFFFF", alpha: 0.16 }));
  shapes.addChild(new Graphics().circle(-pw * 0.28, ph * 0.3, pw * 0.24).fill({ color: "#000000", alpha: 0.12 }));
  c.addChild(shapes, clip);
  shapes.mask = clip;
  if (showLabel && label.length > 0) {
    const chipH = ph * 0.11;
    const lSize = fitSize(fonts, label, 700, Math.round(chipH * 0.5), pw * 0.7);
    const tw = fonts.measure(label, { family: fonts.family("display"), weight: 700, size: lSize });
    const chipW = tw + chipH * 1.4;
    const chip = new Container();
    chip.position.set(0, ph / 2 - chipH * 1.1);
    chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill({ color: CHIP, alpha: 0.82 }));
    chip.addChild(makeText(fonts, { text: label, role: "display", weight: 700, size: lSize, color: "#FFFFFF", anchor: 0.5 }));
    c.addChild(chip);
  }
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF0F6"));
  const a1 = pc("a1", "#8A93A6");
  const a2 = pc("a2", "#BBC2CE");
  const b1 = pc("b1", "#FF5FA2");
  const b2 = pc("b2", "#FFA45B");
  const accent = str(values.accent, pc("accent", "#FF4D6D"));
  const textColor = str(values.textColor, pc("textColor", "#14151B"));

  const title = str(values.title, "Before & After");
  const labelA = str(values.labelA, "Before");
  const labelB = str(values.labelB, "After");
  const showLabels = values.showLabels !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);
  const cx = w / 2;

  // Title on the page.
  const hasTitle = title.length > 0;
  const titleY = zone.y + minDim * 0.05;
  if (hasTitle) {
    const tSize = fitSize(fonts, title, 700, Math.round(minDim * 0.05), zone.width * 0.9);
    const tNode = makeText(fonts, { text: title, role: "display", weight: 700, size: tSize, color: textColor, anchor: 0.5, align: "center" });
    tNode.position.set(cx, titleY);
    tNode.alpha = 0;
    root.addChild(tNode);
    timeline
      .to(tNode, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
      .to(tNode, { prop: "y", from: titleY - 12, to: titleY, start: 0, duration: 0.5, ease: outExpo });
  }

  // Card geometry (fit inside the band below the title).
  const bandTop = hasTitle ? titleY + minDim * 0.06 : zone.y;
  const bandH = zone.y + zone.height - bandTop;
  const ratio = RATIO[ctx.aspect];
  let cardH = Math.min(bandH * 0.92, zone.width * 0.82 * ratio);
  let cardW = cardH / ratio;
  if (cardW > zone.width * 0.82) {
    cardW = zone.width * 0.82;
    cardH = cardW * ratio;
  }
  const cardCy = bandTop + bandH / 2;
  const r = Math.min(cardW, cardH) * 0.06;

  const card = new Container();
  card.position.set(cx, cardCy);
  card.alpha = 0;
  card.scale.set(0.9);
  root.addChild(card);

  // Shadow.
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.03, cardW, cardH, r).fill({ color: "#000000", alpha: 0.2 }));

  const faceA = drawFace(cardW, cardH, r, a1, a2, labelA, showLabels, fonts);
  const faceB = drawFace(cardW, cardH, r, b1, b2, labelB, showLabels, fonts);
  faceB.visible = false;
  card.addChild(faceA, faceB);

  // Accent hint chips ("A" / "B" corner)? Keep clean; the label pills carry it.

  // Entrance, then flip.
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.4, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.9, to: 1, start: 0.15, duration: 0.55, ease: makeOutBack(1.4) })
    .to(card, { prop: "scale.y", from: 0.9, to: 1, start: 0.15, duration: 0.55, ease: makeOutBack(1.4) })
    // Flip: 1 → 0 (edge-on) → 1.
    .to(card, { prop: "scale.x", from: 1, to: 0, start: 1.15, duration: 0.5, ease: inQuad })
    .to(card, { prop: "scale.x", from: 0, to: 1, start: FLIP_MID, duration: 0.5, ease: outExpo })
    // Subtle perspective bump on y during the flip.
    .to(card, { prop: "scale.y", from: 1, to: 1.05, start: 1.15, duration: 0.5, ease: outQuad })
    .to(card, { prop: "scale.y", from: 1.05, to: 1, start: FLIP_MID, duration: 0.5, ease: outQuad });

  // A soft accent glow pulse behind the card as it lands on the "after".
  const glow = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r).stroke({ color: accent, width: Math.max(3, minDim * 0.006) });
  glow.alpha = 0;
  card.addChildAt(glow, 1);
  timeline
    .to(glow, { prop: "alpha", from: 0, to: 0.9, start: FLIP_MID + 0.3, duration: 0.3, ease: outQuad })
    .to(glow, { prop: "alpha", from: 0.9, to: 0, start: FLIP_MID + 0.7, duration: 0.6, ease: outQuad });

  const update = (t: number): void => {
    const onB = t >= FLIP_MID;
    faceA.visible = !onB;
    faceB.visible = onB;
  };

  return { timeline, duration: 4.2, update };
}

export const photoFlip: TemplateDefinition = {
  id: "photo-flip",
  name: "Photo Flip",
  tagline: "A photo card flips edge-on to reveal the after shot.",
  category: "photo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { title: "display", labelA: "display", labelB: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Before & After", maxLength: 28, optional: true, shrinkToFit: true },
    { key: "labelA", type: "text", label: "Label A (before)", default: "Before", maxLength: 18, shrinkToFit: true },
    { key: "labelB", type: "text", label: "Label B (after)", default: "After", maxLength: 18, shrinkToFit: true },
    { key: "showLabels", type: "toggle", label: "Labels", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
