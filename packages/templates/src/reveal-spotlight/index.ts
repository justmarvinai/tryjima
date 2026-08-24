import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

// Dark scene by design — the spotlight only reads against a deep background.
const PALETTES: Palette[] = [
  { id: "spotlight-ink", name: "Spotlight ink", colors: { background: "#0C0D12", light: "#FFF3DC", accent: "#FF4D1C", textColor: "#FFFFFF", muted: "#A9AAB6" } },
  { id: "deep-violet", name: "Deep violet", colors: { background: "#0E0A1C", light: "#F1E9FF", accent: "#8B5CF6", textColor: "#FFFFFF", muted: "#A79CC4" } },
  { id: "midnight-blue", name: "Midnight blue", colors: { background: "#070C18", light: "#E6F0FF", accent: "#38A0FF", textColor: "#FFFFFF", muted: "#93A6C4" } },
  { id: "noir-lime", name: "Noir lime", colors: { background: "#0B0D0A", light: "#F2FFD9", accent: "#C7F24A", textColor: "#FFFFFF", muted: "#9BA793" } },
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

/** The product: a cover-fit masked image in a lit frame, or a lit silhouette. */
function productReveal(pv: number, tex: Texture | null, light: string, accent: string, showFrame: boolean): Container {
  const c = new Container();
  const glow = new Sprite(radialGlowTexture());
  glow.anchor.set(0.5);
  glow.tint = light;
  glow.width = glow.height = pv * 1.5;
  glow.alpha = 0.32;
  c.addChild(glow);
  if (tex) {
    const side = pv;
    const r = pv * 0.08;
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(side / tex.width, side / tex.height);
    s.scale.set(cover);
    const mask = new Graphics().roundRect(-side / 2, -side / 2, side, side, r).fill(0xffffff);
    c.addChild(s, mask);
    s.mask = mask;
    if (showFrame) {
      c.addChild(new Graphics().roundRect(-side / 2, -side / 2, side, side, r).stroke({ color: light, width: Math.max(2, pv * 0.008), alpha: 0.5 }));
    }
  } else {
    const bw = pv * 0.46;
    const bh = pv * 0.9;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bw * 0.22).fill("#2E323C"));
    c.addChild(new Graphics().roundRect(-bw / 2 + bw * 0.12, -bh / 2 + bh * 0.06, bw * 0.22, bh * 0.86, bw * 0.11).fill({ color: light, alpha: 0.22 }));
    c.addChild(new Graphics().roundRect(-bw * 0.18, -bh / 2 - bh * 0.08, bw * 0.36, bh * 0.12, bw * 0.06).fill(accent));
  }
  return c;
}

function pvFor(aspect: Aspect, w: number, h: number): number {
  switch (aspect) {
    case "16:9":
      return h * 0.46;
    case "9:16":
      return w * 0.56;
    case "4:5":
      return w * 0.5;
    case "1:1":
      return w * 0.48;
  }
}

function nameSizeFor(aspect: Aspect, w: number): number {
  switch (aspect) {
    case "16:9":
      return Math.round(w * 0.05);
    case "9:16":
      return Math.round(w * 0.08);
    default:
      return Math.round(w * 0.07);
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0C0D12"));
  const light = pc("light", "#FFF3DC");
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const muted = pc("muted", "#A9AAB6");

  const name = str(values.name, "Introducing Aura");
  const tagline = str(values.tagline, "The future, revealed");
  const showFrame = values.frame !== false;
  const showSparkles = values.sparkles !== false;
  const showAccentBar = values.accentBar !== false;

  const W = size.width;
  const H = size.height;
  const cx = W / 2;
  const minDim = Math.min(W, H);
  const maxDim = Math.max(W, H);
  const margin = Math.round(minDim * 0.06);
  root.addChild(new Graphics().rect(0, 0, W, H).fill(bg));
  const timeline = new JimaTimeline();
  const DUR = 4.2;

  // --- Layout (centered block, biased slightly up so the light falls from above) ---
  const pv = pvFor(ctx.aspect, W, H);
  const nameSize0 = nameSizeFor(ctx.aspect, W);
  const taglineSize = Math.round(nameSize0 * 0.42);
  const { lines: nameLines, size: nameSize } = wrapAndFit(fonts, name, "display", 700, nameSize0, W - margin * 2, 2);
  const nameLH = Math.round(nameSize * 1.08);
  const nameBlockH = nameLines.length * nameLH;
  const hasTagline = tagline.length > 0;
  const gap1 = minDim * 0.06;
  const ruleGap = minDim * 0.045;
  const taglineH = hasTagline ? taglineSize * 1.3 + ruleGap : 0;
  const totalH = pv + gap1 + nameBlockH + taglineH;

  const bandTop = ctx.aspect === "9:16" ? 220 : margin;
  const bandBottom = ctx.aspect === "9:16" ? H - 400 : H - margin;
  const bandCy = (bandTop + bandBottom) / 2;
  const blockTop = bandCy - totalH / 2 - minDim * 0.02;
  const productCy = blockTop + pv / 2;
  const spotCy = productCy - pv * 0.2;

  // --- Spotlight: a big soft light that sweeps down from above and brightens ---
  const spot = new Sprite(radialGlowTexture());
  spot.anchor.set(0.5);
  spot.tint = light;
  spot.width = spot.height = maxDim * 1.15;
  spot.alpha = 0;
  spot.position.set(cx, spotCy);
  root.addChild(spot);
  timeline
    .to(spot, { prop: "alpha", from: 0, to: 0.85, start: 0.1, duration: 0.8, ease: outQuad })
    .to(spot, { prop: "y", from: spotCy - H * 0.28, to: spotCy, start: 0.1, duration: 0.9, ease: outExpo })
    .to(spot, { prop: "scale.x", from: 0.78, to: 1, start: 0.1, duration: 0.9, ease: outExpo })
    .to(spot, { prop: "scale.y", from: 0.78, to: 1, start: 0.1, duration: 0.9, ease: outExpo })
    // idle breathe
    .to(spot, { prop: "alpha", from: 0.85, to: 0.72, start: 2.6, duration: 0.8, ease: outQuad })
    .to(spot, { prop: "alpha", from: 0.72, to: 0.85, start: 3.4, duration: 0.8, ease: outQuad });

  // --- Floor pool of light beneath the product ---
  const pool = new Sprite(radialGlowTexture());
  pool.anchor.set(0.5);
  pool.tint = light;
  pool.width = pv * 1.4;
  pool.height = pv * 0.36;
  pool.alpha = 0;
  pool.position.set(cx, productCy + pv * 0.52);
  root.addChild(pool);
  timeline.to(pool, { prop: "alpha", from: 0, to: 0.28, start: 0.7, duration: 0.6, ease: outQuad });

  // --- Product: rises into the light ---
  const product = productReveal(pv, images.product ?? null, light, accent, showFrame);
  product.position.set(cx, productCy + pv * 0.16);
  product.scale.set(0.8);
  product.alpha = 0;
  root.addChild(product);
  timeline
    .to(product, { prop: "alpha", from: 0, to: 1, start: 0.6, duration: 0.5, ease: outQuad })
    .to(product, { prop: "y", from: productCy + pv * 0.16, to: productCy, start: 0.6, duration: 0.9, ease: spring(0.55) })
    .to(product, { prop: "scale.x", from: 0.8, to: 1, start: 0.6, duration: 0.9, ease: spring(0.55) })
    .to(product, { prop: "scale.y", from: 0.8, to: 1, start: 0.6, duration: 0.9, ease: spring(0.55) })
    // gentle idle float
    .to(product, { prop: "y", from: productCy, to: productCy - minDim * 0.01, start: 2.7, duration: 0.75, ease: outQuad })
    .to(product, { prop: "y", from: productCy - minDim * 0.01, to: productCy, start: 3.45, duration: 0.75, ease: outQuad });

  // --- Dust motes drifting up through the light (pure f(t)) ---
  const dustTop = spotCy;
  const dustBot = productCy + pv * 0.4;
  const span = Math.max(1, dustBot - dustTop);
  const motes: { g: Graphics; x: number; y0: number; speed: number; phase: number; base: number }[] = [];
  if (showSparkles) {
    for (let i = 0; i < 9; i++) {
      const r = minDim * rng.range(0.003, 0.007);
      const g = new Graphics().circle(0, 0, r).fill(light);
      g.alpha = 0;
      root.addChild(g);
      motes.push({
        g,
        x: cx + rng.range(-pv * 0.42, pv * 0.42),
        y0: rng.range(dustTop, dustBot),
        speed: span / (DUR * rng.range(1.6, 3.2)),
        phase: rng.range(0, Math.PI * 2),
        base: rng.range(0.1, 0.22),
      });
    }
  }

  // --- Name ---
  const nameY = blockTop + pv + gap1;
  const nameText = makeText(fonts, { text: nameLines.join("\n"), role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0.5, y: 0 }, lineHeight: nameLH, align: "center" });
  nameText.position.set(cx, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 1.7, duration: 0.5, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 20, to: nameY, start: 1.7, duration: 0.7, ease: outExpo });

  // --- Accent rule + tagline ---
  if (hasTagline) {
    const ruleY = nameY + nameBlockH + ruleGap * 0.5;
    if (showAccentBar) {
      const ruleW = minDim * 0.12;
      const rule = new Graphics().roundRect(-ruleW / 2, 0, ruleW, Math.max(3, minDim * 0.006), 3).fill(accent);
      rule.position.set(cx, ruleY);
      rule.scale.set(0, 1);
      root.addChild(rule);
      timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 1.95, duration: 0.5, ease: outExpo });
    }

    const taglineY = ruleY + ruleGap * 0.5 + taglineSize * 0.2;
    const taglineText = makeText(fonts, { text: tagline, role: "body", weight: 500, size: taglineSize, color: muted, anchor: { x: 0.5, y: 0 }, align: "center", letterSpacing: 1 });
    taglineText.position.set(cx, taglineY);
    taglineText.alpha = 0;
    root.addChild(taglineText);
    timeline
      .to(taglineText, { prop: "alpha", from: 0, to: 1, start: 2.15, duration: 0.5, ease: outQuad })
      .to(taglineText, { prop: "y", from: taglineY + 12, to: taglineY, start: 2.15, duration: 0.5, ease: outQuint });
  }

  const update = (t: number): void => {
    // Dust only visible once the light is up.
    const vis = clamp01((t - 0.5) / 0.8);
    for (const m of motes) {
      const y = dustBot - (((dustBot - m.y0) + m.speed * t) % span);
      m.g.x = m.x;
      m.g.y = y;
      const flicker = 0.6 + 0.4 * Math.sin(t * 2 + m.phase);
      m.g.alpha = m.base * flicker * vis;
    }
  };

  return { timeline, duration: DUR, update };
}

export const revealSpotlight: TemplateDefinition = {
  id: "reveal-spotlight",
  name: "Reveal Spotlight",
  tagline: "A spotlight sweeps in and reveals the product from the dark.",
  category: "product",
  aspects: ["16:9", "1:1", "4:5", "9:16"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  palettes: PALETTES,
  fields: [
    { key: "product", type: "image", label: "Product image", default: "", optional: true, help: "Revealed under the light; a clean product photo works best." },
    { key: "name", type: "text", label: "Name", default: "Introducing Aura", maxLength: 30, shrinkToFit: true },
    { key: "tagline", type: "text", label: "Tagline", default: "The future, revealed", maxLength: 44, optional: true },
    { key: "frame", type: "toggle", label: "Frame", default: true },
    { key: "sparkles", type: "toggle", label: "Sparkles", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
