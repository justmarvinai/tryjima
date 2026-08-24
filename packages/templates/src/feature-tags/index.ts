import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  spring,
  outExpo,
  outQuad,
  makeOutBack,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    // The layout reserves at least 2 tag slots (Math.max(2, …)); accept the array
    // only when it has ≥2 real items so a lone tag can't leave a lopsided slot.
    if (arr.length >= 2) return arr;
  }
  return fallback;
};

const DEFAULT_TAGS = ["Waterproof", "Lightweight", "2-yr warranty"];

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", imageBack: "#FFFFFF", accent: "#FF4D1C", textColor: "#14140F" } },
  { id: "electric-violet", name: "Electric violet", colors: { background: "#F1ECFB", imageBack: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", imageBack: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", imageBack: "#21252C", accent: "#C7F24A", textColor: "#FFFFFF" } },
];

/** Largest size ≤ size0 (down to minSize) at which `text` fits `maxWidth` on one line. */
function fitOneLine(
  fonts: TemplateContext["fonts"],
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  minSize = 12,
): number {
  const family = fonts.family(role);
  let size = size0;
  while (size > minSize && fonts.measure(text, { family, weight, size }) > maxWidth) size -= 1;
  return size;
}

/** A rounded product frame: cover-fit masked image, or a designed placeholder. */
function imageFrame(side: number, r: number, tex: Texture | null, imageBack: string, accent: string): Container {
  const c = new Container();
  const shadow = new Graphics().roundRect(-side / 2, -side / 2 + side * 0.03, side, side, r).fill({ color: 0x000000, alpha: 0.1 });
  c.addChild(shadow);
  c.addChild(new Graphics().roundRect(-side / 2, -side / 2, side, side, r).fill(imageBack));
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(side / tex.width, side / tex.height);
    s.scale.set(cover);
    const mask = new Graphics().roundRect(-side / 2, -side / 2, side, side, r).fill(0xffffff);
    c.addChild(s, mask);
    s.mask = mask;
  } else {
    c.addChild(new Graphics().circle(0, 0, side * 0.34).fill({ color: accent, alpha: 0.12 }));
    c.addChild(new Graphics().circle(0, 0, side * 0.24).fill({ color: accent, alpha: 0.2 }));
    const bw = side * 0.3;
    const bh = side * 0.42;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bw * 0.2).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh * 0.34, bw * 0.2).fill({ color: 0xffffff, alpha: 0.2 }));
  }
  return c;
}

type Side = "L" | "R" | "C";
interface Slot {
  side: Side;
  row: number;
}

/** Fixed, deterministic slot assignment for 2–4 tags around the central image. */
function slotsFor(n: number): Slot[] {
  if (n >= 4) return [{ side: "L", row: 0 }, { side: "R", row: 0 }, { side: "L", row: 1 }, { side: "R", row: 1 }];
  if (n === 3) return [{ side: "L", row: 0 }, { side: "R", row: 0 }, { side: "C", row: 1 }];
  return [{ side: "L", row: 0 }, { side: "R", row: 0 }];
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const imageBack = str(values.imageBack, pc("imageBack", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const showDots = values.showDots !== false;
  const tags = asItems(values.tags, DEFAULT_TAGS).slice(0, 4);
  const n = Math.max(2, tags.length);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const DUR = 4.6;

  // --- Central image card ---
  const hasBottom = n === 3;
  const cy = h * (hasBottom ? 0.43 : 0.47);
  const side = minDim * 0.34;
  const frameR = side * 0.1;
  const tex = images.image ?? null;
  const frame = imageFrame(side, frameR, tex, imageBack, accent);
  frame.position.set(cx, cy);
  frame.scale.set(0.85);
  frame.alpha = 0;
  root.addChild(frame);
  timeline
    .to(frame, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.35, ease: outQuad })
    .to(frame, { prop: "scale.x", from: 0.85, to: 1, start: 0.15, duration: 0.7, ease: spring(0.5) })
    .to(frame, { prop: "scale.y", from: 0.85, to: 1, start: 0.15, duration: 0.7, ease: spring(0.5) });

  // --- Floating tag chips, connected to the image by short leader dots ---
  const marginX = ctx.aspect === "9:16" ? 64 : minDim * 0.06;
  const gapOuter = minDim * 0.05;
  const railL = cx - side / 2 - gapOuter;
  const railR = cx + side / 2 + gapOuter;
  const availL = Math.max(60, railL - marginX);
  const availR = Math.max(60, w - marginX - railR);
  const rowGap = n === 2 ? 0 : side * 0.27;

  const chipFont0 = Math.round(minDim * 0.032);
  const padX = chipFont0 * 0.95;
  const padY = chipFont0 * 0.62;
  const pillH = chipFont0 + padY * 2;
  const dotR = Math.max(4, minDim * 0.012);
  const leaderTh = Math.max(2, minDim * 0.005);
  const strokeW = Math.max(1.5, chipFont0 * 0.07);

  const slots = slotsFor(n);

  tags.slice(0, n).forEach((tagRaw, i) => {
    const slot = slots[i] ?? { side: "L" as Side, row: 0 };
    const start = 1.0 + i * 0.38;

    if (slot.side === "C") {
      // Bottom-center chip, anchored above by its top edge.
      const maxW = Math.min(w - marginX * 2, side * 1.6);
      const fSize = fitOneLine(fonts, tagRaw, "body", 700, chipFont0, maxW - padX * 2);
      const textW = fonts.measure(tagRaw, { family: fonts.family("body"), weight: 700, size: fSize });
      const pillW = textW + padX * 2;
      const edgeY = cy + side / 2;
      const anchorY = edgeY + gapOuter;
      const chipCy = anchorY + pillH / 2;

      if (showDots) {
        const dot = new Graphics().circle(0, 0, dotR).fill(accent);
        dot.position.set(cx, edgeY);
        dot.scale.set(0);
        root.addChild(dot);
        const leader = new Graphics().roundRect(-leaderTh / 2, 0, leaderTh, gapOuter, leaderTh / 2).fill(accent);
        leader.position.set(cx, edgeY);
        leader.scale.set(1, 0);
        root.addChild(leader);
        timeline
          .to(dot, { prop: "scale.x", from: 0, to: 1, start: start - 0.15, duration: 0.4, ease: makeOutBack(2) })
          .to(dot, { prop: "scale.y", from: 0, to: 1, start: start - 0.15, duration: 0.4, ease: makeOutBack(2) })
          .to(leader, { prop: "scale.y", from: 0, to: 1, start: start - 0.05, duration: 0.3, ease: outExpo });
      }

      const chip = new Container();
      chip.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(imageBack));
      chip.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).stroke({ color: accent, width: strokeW }));
      chip.addChild(makeText(fonts, { text: tagRaw, role: "body", weight: 700, size: fSize, color: textColor, anchor: 0.5, align: "center" }));
      chip.position.set(cx, chipCy);
      chip.scale.set(0);
      root.addChild(chip);
      timeline
        .to(chip, { prop: "scale.x", from: 0, to: 1, start, duration: 0.55, ease: makeOutBack(1.8) })
        .to(chip, { prop: "scale.y", from: 0, to: 1, start, duration: 0.55, ease: makeOutBack(1.8) });
      return;
    }

    const isLeft = slot.side === "L";
    const rowY = cy + (slot.row === 0 ? -rowGap : rowGap);
    const avail = isLeft ? availL : availR;
    const fSize = fitOneLine(fonts, tagRaw, "body", 700, chipFont0, avail - padX * 2);
    const textW = fonts.measure(tagRaw, { family: fonts.family("body"), weight: 700, size: fSize });
    const pillW = textW + padX * 2;
    const railX = isLeft ? railL : railR;
    const chipCx = isLeft ? railX - pillW / 2 : railX + pillW / 2;
    const edgeX = isLeft ? cx - side / 2 : cx + side / 2;

    if (showDots) {
      const x0 = Math.min(edgeX, railX);
      const leaderLen = Math.abs(railX - edgeX);
      const leader = new Graphics().roundRect(0, -leaderTh / 2, leaderLen, leaderTh, leaderTh / 2).fill(accent);
      leader.position.set(x0, rowY);
      leader.scale.set(0, 1);
      root.addChild(leader);
      const dot = new Graphics().circle(0, 0, dotR).fill(accent);
      dot.position.set(edgeX, rowY);
      dot.scale.set(0);
      root.addChild(dot);
      timeline
        .to(leader, { prop: "scale.x", from: 0, to: 1, start: start - 0.15, duration: 0.3, ease: outExpo })
        .to(dot, { prop: "scale.x", from: 0, to: 1, start: start - 0.05, duration: 0.4, ease: makeOutBack(2) })
        .to(dot, { prop: "scale.y", from: 0, to: 1, start: start - 0.05, duration: 0.4, ease: makeOutBack(2) });
    }

    const chip = new Container();
    chip.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(imageBack));
    chip.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).stroke({ color: accent, width: strokeW }));
    chip.addChild(makeText(fonts, { text: tagRaw, role: "body", weight: 700, size: fSize, color: textColor, anchor: 0.5, align: "center" }));
    chip.position.set(chipCx, rowY);
    chip.scale.set(0);
    root.addChild(chip);
    timeline
      .to(chip, { prop: "scale.x", from: 0, to: 1, start, duration: 0.55, ease: makeOutBack(1.8) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start, duration: 0.55, ease: makeOutBack(1.8) });
  });

  return { timeline, duration: DUR };
}

export const featureTags: TemplateDefinition = {
  id: "feature-tags",
  name: "Feature Tags",
  tagline: "Feature chips pop in around a product, tied off by leader dots.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.4,
  palettes: PALETTES,
  fields: [
    { key: "image", type: "image", label: "Product image", default: "", optional: true, help: "Transparent PNG or a clean product photo works best." },
    { key: "tags", type: "textlist", label: "Tags", default: DEFAULT_TAGS, minItems: 2, maxItems: 4, maxLength: 22 },
    { key: "showDots", type: "toggle", label: "Leader dots", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "imageBack", type: "color", label: "Image back", default: "", optional: true },
  ],
  build,
};
