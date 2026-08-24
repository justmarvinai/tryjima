import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  spring,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const PALETTES: Palette[] = [
  { id: "kraft", name: "Kraft", colors: { background: "#F4F2EC", box: "#E8E2D6", boxDark: "#CFC7B6", accent: "#C2380F", textColor: "#14140F", onAccent: "#FFFFFF" } },
  { id: "violet", name: "Violet", colors: { background: "#F2EEFB", box: "#E4DCF5", boxDark: "#CDC0EC", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", box: "#D6E2F1", boxDark: "#BBD0EA", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", box: "#2A2F38", boxDark: "#1C2027", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A" } },
];

/** Greedy-wrap into ≤ maxLines lines, then shrink so the widest line fits. */
function wrapAndFit(
  fonts: TemplateContext["fonts"],
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; size: number } {
  const family = fonts.family(role);
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight, size: sz });
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [""], size: size0 };
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || measure(next, size0) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  let packed = lines;
  if (packed.length > maxLines) {
    packed = [...packed.slice(0, maxLines - 1), packed.slice(maxLines - 1).join(" ")];
  }
  let size = size0;
  for (let guard = 0; guard < 8; guard++) {
    const widest = Math.max(...packed.map((l) => measure(l, size)));
    if (widest <= maxWidth || widest === 0) break;
    size = Math.max(12, Math.floor(size * (maxWidth / widest)));
  }
  return { lines: packed, size };
}

/** The rising product: contain-fit image, or a designed product silhouette. */
function productNode(pw: number, ph: number, tex: Texture | null, accent: string): Container {
  const c = new Container();
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(Math.min(pw / tex.width, ph / tex.height));
    c.addChild(s);
  } else {
    const bw = pw * 0.56;
    const bh = ph * 0.94;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2 + bh * 0.08, bw, bh * 0.92, bw * 0.22).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2 + bw * 0.12, -bh / 2 + bh * 0.14, bw * 0.22, bh * 0.72, bw * 0.11).fill({ color: "#FFFFFF", alpha: 0.24 }));
    c.addChild(new Graphics().roundRect(-bw * 0.2, -bh / 2 - bh * 0.02, bw * 0.4, bh * 0.16, bw * 0.08).fill(accent));
  }
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const boxColor = pc("box", "#E8E2D6");
  const boxDark = pc("boxDark", "#CFC7B6");
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const name = str(values.name, "It's here.");
  const cta = str(values.cta, "Shop now");
  const hasCta = cta.length > 0;
  const showSparkles = values.sparkles !== false;

  const W = size.width;
  const H = size.height;
  const cx = W / 2;
  const minDim = Math.min(W, H);
  const margin = Math.round(minDim * 0.06);
  root.addChild(new Graphics().rect(0, 0, W, H).fill(bg));
  const timeline = new JimaTimeline();
  const DUR = 4.2;

  const isTall = ctx.aspect === "9:16" || ctx.aspect === "4:5";
  const safeTop = ctx.aspect === "9:16" ? 220 : margin;
  const safeBottom = ctx.aspect === "9:16" ? H - 400 : H - margin;

  // --- Text metrics (name + CTA are bottom-anchored so they never clip) ---
  const nameSize0 = Math.round(minDim * (ctx.aspect === "16:9" ? 0.05 : 0.062));
  const { lines: nameLines, size: nameSize } = wrapAndFit(fonts, name, "display", 700, nameSize0, W - margin * 2, 2);
  const nameLH = Math.round(nameSize * 1.08);
  const nameBlockH = nameLines.length * nameLH;
  const ctaSize = Math.round(minDim * (ctx.aspect === "16:9" ? 0.03 : 0.04));
  const ctaH = ctaSize * 2.05;

  const ctaCy = safeBottom - ctaH / 2 - minDim * 0.02;
  const nameBottom = hasCta ? ctaCy - ctaH / 2 - minDim * 0.05 : safeBottom - minDim * 0.02;
  const nameTop = nameBottom - nameBlockH;

  // --- Box geometry: sits above the text; capped so the risen product clears the top ---
  const boxBottom = nameTop - minDim * 0.07;
  const boxW = Math.min(minDim * (isTall ? 0.5 : 0.44), (boxBottom - safeTop) / 1.6);
  const boxH = boxW;
  const boxCy = boxBottom - boxH / 2;
  const r = boxW * 0.07;
  const off = minDim * 0.06;

  // --- Box back (interior) ---
  const back = new Container();
  back.position.set(cx, boxCy);
  back.addChild(new Graphics().roundRect(-boxW / 2, -boxH / 2, boxW, boxH, r).fill(boxDark));
  back.addChild(new Graphics().roundRect(-boxW / 2 + boxW * 0.06, -boxH / 2 + boxH * 0.05, boxW * 0.88, boxH * 0.2, r * 0.6).fill({ color: 0x000000, alpha: 0.12 }));
  back.alpha = 0;
  root.addChild(back);

  // --- Product (between back and front) ---
  const pw = boxW * 0.72;
  const ph = boxH * 0.9;
  const rise = boxH * 0.62;
  const finalCy = boxCy - rise;
  const insideCy = boxCy - boxH * 0.04;
  const product = productNode(pw, ph, images.product ?? null, accent);
  product.position.set(cx, insideCy);
  product.scale.set(0.65);
  product.alpha = 0;
  root.addChild(product);

  // --- Box front face ---
  const front = new Container();
  front.position.set(cx, boxCy);
  const frontTop = -boxH * 0.16;
  const frontH = boxH * 0.66;
  front.addChild(new Graphics().roundRect(-boxW / 2, frontTop, boxW, frontH, r).fill(boxColor));
  front.addChild(new Graphics().roundRect(-boxW / 2, frontTop, boxW, Math.max(3, boxH * 0.02), r * 0.4).fill({ color: 0xffffff, alpha: 0.35 }));
  const bandH = frontH * 0.26;
  front.addChild(new Graphics().rect(-boxW / 2, frontTop + frontH * 0.42, boxW, bandH).fill(accent));
  front.addChild(new Graphics().circle(0, frontTop + frontH * 0.42 + bandH / 2, bandH * 0.3).fill({ color: onAccent, alpha: 0.9 }));
  front.alpha = 0;
  root.addChild(front);

  // --- Lid ---
  const lidW = boxW * 1.08;
  const lidH = boxH * 0.2;
  const lidCy = boxCy - boxH / 2 + lidH * 0.1;
  const lid = new Container();
  lid.position.set(cx, lidCy);
  lid.addChild(new Graphics().roundRect(-lidW / 2, -lidH / 2, lidW, lidH, lidH * 0.35).fill(accent));
  lid.addChild(new Graphics().roundRect(-lidW / 2 + lidW * 0.04, -lidH / 2 + lidH * 0.12, lidW * 0.92, lidH * 0.28, lidH * 0.14).fill({ color: onAccent, alpha: 0.22 }));
  lid.alpha = 0;
  root.addChild(lid);

  // Entrance: box parts rise + fade in together.
  for (const part of [back, front, lid]) {
    const fy = part === lid ? lidCy : boxCy;
    timeline
      .to(part, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.4, ease: outQuad })
      .to(part, { prop: "y", from: fy + off, to: fy, start: 0.2, duration: 0.6, ease: outExpo });
  }

  // Lid lifts + tilts off.
  timeline
    .to(lid, { prop: "y", from: lidCy, to: lidCy - boxH * 0.98, start: 1.0, duration: 0.8, ease: outExpo })
    .to(lid, { prop: "x", from: cx, to: cx + boxW * 0.16, start: 1.0, duration: 0.8, ease: outQuad })
    .to(lid, { prop: "rotation", from: 0, to: -0.42, start: 1.0, duration: 0.75, ease: outQuint })
    .to(lid, { prop: "alpha", from: 1, to: 0, start: 1.55, duration: 0.45, ease: outQuad });

  // Product rises out of the box.
  timeline
    .to(product, { prop: "alpha", from: 0, to: 1, start: 1.4, duration: 0.4, ease: outQuad })
    .to(product, { prop: "y", from: insideCy, to: finalCy, start: 1.4, duration: 0.95, ease: spring(0.5) })
    .to(product, { prop: "scale.x", from: 0.65, to: 1, start: 1.4, duration: 0.95, ease: spring(0.5) })
    .to(product, { prop: "scale.y", from: 0.65, to: 1, start: 1.4, duration: 0.95, ease: spring(0.5) })
    // gentle idle float
    .to(product, { prop: "y", from: finalCy, to: finalCy - minDim * 0.012, start: 2.9, duration: 0.65, ease: outQuad })
    .to(product, { prop: "y", from: finalCy - minDim * 0.012, to: finalCy, start: 3.55, duration: 0.65, ease: outQuad });

  // Burst ring at the box opening.
  const openY = boxCy - boxH * 0.42;
  if (showSparkles) {
    const ring = new Graphics().circle(0, 0, boxW * 0.42).stroke({ color: accent, width: Math.max(3, minDim * 0.012) });
    ring.position.set(cx, openY);
    ring.scale.set(0.4);
    ring.alpha = 0;
    root.addChild(ring);
    timeline
      .to(ring, { prop: "scale.x", from: 0.4, to: 1.7, start: 1.6, duration: 0.7, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 0.4, to: 1.7, start: 1.6, duration: 0.7, ease: outExpo })
      .to(ring, { prop: "alpha", from: 0.9, to: 0, start: 1.6, duration: 0.7, ease: outQuad });
  }

  // Confetti burst (pure f(t) physics).
  const dots: { g: Graphics; vx: number; vy: number }[] = [];
  if (showSparkles) {
    for (let i = 0; i < 11; i++) {
      const s = minDim * rng.range(0.01, 0.02);
      const g = new Graphics().circle(0, 0, s).fill(rng.pick([accent, textColor]));
      g.position.set(cx, openY);
      g.visible = false;
      root.addChild(g);
      const a = -Math.PI / 2 + rng.range(-1.05, 1.05);
      const speed = rng.range(0.5, 0.95) * minDim;
      dots.push({ g, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed });
    }
  }
  const BURST = 1.6;
  const LIFE = 0.95;
  const GRAV = 1.7 * minDim;

  // --- Name (bottom-anchored block) ---
  const nameText = makeText(fonts, { text: nameLines.join("\n"), role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0.5, y: 0 }, lineHeight: nameLH, align: "center" });
  nameText.position.set(cx, nameTop);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 2.35, duration: 0.45, ease: outQuad })
    .to(nameText, { prop: "y", from: nameTop + 18, to: nameTop, start: 2.35, duration: 0.6, ease: outExpo });

  // --- CTA pill ---
  if (hasCta) {
    const ctaLabel = makeText(fonts, { text: cta, role: "display", weight: 700, size: ctaSize, color: onAccent, anchor: 0.5 });
    const ctaW = ctaLabel.width + ctaSize * 1.8;
    const ctaNode = new Container();
    ctaNode.addChild(new Graphics().roundRect(-ctaW / 2, -ctaH / 2, ctaW, ctaH, ctaH / 2).fill(accent));
    ctaNode.addChild(ctaLabel);
    ctaNode.position.set(cx, ctaCy);
    ctaNode.scale.set(0);
    root.addChild(ctaNode);
    timeline
      .to(ctaNode, { prop: "scale.x", from: 0, to: 1, start: 2.85, duration: 0.55, ease: spring(0.45) })
      .to(ctaNode, { prop: "scale.y", from: 0, to: 1, start: 2.85, duration: 0.55, ease: spring(0.45) });
  }

  const update = (t: number): void => {
    for (const d of dots) {
      const tau = t - BURST;
      if (tau < 0 || tau > LIFE) {
        d.g.visible = false;
        continue;
      }
      d.g.visible = true;
      d.g.x = cx + d.vx * tau;
      d.g.y = openY + d.vy * tau + 0.5 * GRAV * tau * tau;
      d.g.alpha = 1 - clamp01(tau / LIFE);
    }
  };

  return { timeline, duration: DUR, update };
}

export const unboxReveal: TemplateDefinition = {
  id: "unbox-reveal",
  name: "Unbox Reveal",
  tagline: "A box lid lifts and the product rises out with a burst.",
  category: "product",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.8,
  palettes: PALETTES,
  fields: [
    { key: "product", type: "image", label: "Product image", default: "", optional: true, help: "Rises out of the box; a transparent PNG works best." },
    { key: "name", type: "text", label: "Name", default: "It's here.", maxLength: 28, shrinkToFit: true },
    { key: "cta", type: "text", label: "Button", default: "Shop now", maxLength: 18, optional: true },
    { key: "sparkles", type: "toggle", label: "Sparkles", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
