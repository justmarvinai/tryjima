import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", accent: "#FF4D1C", textColor: "#14140F", onAccent: "#FFFFFF", muted: "#B8B2A4" } },
  { id: "violet-cream", name: "Violet cream", colors: { background: "#F2EEFB", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF", muted: "#C3B7E0" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF", muted: "#AFC4E2" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A", muted: "#4A5560" } },
];

/** Largest size ≤ size0 at which `text` fits `maxWidth` on one line. */
function fitSize(
  fonts: TemplateContext["fonts"],
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return maxWidth > 0 && w > maxWidth ? Math.max(10, Math.floor((size0 * maxWidth) / w)) : size0;
}

function cyFracFor(aspect: Aspect): number {
  return aspect === "9:16" ? 0.46 : aspect === "4:5" ? 0.48 : 0.5;
}

/** A filled arrowhead triangle with its tip at (0,0), pointing along (dx,dy). */
function arrowTri(dx: number, dy: number, ah: number, ahLen: number, color: string): Graphics {
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const px = -uy;
  const py = ux;
  const bx = -ux * ahLen;
  const by = -uy * ahLen;
  return new Graphics().poly([0, 0, bx + px * ah, by + py * ah, bx - px * ah, by - py * ah]).fill(color);
}

/** A value chip that sits on a dimension line. */
function dimChip(
  fonts: TemplateContext["fonts"],
  text: string,
  fontSize: number,
  accent: string,
  onAccent: string,
): Container {
  const c = new Container();
  const label = makeText(fonts, { text, role: "display", weight: 700, size: fontSize, color: onAccent, anchor: 0.5 });
  const w = label.width + fontSize * 1.05;
  const h = fontSize * 1.55;
  c.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, h * 0.32).fill(accent));
  c.addChild(label);
  return c;
}

/** The product being measured: contain-fit image, or a clean box placeholder. */
function productNode(pw: number, ph: number, tex: Texture | null, accent: string): Container {
  const c = new Container();
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(Math.min(pw / tex.width, ph / tex.height));
    c.addChild(s);
  } else {
    const bw = pw * 0.82;
    const bh = ph * 0.9;
    const rr = Math.min(bw, bh) * 0.12;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, rr).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2 + bw * 0.1, -bh / 2 + bh * 0.08, bw * 0.24, bh * 0.84, rr * 0.6).fill({ color: "#FFFFFF", alpha: 0.22 }));
    c.addChild(new Graphics().circle(bw * 0.14, -bh * 0.02, Math.min(bw, bh) * 0.14).fill({ color: "#FFFFFF", alpha: 0.28 }));
  }
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const muted = pc("muted", "#B8B2A4");

  const name = str(values.name, "Model X");
  const height = str(values.height, "24 cm");
  const width = str(values.width, "9 cm");
  const depth = str(values.depth, "9 cm");
  const hasDepth = depth.length > 0;

  const W = size.width;
  const H = size.height;
  const cx = W / 2;
  const minDim = Math.min(W, H);
  const margin = Math.round(minDim * 0.06);
  const tex = images.product ?? null;
  root.addChild(new Graphics().rect(0, 0, W, H).fill(bg));
  const timeline = new JimaTimeline();

  const pW = minDim * 0.4;
  const pH = minDim * 0.48;
  const cy = H * cyFracFor(ctx.aspect);
  const gap = minDim * 0.07;
  const lineTh = Math.max(3, minDim * 0.006);
  const tickTh = Math.max(2, minDim * 0.0045);
  const ah = minDim * 0.016;
  const ahLen = minDim * 0.026;
  const chipFont = Math.round(minDim * 0.032);

  const left = cx - pW / 2;
  const right = cx + pW / 2;
  const topEdge = cy - pH / 2;
  const botEdge = cy + pH / 2;

  // --- Name (top) ---
  const nameSize0 = Math.round(minDim * (ctx.aspect === "16:9" ? 0.05 : 0.058));
  const nameSize = fitSize(fonts, name, "display", 700, nameSize0, W - margin * 2);
  const nameY = (ctx.aspect === "9:16" ? 220 : margin) + nameSize * 0.7;
  const nameText = makeText(fonts, { text: name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: 0.5, align: "center" });
  nameText.position.set(cx, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.8, duration: 0.45, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY - 16, to: nameY, start: 0.8, duration: 0.55, ease: outExpo });

  // --- Product + bounding outline ---
  const product = productNode(pW, pH, tex, accent);
  product.position.set(cx, cy);
  product.scale.set(0.85);
  product.alpha = 0;
  root.addChild(product);
  const bounds = new Graphics().roundRect(-pW / 2, -pH / 2, pW, pH, minDim * 0.02).stroke({ color: muted, width: Math.max(2, minDim * 0.004) });
  bounds.position.set(cx, cy);
  bounds.alpha = 0;
  root.addChild(bounds);
  timeline
    .to(product, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.4, ease: outQuad })
    .to(product, { prop: "scale.x", from: 0.85, to: 1, start: 0.2, duration: 0.7, ease: spring(0.5) })
    .to(product, { prop: "scale.y", from: 0.85, to: 1, start: 0.2, duration: 0.7, ease: spring(0.5) })
    .to(bounds, { prop: "alpha", from: 0, to: 1, start: 0.9, duration: 0.5, ease: outQuad });

  // Helper to add one dimension guide (line + arrowheads + witness ticks + chip).
  const addGuide = (opts: {
    vertical: boolean;
    lineX: number;
    lineY: number;
    length: number;
    text: string;
    start: number;
    witness: Array<{ x0: number; y0: number; x1: number; y1: number }>;
  }): void => {
    const { vertical, lineX, lineY, length, text, start, witness } = opts;

    // Witness (extension) ticks.
    witness.forEach((wln) => {
      const wl = Math.hypot(wln.x1 - wln.x0, wln.y1 - wln.y0);
      const g = new Graphics();
      if (wln.x0 === wln.x1) g.roundRect(-tickTh / 2, 0, tickTh, wl, tickTh / 2).fill(muted);
      else g.roundRect(0, -tickTh / 2, wl, tickTh, tickTh / 2).fill(muted);
      g.position.set(Math.min(wln.x0, wln.x1), Math.min(wln.y0, wln.y1));
      g.alpha = 0;
      root.addChild(g);
      timeline.to(g, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad });
    });

    // Main dimension line (draws from its center).
    const line = new Graphics();
    if (vertical) line.roundRect(-lineTh / 2, -length / 2, lineTh, length, lineTh / 2).fill(textColor);
    else line.roundRect(-length / 2, -lineTh / 2, length, lineTh, lineTh / 2).fill(textColor);
    line.position.set(lineX, lineY);
    line.scale.set(vertical ? 1 : 0, vertical ? 0 : 1);
    root.addChild(line);
    timeline.to(line, { prop: vertical ? "scale.y" : "scale.x", from: 0, to: 1, start: start + 0.1, duration: 0.5, ease: outExpo });

    // Arrowheads at both ends.
    const ends = vertical
      ? [{ x: lineX, y: lineY - length / 2, dx: 0, dy: -1 }, { x: lineX, y: lineY + length / 2, dx: 0, dy: 1 }]
      : [{ x: lineX - length / 2, y: lineY, dx: -1, dy: 0 }, { x: lineX + length / 2, y: lineY, dx: 1, dy: 0 }];
    ends.forEach((e) => {
      const head = arrowTri(e.dx, e.dy, ah, ahLen, textColor);
      head.position.set(e.x, e.y);
      head.scale.set(0);
      root.addChild(head);
      timeline
        .to(head, { prop: "scale.x", from: 0, to: 1, start: start + 0.45, duration: 0.35, ease: makeOutBack(2) })
        .to(head, { prop: "scale.y", from: 0, to: 1, start: start + 0.45, duration: 0.35, ease: makeOutBack(2) });
    });

    // Value chip on the line.
    const chip = dimChip(fonts, text, chipFont, accent, onAccent);
    chip.position.set(lineX, lineY);
    chip.scale.set(0);
    root.addChild(chip);
    timeline
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: start + 0.55, duration: 0.4, ease: makeOutBack(1.8) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: start + 0.55, duration: 0.4, ease: makeOutBack(1.8) });
  };

  // Height guide (vertical, to the right).
  const gx = right + gap;
  addGuide({
    vertical: true,
    lineX: gx,
    lineY: cy,
    length: pH,
    text: height,
    start: 1.1,
    witness: [
      { x0: right, y0: topEdge, x1: gx, y1: topEdge },
      { x0: right, y0: botEdge, x1: gx, y1: botEdge },
    ],
  });

  // Width guide (horizontal, below).
  const gy = botEdge + gap;
  addGuide({
    vertical: false,
    lineX: cx,
    lineY: gy,
    length: pW,
    text: width,
    start: 1.7,
    witness: [
      { x0: left, y0: botEdge, x1: left, y1: gy },
      { x0: right, y0: botEdge, x1: right, y1: gy },
    ],
  });

  // Depth guide (optional): short diagonal off the top-right corner.
  if (hasDepth) {
    const ang = -35 * (Math.PI / 180);
    const dLen = minDim * 0.14;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const ox = right;
    const oy = topEdge;
    const ex = ox + ux * dLen;
    const ey = oy + uy * dLen;
    const start = 2.25;

    const line = new Graphics().roundRect(0, -lineTh / 2, dLen, lineTh, lineTh / 2).fill(textColor);
    line.position.set(ox, oy);
    line.rotation = ang;
    line.pivot.set(0, 0);
    line.scale.set(0, 1);
    root.addChild(line);
    timeline.to(line, { prop: "scale.x", from: 0, to: 1, start, duration: 0.45, ease: outExpo });

    const head = arrowTri(ux, uy, ah, ahLen, textColor);
    head.position.set(ex, ey);
    head.scale.set(0);
    root.addChild(head);
    timeline
      .to(head, { prop: "scale.x", from: 0, to: 1, start: start + 0.35, duration: 0.35, ease: makeOutBack(2) })
      .to(head, { prop: "scale.y", from: 0, to: 1, start: start + 0.35, duration: 0.35, ease: makeOutBack(2) });

    const chip = dimChip(fonts, depth, chipFont, accent, onAccent);
    chip.position.set(ex + ux * chipFont * 1.2, ey + uy * chipFont * 1.2);
    chip.scale.set(0);
    root.addChild(chip);
    timeline
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: start + 0.45, duration: 0.4, ease: makeOutBack(1.8) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: start + 0.45, duration: 0.4, ease: makeOutBack(1.8) });
  }

  return { timeline, duration: 4.0 };
}

export const sizeCompare: TemplateDefinition = {
  id: "size-compare",
  name: "Size Compare",
  tagline: "Measurement guides draw around a product's dimensions.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  palettes: PALETTES,
  fields: [
    { key: "product", type: "image", label: "Product image", default: "", optional: true, help: "Centered between the guides; a clean product photo works best." },
    { key: "name", type: "text", label: "Name", default: "Model X", maxLength: 28, shrinkToFit: true },
    { key: "height", type: "text", label: "Height", default: "24 cm", maxLength: 12 },
    { key: "width", type: "text", label: "Width", default: "9 cm", maxLength: 12 },
    { key: "depth", type: "text", label: "Depth", default: "9 cm", maxLength: 12, optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
