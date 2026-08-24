import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  outQuint,
  outExpo,
  makeOutBack,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { dashedPath, arcPoints } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// A draft-to-done story: a faint drafting grid, a dashed wireframe of a UI card
// that traces itself on, dimension ticks with a measurement chip — then the
// wireframe crossfades into the finished, filled card and the title lands.
const PALETTES: Palette[] = [
  {
    id: "blueprint",
    name: "Blueprint",
    colors: {
      background: "#14355C", lineColor: "#BFD9F2", textColor: "#FFFFFF", accent: "#6FC7FF",
      cardColor: "#F4F8FC", cardInk: "#1E3A5C", muted: "#8FA9C6",
    },
  },
  {
    id: "paper",
    name: "Paper",
    colors: {
      background: "#F6F8FC", lineColor: "#3D5A7C", textColor: "#14273D", accent: "#2E7DF6",
      cardColor: "#FFFFFF", cardInk: "#14273D", muted: "#93A6BC",
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    colors: {
      background: "#EEEFF2", lineColor: "#41474F", textColor: "#1C1F24", accent: "#FF6A3C",
      cardColor: "#FFFFFF", cardInk: "#1C1F24", muted: "#9AA1AB",
    },
  },
  {
    id: "mint-draft",
    name: "Mint draft",
    colors: {
      background: "#EAF6EE", lineColor: "#2C5C44", textColor: "#0C2E1F", accent: "#12B76A",
      cardColor: "#FFFFFF", cardInk: "#0C2E1F", muted: "#8FB4A0",
    },
  },
];

/** Perimeter of a centered rounded rect as a flat polyline, clockwise from top-center. */
function roundRectPerimeter(w: number, h: number, r: number, steps = 5): number[] {
  const hw = w / 2;
  const hh = h / 2;
  const pts: number[] = [0, -hh, hw - r, -hh];
  pts.push(...arcPoints(hw - r, -hh + r, r, -Math.PI / 2, 0, steps));
  pts.push(hw, hh - r);
  pts.push(...arcPoints(hw - r, hh - r, r, 0, Math.PI / 2, steps));
  pts.push(-hw + r, hh);
  pts.push(...arcPoints(-hw + r, hh - r, r, Math.PI / 2, Math.PI, steps));
  pts.push(-hw, -hh + r);
  pts.push(...arcPoints(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, steps));
  pts.push(0, -hh);
  return pts;
}

/** The leading part of an open polyline, cut at `progress` (0..1) of its total length. */
function partialPolyline(pts: number[], progress: number): number[] {
  const p = clamp01(progress);
  let total = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    total += Math.hypot(pts[i + 2]! - pts[i]!, pts[i + 3]! - pts[i + 1]!);
  }
  const target = p * total;
  const out: number[] = [pts[0]!, pts[1]!];
  let acc = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i]!;
    const y0 = pts[i + 1]!;
    const x1 = pts[i + 2]!;
    const y1 = pts[i + 3]!;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len === 0) continue;
    if (acc + len <= target) {
      out.push(x1, y1);
      acc += len;
      continue;
    }
    const u = (target - acc) / len;
    out.push(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u);
    break;
  }
  return out;
}

/** Dashed outline of a centered rounded rect (drawn once). */
function dashedRoundRect(g: Graphics, w: number, h: number, r: number, dash: number, gap: number, lw: number, color: string): void {
  dashedPath(g, roundRectPerimeter(w, h, r), { dash, gap, width: lw, color, cap: "round" });
}

/** A small "picture" glyph for the filled media block's drawn fallback. */
function imageGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.roundRect(-0.5 * s, -0.42 * s, s, 0.84 * s, 0.12 * s).stroke({ color, width: Math.max(2, 0.055 * s) });
  g.circle(-0.18 * s, -0.14 * s, 0.1 * s).fill(color);
  g.poly([-0.44 * s, 0.34 * s, -0.12 * s, -0.04 * s, 0.06 * s, 0.14 * s, 0.28 * s, -0.12 * s, 0.46 * s, 0.34 * s]).fill(color);
  return g;
}

interface Cfg {
  cardWF: number; // card width as a fraction of frame width
  ratio: number; // card width / height
  maxHF: number; // card height cap as a fraction of safe height
}
const CFG: Record<Aspect, Cfg> = {
  "16:9": { cardWF: 0.37, ratio: 1.32, maxHF: 0.62 },
  "1:1": { cardWF: 0.62, ratio: 1.32, maxHF: 0.58 },
  "4:5": { cardWF: 0.66, ratio: 1.3, maxHF: 0.56 },
  "9:16": { cardWF: 0.7, ratio: 1.24, maxHF: 0.5 },
};

const OUTLINE_START = 0.15;
const OUTLINE_DUR = 0.95;
const WIRE_START = 1.0;
const WIRE_STAGGER = 0.12;
const DIM_START = 1.75;
const FILL_START = 2.45;
const FILL_DUR = 0.6;
const TITLE_START = 2.95;
const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#14355C"));
  const lineColor = str(values.wireColor, pc("lineColor", "#BFD9F2"));
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#6FC7FF"));
  const cardColor = pc("cardColor", "#F4F8FC");
  const cardInk = pc("cardInk", "#1E3A5C");
  const muted = pc("muted", "#8FA9C6");

  const title = str(values.title, "From draft to done");
  const measure = str(values.measure, "1080 × 640");
  const showGrid = on(values.showGrid);
  const showDims = on(values.showDims);
  const photo: Texture | null = images.image ?? null;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const cfg = CFG[ctx.aspect];
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Drafting grid (decorative, full frame, fades in then recedes) ---
  const grid = new Graphics();
  if (showGrid) {
    const step = minDim * 0.075;
    const lw = Math.max(1, minDim * 0.0012);
    for (let x = step; x < w; x += step) grid.moveTo(x, 0).lineTo(x, h);
    for (let y = step; y < h; y += step) grid.moveTo(0, y).lineTo(w, y);
    grid.stroke({ color: lineColor, width: lw, alpha: 0.16 });
    grid.alpha = 0;
    root.addChild(grid);
    timeline
      .to(grid, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.45, ease: outQuad })
      .to(grid, { prop: "alpha", from: 1, to: 0.45, start: FILL_START, duration: FILL_DUR, ease: outQuad });
  }

  // --- Card geometry + vertical stack placement inside the safe area ---
  let cardW = w * cfg.cardWF;
  let cardH = cardW / cfg.ratio;
  const maxH = zone.height * cfg.maxHF;
  if (cardH > maxH) {
    cardH = maxH;
    cardW = cardH * cfg.ratio;
  }
  const cardR = cardW * 0.05;
  const dimOff = minDim * 0.045; // gap between card edge and dimension line
  const dimBlock = showDims ? dimOff + minDim * 0.035 : minDim * 0.012;
  const titleSize0 = Math.round(minDim * 0.048);
  const titleSize = fitSize(fonts, title, "display", 700, titleSize0, zone.width * 0.86);
  const titleGap = minDim * 0.035;
  const totalH = cardH + dimBlock + titleGap + titleSize;
  const cardCy = zone.y + Math.max(0, (zone.height - totalH) / 2) + cardH / 2;
  const titleY = cardCy + cardH / 2 + dimBlock + titleGap + titleSize * 0.55;

  const card = new Container();
  card.position.set(cx, cardCy);
  root.addChild(card);

  // Inner layout shared by the wireframe and the filled version.
  const pad = cardW * 0.07;
  const innerW = cardW - pad * 2;
  const mediaH = cardH * 0.42;
  const mediaY = -cardH / 2 + pad; // top of media block
  const lineW = Math.max(1.5, minDim * 0.0028);
  const dash = minDim * 0.012;
  const dashGap = minDim * 0.008;
  const barH = cardH * 0.052;
  const headY = mediaY + mediaH + cardH * 0.075;
  const line1Y = headY + cardH * 0.1;
  const line2Y = line1Y + cardH * 0.075;
  const btnW = innerW * 0.36;
  const btnH = cardH * 0.115;
  const btnY = cardH / 2 - pad - btnH;

  // --- Wireframe (dashed) version ---
  const wire = new Container();
  card.addChild(wire);

  // Outline traces on per frame (geometry can't tween — redrawn in update).
  const perim = roundRectPerimeter(cardW, cardH, cardR);
  const outlineG = new Graphics();
  wire.addChild(outlineG);
  const pen = new Graphics().circle(0, 0, Math.max(3, minDim * 0.006)).fill(accent);
  pen.alpha = 0;
  wire.addChild(pen);

  interface WireItem {
    node: Container;
    start: number;
  }
  const wireItems: WireItem[] = [];
  const addWire = (node: Container, i: number): void => {
    node.alpha = 0;
    wire.addChild(node);
    wireItems.push({ node, start: WIRE_START + i * WIRE_STAGGER });
  };

  // Media block: dashed rect + drafting cross.
  const mediaWire = new Graphics();
  dashedRoundRect(mediaWire, innerW, mediaH, cardR * 0.6, dash, dashGap, lineW, lineColor);
  dashedPath(mediaWire, [-innerW / 2, -mediaH / 2, innerW / 2, mediaH / 2], { dash, gap: dashGap, width: lineW, color: lineColor, cap: "round" });
  dashedPath(mediaWire, [innerW / 2, -mediaH / 2, -innerW / 2, mediaH / 2], { dash, gap: dashGap, width: lineW, color: lineColor, cap: "round" });
  const mediaWireWrap = new Container();
  mediaWireWrap.addChild(mediaWire);
  mediaWireWrap.position.set(0, mediaY + mediaH / 2);
  addWire(mediaWireWrap, 0);

  // Headline + text-line bars (dashed outlines).
  const makeBarWire = (bw: number, bh: number, y: number, i: number): void => {
    const g = new Graphics();
    dashedRoundRect(g, bw, bh, bh / 2, dash * 0.8, dashGap * 0.8, lineW, lineColor);
    const wrap = new Container();
    wrap.addChild(g);
    wrap.position.set(-innerW / 2 + bw / 2, y);
    addWire(wrap, i);
  };
  makeBarWire(innerW * 0.62, barH, headY, 1);
  makeBarWire(innerW * 0.92, barH * 0.55, line1Y, 2);
  makeBarWire(innerW * 0.74, barH * 0.55, line2Y, 3);

  // CTA button outline.
  const btnWire = new Graphics();
  dashedRoundRect(btnWire, btnW, btnH, btnH / 2, dash * 0.8, dashGap * 0.8, lineW, lineColor);
  const btnWireWrap = new Container();
  btnWireWrap.addChild(btnWire);
  btnWireWrap.position.set(-innerW / 2 + btnW / 2, btnY + btnH / 2);
  addWire(btnWireWrap, 4);

  for (const item of wireItems) {
    timeline
      .to(item.node, { prop: "alpha", from: 0, to: 1, start: item.start, duration: 0.35, ease: outQuad })
      .to(item.node, { prop: "scale.x", from: 0.9, to: 1, start: item.start, duration: 0.45, ease: outQuint })
      .to(item.node, { prop: "scale.y", from: 0.9, to: 1, start: item.start, duration: 0.45, ease: outQuint });
  }
  // The whole wireframe yields to the filled card.
  timeline.to(wire, { prop: "alpha", from: 1, to: 0, start: FILL_START, duration: FILL_DUR, ease: outQuad });

  // --- Dimension ticks + measurement chip (decorative) ---
  if (showDims) {
    const dims = new Container();
    card.addChild(dims);
    const tick = minDim * 0.012;
    const dimLW = Math.max(1.5, minDim * 0.0022);

    const bottomDim = new Container();
    const bY = cardH / 2 + dimOff;
    const bLine = new Graphics()
      .moveTo(-cardW / 2, bY).lineTo(cardW / 2, bY)
      .moveTo(-cardW / 2, bY - tick).lineTo(-cardW / 2, bY + tick)
      .moveTo(cardW / 2, bY - tick).lineTo(cardW / 2, bY + tick)
      .stroke({ color: lineColor, width: dimLW, cap: "round" });
    bLine.scale.x = 0;
    bottomDim.addChild(bLine);
    dims.addChild(bottomDim);
    timeline.to(bLine, { prop: "scale.x", from: 0, to: 1, start: DIM_START, duration: 0.45, ease: outExpo });

    const rX = cardW / 2 + dimOff;
    const rLine = new Graphics()
      .moveTo(rX, -cardH / 2).lineTo(rX, cardH / 2)
      .moveTo(rX - tick, -cardH / 2).lineTo(rX + tick, -cardH / 2)
      .moveTo(rX - tick, cardH / 2).lineTo(rX + tick, cardH / 2)
      .stroke({ color: lineColor, width: dimLW, cap: "round" });
    rLine.scale.y = 0;
    dims.addChild(rLine);
    timeline.to(rLine, { prop: "scale.y", from: 0, to: 1, start: DIM_START + 0.12, duration: 0.45, ease: outExpo });

    // Measurement chip knocked out of the bottom dimension line.
    const mSize = Math.round(minDim * 0.024);
    const mFit = fitSize(fonts, measure, "mono", 500, mSize, cardW * 0.5);
    const mText = makeText(fonts, { text: measure, role: "mono", weight: 500, size: mFit, color: textColor, anchor: 0.5, letterSpacing: 1 });
    const chipW = mText.width + mFit * 1.4;
    const chipH = mFit * 1.9;
    const chip = new Container();
    chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill(bg));
    chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).stroke({ color: accent, width: Math.max(1.5, minDim * 0.002) }));
    chip.addChild(mText);
    chip.position.set(0, bY);
    chip.alpha = 0;
    chip.scale.set(0.6);
    dims.addChild(chip);
    timeline
      .to(chip, { prop: "alpha", from: 0, to: 1, start: DIM_START + 0.28, duration: 0.3, ease: outQuad })
      .to(chip, { prop: "scale.x", from: 0.6, to: 1, start: DIM_START + 0.28, duration: 0.45, ease: makeOutBack(1.8) })
      .to(chip, { prop: "scale.y", from: 0.6, to: 1, start: DIM_START + 0.28, duration: 0.45, ease: makeOutBack(1.8) });

    // Corner registration crosshairs.
    const cross = new Graphics();
    const cs = minDim * 0.011;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const px = (sx * cardW) / 2;
        const py = (sy * cardH) / 2;
        cross.moveTo(px - cs, py).lineTo(px + cs, py).moveTo(px, py - cs).lineTo(px, py + cs);
      }
    }
    cross.stroke({ color: accent, width: dimLW, cap: "round" });
    cross.alpha = 0;
    dims.addChild(cross);
    timeline.to(cross, { prop: "alpha", from: 0, to: 0.9, start: DIM_START + 0.2, duration: 0.35, ease: outQuad });

    // Annotations step aside once the build is "done".
    timeline.to(dims, { prop: "alpha", from: 1, to: 0, start: FILL_START, duration: 0.45, ease: outQuad });
  }

  // --- Filled, finished card (crossfades in over the wireframe) ---
  const solid = new Container();
  solid.alpha = 0;
  solid.scale.set(0.985);
  card.addChild(solid);

  solid.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.03, cardW, cardH, cardR).fill({ color: "#000000", alpha: 0.18 }));
  solid.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardColor));

  const mediaR = cardR * 0.6;
  const mediaCy = mediaY + mediaH / 2;
  const mediaHolder = new Container();
  const mediaMask = new Graphics().roundRect(-innerW / 2, -mediaH / 2, innerW, mediaH, mediaR).fill(0xffffff);
  if (photo) {
    const sprite = new Sprite(photo);
    sprite.anchor.set(0.5);
    const cover = Math.max(innerW / photo.width, mediaH / photo.height);
    sprite.scale.set(cover);
    mediaHolder.addChild(sprite);
  } else {
    mediaHolder.addChild(new Graphics().roundRect(-innerW / 2, -mediaH / 2, innerW, mediaH, mediaR).fill({ color: accent, alpha: 0.16 }));
    mediaHolder.addChild(imageGlyph(mediaH * 0.5, accent));
  }
  mediaHolder.mask = mediaMask;
  const mediaWrap = new Container();
  mediaWrap.addChild(mediaHolder, mediaMask);
  mediaWrap.position.set(0, mediaCy);
  solid.addChild(mediaWrap);

  const solidBar = (bw: number, bh: number, y: number, color: string, alpha: number): void => {
    solid.addChild(new Graphics().roundRect(-innerW / 2, y - bh / 2, bw, bh, bh / 2).fill({ color, alpha }));
  };
  solidBar(innerW * 0.62, barH, headY, cardInk, 1);
  solidBar(innerW * 0.92, barH * 0.55, line1Y, muted, 0.8);
  solidBar(innerW * 0.74, barH * 0.55, line2Y, muted, 0.8);
  const btn = new Graphics().roundRect(-innerW / 2, btnY, btnW, btnH, btnH / 2).fill(accent);
  solid.addChild(btn);
  solid.addChild(new Graphics().roundRect(-innerW / 2 + btnW * 0.24, btnY + btnH * 0.38, btnW * 0.52, btnH * 0.24, btnH * 0.12).fill("#FFFFFF"));

  timeline
    .to(solid, { prop: "alpha", from: 0, to: 1, start: FILL_START, duration: FILL_DUR, ease: outQuad })
    .to(solid, { prop: "scale.x", from: 0.985, to: 1, start: FILL_START, duration: FILL_DUR + 0.15, ease: outQuint })
    .to(solid, { prop: "scale.y", from: 0.985, to: 1, start: FILL_START, duration: FILL_DUR + 0.15, ease: outQuint })
    // A tiny settle pulse as the finished card lands.
    .to(card, { prop: "scale.x", from: 1, to: 1.012, start: FILL_START + FILL_DUR, duration: 0.14, ease: outQuad })
    .to(card, { prop: "scale.x", from: 1.012, to: 1, start: FILL_START + FILL_DUR + 0.14, duration: 0.25, ease: outQuad })
    .to(card, { prop: "scale.y", from: 1, to: 1.012, start: FILL_START + FILL_DUR, duration: 0.14, ease: outQuad })
    .to(card, { prop: "scale.y", from: 1.012, to: 1, start: FILL_START + FILL_DUR + 0.14, duration: 0.25, ease: outQuad });

  // --- Title below ---
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, titleY + 16);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: TITLE_START, duration: 0.45, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + 16, to: titleY, start: TITLE_START, duration: 0.55, ease: outQuint });

  const update = (t: number): void => {
    const p = outCubic(clamp01((t - OUTLINE_START) / OUTLINE_DUR));
    outlineG.clear();
    if (p <= 0.002) {
      pen.alpha = 0;
      return;
    }
    const poly = partialPolyline(perim, p);
    dashedPath(outlineG, poly, { dash, gap: dashGap, width: lineW, color: lineColor, cap: "round" });
    // Pen dot rides the leading tip while drawing.
    if (p < 0.999 && poly.length >= 2) {
      pen.position.set(poly[poly.length - 2]!, poly[poly.length - 1]!);
      pen.alpha = 1;
    } else {
      pen.alpha = 0;
    }
  };

  return { timeline, duration: DURATION, update };
}

export const blueprintReveal: TemplateDefinition = {
  id: "blueprint-reveal",
  name: "Blueprint Reveal",
  tagline: "A dashed wireframe drafts itself on, then fills into the finished card.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.7,
  fontRoles: { title: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "From draft to done", maxLength: 34, shrinkToFit: true },
    { key: "measure", type: "text", label: "Measurement label", default: "1080 × 640", maxLength: 14, shrinkToFit: true },
    { key: "image", type: "image", label: "Card image", default: "", optional: true, help: "Shown in the finished card once the wireframe fills in." },
    { key: "showGrid", type: "toggle", label: "Drafting grid", default: true },
    { key: "showDims", type: "toggle", label: "Dimension ticks", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "wireColor", type: "color", label: "Wireframe lines", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
