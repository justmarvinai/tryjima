import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  outExpo,
  makeOutBack,
  spring,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Largest size ≤ size0 at which `text` fits `maxWidth` on one crisp line. */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

// The post-purchase success moment: a check draws itself on, the confirmation
// pops, the order row slides up and the fulfilment stepper lights step one.
// (add-to-cart covers the moment BEFORE checkout; this is the receipt.)
const PALETTES: Palette[] = [
  { id: "mint-receipt", name: "Mint receipt", colors: { background: "#F1F7F3", cardColor: "#FFFFFF", textColor: "#12291C", muted: "#6C8274", accent: "#0F7A4E", onAccent: "#FFFFFF" } },
  { id: "sky-parcel", name: "Sky parcel", colors: { background: "#EEF4FC", cardColor: "#FFFFFF", textColor: "#0F2138", muted: "#64748B", accent: "#1E6FE0", onAccent: "#FFFFFF" } },
  { id: "peach-thanks", name: "Peach thanks", colors: { background: "#FDF1E9", cardColor: "#FFFFFF", textColor: "#38180A", muted: "#8A685A", accent: "#C2481B", onAccent: "#FFFFFF" } },
  { id: "carbon-lime", name: "Carbon lime", colors: { background: "#15171C", cardColor: "#21252C", textColor: "#FFFFFF", muted: "#8A93A0", accent: "#7ED957", onAccent: "#10240D" } },
];

const DEFAULT_STEPS = ["Preparing", "Shipped", "Delivered"];

const RING_START = 0.3;
const RING_DUR = 0.7;
const CHECK_START = 0.95;
const CHECK_DUR = 0.4;
const HEAD_IN = 1.4;
const BURST = 1.5;
const LIFE = 0.8;
const ROW_IN = 1.8;
const TRACK_IN = 2.3;
const DOTS_IN = 2.45;
const ACTIVATE = 3.1;
const DURATION = 4.4;

// The stack is tall; shorter aspects scale it down to stay inside the safe area.
function vScale(aspect: Aspect): number {
  switch (aspect) {
    case "9:16":
      return 1.0;
    case "4:5":
      return 0.92;
    case "1:1":
      return 0.84;
    case "16:9":
      return 0.74;
  }
}

const BAND = { badge: 0.16, head: 0.4, row: 0.575, stepper: 0.78 };

/** Rounded product thumb: cover-fit image, or a drawn parcel silhouette. */
function productThumb(sizePx: number, tex: Texture | null, accent: string, base: string): Container {
  const c = new Container();
  const r = sizePx * 0.24;
  c.addChild(new Graphics().roundRect(-sizePx / 2, -sizePx / 2, sizePx, sizePx, r).fill(base));
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(Math.max(sizePx / tex.width, sizePx / tex.height));
    const mask = new Graphics().roundRect(-sizePx / 2, -sizePx / 2, sizePx, sizePx, r).fill(0xffffff);
    c.addChild(s, mask);
    s.mask = mask;
  } else {
    c.addChild(new Graphics().circle(0, 0, sizePx * 0.38).fill({ color: accent, alpha: 0.16 }));
    const bw = sizePx * 0.44;
    const bh = sizePx * 0.4;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2 + sizePx * 0.05, bw, bh, bw * 0.14).fill(accent));
    c.addChild(new Graphics().rect(-bw * 0.06, -bh / 2 + sizePx * 0.05, bw * 0.12, bh).fill({ color: 0xffffff, alpha: 0.35 }));
  }
  return c;
}

interface Confetto {
  g: Graphics;
  vx: number;
  vy: number;
  rot: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F1F7F3"));
  const cardColor = str(values.cardColor, pc("cardColor", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#12291C"));
  const muted = pc("muted", "#6C8274");
  const accent = str(values.accent, pc("accent", "#0F7A4E"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const headline = str(values.headline, "Order confirmed");
  const item = str(values.item, "Aero Hoodie — size M");
  const price = str(values.price, "$59.00");
  const steps = asList(values.steps, DEFAULT_STEPS).slice(0, 4);
  const showConfetti = values.showConfetti !== false;
  const showGlow = values.showGlow !== false;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const zone = safeRect(ctx.aspect);
  const cx = W / 2;
  const S = vScale(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const badgeCy = zone.y + zone.height * BAND.badge;
  const headCy = zone.y + zone.height * BAND.head;
  const rowCy = zone.y + zone.height * BAND.row;
  const stepY = zone.y + zone.height * BAND.stepper;

  // --- Badge with a drawing-on ring + check ---
  const bR = minDim * 0.105 * S;

  if (showGlow) {
    const glow = new Sprite(radialGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = accent;
    glow.width = bR * 5;
    glow.height = bR * 5;
    glow.alpha = 0;
    glow.position.set(cx, badgeCy);
    root.addChild(glow);
    timeline.to(glow, { prop: "alpha", from: 0, to: 0.28, start: 0.2, duration: 0.6, ease: outQuad });
  }

  const badge = new Container();
  badge.position.set(cx, badgeCy);
  badge.addChild(new Graphics().circle(0, 0, bR).fill({ color: accent, alpha: 0.14 }));
  badge.alpha = 0;
  badge.scale.set(0.6);
  root.addChild(badge);
  timeline
    .to(badge, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.3, ease: outQuad })
    .to(badge, { prop: "scale.x", from: 0.6, to: 1, start: 0.1, duration: 0.55, ease: makeOutBack(1.8) })
    .to(badge, { prop: "scale.y", from: 0.6, to: 1, start: 0.1, duration: 0.55, ease: makeOutBack(1.8) });

  const ringG = new Graphics();
  badge.addChild(ringG);
  const checkG = new Graphics();
  badge.addChild(checkG);
  const ringWidth = Math.max(3, minDim * 0.011 * S);
  const checkWidth = Math.max(4, minDim * 0.017 * S);

  // Check polyline (in badge coords).
  const p0 = { x: -0.34 * bR, y: 0.05 * bR };
  const p1 = { x: -0.09 * bR, y: 0.32 * bR };
  const p2 = { x: 0.4 * bR, y: -0.24 * bR };
  const L1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const L2 = Math.hypot(p2.x - p1.x, p2.y - p1.y);

  // --- Headline ---
  const headSize = fitSize(fonts, headline, "display", 700, Math.round(minDim * 0.058 * S), zone.width * 0.88);
  const headText = makeText(fonts, { text: headline, role: "display", weight: 700, size: headSize, color: textColor, anchor: 0.5, align: "center" });
  headText.position.set(cx, headCy);
  headText.alpha = 0;
  headText.scale.set(0.8);
  root.addChild(headText);
  timeline
    .to(headText, { prop: "alpha", from: 0, to: 1, start: HEAD_IN, duration: 0.3, ease: outQuad })
    .to(headText, { prop: "scale.x", from: 0.8, to: 1, start: HEAD_IN, duration: 0.5, ease: makeOutBack(1.9) })
    .to(headText, { prop: "scale.y", from: 0.8, to: 1, start: HEAD_IN, duration: 0.5, ease: makeOutBack(1.9) });

  // --- Order summary row ---
  const rw = Math.min(minDim * 0.78 * S, zone.width * 0.9);
  const rh = minDim * 0.105 * S;
  const row = new Container();
  row.position.set(cx, rowCy);
  const rowShadow = new Graphics().roundRect(-rw / 2, -rh / 2, rw, rh, rh * 0.3).fill({ color: 0x000000, alpha: 0.1 });
  rowShadow.position.set(0, minDim * 0.008);
  row.addChild(rowShadow);
  row.addChild(new Graphics().roundRect(-rw / 2, -rh / 2, rw, rh, rh * 0.3).fill(cardColor));
  const pad = rh * 0.18;
  const thumbS = rh * 0.72;
  const thumb = productThumb(thumbS, images.image ?? null, accent, bg);
  thumb.position.set(-rw / 2 + pad + thumbS / 2, 0);
  row.addChild(thumb);
  const priceSize = fitSize(fonts, price, "display", 700, Math.round(rh * 0.32), rw * 0.28);
  const priceText = makeText(fonts, { text: price, role: "display", weight: 700, size: priceSize, color: textColor, anchor: { x: 1, y: 0.5 } });
  priceText.position.set(rw / 2 - pad, 0);
  row.addChild(priceText);
  const nameMaxW = rw - pad * 2 - thumbS - rh * 0.3 - priceText.width - rh * 0.2;
  const nameSize = fitSize(fonts, item, "body", 600, Math.round(rh * 0.28), nameMaxW);
  const nameText = makeText(fonts, { text: item, role: "body", weight: 600, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  nameText.position.set(-rw / 2 + pad + thumbS + rh * 0.22, 0);
  row.addChild(nameText);
  row.alpha = 0;
  root.addChild(row);
  timeline
    .to(row, { prop: "alpha", from: 0, to: 1, start: ROW_IN, duration: 0.35, ease: outQuad })
    .to(row, { prop: "y", from: rowCy + minDim * 0.035, to: rowCy, start: ROW_IN, duration: 0.6, ease: outExpo });

  // --- Fulfilment stepper (step 1 lights up) ---
  const n = steps.length;
  const sw = Math.min(minDim * 0.72 * S, zone.width * 0.72);
  const trackH = Math.max(3, minDim * 0.007 * S);
  const dotR = minDim * 0.017 * S;
  const stepFont = Math.round(minDim * 0.026 * S);
  const labelY = stepY + dotR + minDim * 0.032 * S;
  const xs = steps.map((_, i) => cx - sw / 2 + (n > 1 ? (sw * i) / (n - 1) : sw / 2));

  const track = new Graphics().rect(0, -trackH / 2, sw, trackH).fill({ color: muted, alpha: 0.45 });
  track.position.set(cx - sw / 2, stepY);
  track.scale.set(0, 1);
  root.addChild(track);
  timeline.to(track, { prop: "scale.x", from: 0, to: 1, start: TRACK_IN, duration: 0.45, ease: outExpo });

  // A short accent fill creeps toward step two once step one is live.
  const segW = n > 1 ? (sw / (n - 1)) * 0.3 : sw * 0.2;
  const fill = new Graphics().rect(0, -trackH / 2, segW, trackH).fill(accent);
  fill.position.set(xs[0] ?? cx, stepY);
  fill.scale.set(0, 1);
  root.addChild(fill);
  timeline.to(fill, { prop: "scale.x", from: 0, to: 1, start: ACTIVATE + 0.15, duration: 0.5, ease: outCubic });

  steps.forEach((label, i) => {
    const x = xs[i] ?? cx;
    const dot = new Container();
    dot.position.set(x, stepY);
    dot.addChild(new Graphics().circle(0, 0, dotR).fill(bg));
    dot.addChild(new Graphics().circle(0, 0, dotR).stroke({ color: muted, width: Math.max(2, dotR * 0.28) }));
    dot.scale.set(0);
    root.addChild(dot);
    const at = DOTS_IN + i * 0.15;
    timeline
      .to(dot, { prop: "scale.x", from: 0, to: 1, start: at, duration: 0.4, ease: makeOutBack(2) })
      .to(dot, { prop: "scale.y", from: 0, to: 1, start: at, duration: 0.4, ease: makeOutBack(2) });

    const labelSize = fitSize(fonts, label, "body", 600, stepFont, (sw / Math.max(1, n - 1)) * 0.9);
    const mutedLabel = makeText(fonts, { text: label, role: "body", weight: 600, size: labelSize, color: muted, anchor: 0.5 });
    mutedLabel.position.set(x, labelY);
    mutedLabel.alpha = 0;
    root.addChild(mutedLabel);
    timeline.to(mutedLabel, { prop: "alpha", from: 0, to: 1, start: at + 0.08, duration: 0.35, ease: outQuad });

    if (i === 0) {
      // Active state: filled dot + tiny check + label recolors via crossfade.
      const active = new Container();
      active.position.set(x, stepY);
      active.addChild(new Graphics().circle(0, 0, dotR).fill(accent));
      const tick = makeIcon("check", dotR * 1.3, { color: onAccent });
      active.addChild(tick);
      active.scale.set(0);
      root.addChild(active);
      timeline
        .to(active, { prop: "scale.x", from: 0, to: 1, start: ACTIVATE, duration: 0.45, ease: spring(0.45) })
        .to(active, { prop: "scale.y", from: 0, to: 1, start: ACTIVATE, duration: 0.45, ease: spring(0.45) });

      const pulse = new Graphics().circle(0, 0, dotR).stroke({ color: accent, width: Math.max(2, dotR * 0.22) });
      pulse.position.set(x, stepY);
      pulse.alpha = 0;
      pulse.scale.set(0.8);
      root.addChild(pulse);
      timeline
        .to(pulse, { prop: "alpha", from: 0, to: 0.6, start: ACTIVATE + 0.1, duration: 0.08, ease: outQuad })
        .to(pulse, { prop: "alpha", from: 0.6, to: 0, start: ACTIVATE + 0.18, duration: 0.4, ease: outQuad })
        .to(pulse, { prop: "scale.x", from: 0.8, to: 2.4, start: ACTIVATE + 0.1, duration: 0.5, ease: outCubic })
        .to(pulse, { prop: "scale.y", from: 0.8, to: 2.4, start: ACTIVATE + 0.1, duration: 0.5, ease: outCubic });

      const activeLabel = makeText(fonts, { text: label, role: "body", weight: 700, size: labelSize, color: accent, anchor: 0.5 });
      activeLabel.position.set(x, labelY);
      activeLabel.alpha = 0;
      root.addChild(activeLabel);
      timeline
        .to(activeLabel, { prop: "alpha", from: 0, to: 1, start: ACTIVATE, duration: 0.35, ease: outQuad })
        .to(mutedLabel, { prop: "alpha", from: 1, to: 0, start: ACTIVATE, duration: 0.35, ease: outQuad });
    }
  });

  // --- Small confetti from the badge on the headline pop ---
  const confetti: Confetto[] = [];
  if (showConfetti) {
    const cRng = rng.fork(31);
    const festive = [accent, "#FFC24B", "#4FC3F7", "#FF6AD5"];
    const cSize = minDim * 0.011;
    for (let i = 0; i < 18; i++) {
      const g = new Graphics().rect(-cSize / 2, -cSize / 2, cSize, cSize * cRng.range(0.7, 1.4)).fill(cRng.pick(festive));
      g.position.set(cx, badgeCy);
      g.visible = false;
      root.addChild(g);
      const angle = cRng.range(-Math.PI * 0.9, -Math.PI * 0.1);
      const speed = cRng.range(0.25, 0.55) * minDim;
      confetti.push({ g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, rot: cRng.range(-6, 6) });
    }
  }
  const G = 2.2 * minDim;

  const update = (t: number): void => {
    // Ring draw-on (a pure redraw from t — never accumulates).
    const u1 = outCubic(clamp01((t - RING_START) / RING_DUR));
    ringG.clear();
    if (u1 > 0.001) {
      if (u1 >= 0.999) {
        ringG.circle(0, 0, bR).stroke({ color: accent, width: ringWidth });
      } else {
        ringG.arc(0, 0, bR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u1).stroke({ color: accent, width: ringWidth, cap: "round" });
      }
    }
    // Check draw-on.
    const u2 = outQuad(clamp01((t - CHECK_START) / CHECK_DUR));
    checkG.clear();
    if (u2 > 0.001) {
      const drawLen = u2 * (L1 + L2);
      checkG.moveTo(p0.x, p0.y);
      if (drawLen <= L1) {
        const f = drawLen / L1;
        checkG.lineTo(p0.x + (p1.x - p0.x) * f, p0.y + (p1.y - p0.y) * f);
      } else {
        const f = Math.min(1, (drawLen - L1) / L2);
        checkG.lineTo(p1.x, p1.y).lineTo(p1.x + (p2.x - p1.x) * f, p1.y + (p2.y - p1.y) * f);
      }
      checkG.stroke({ color: accent, width: checkWidth, cap: "round", join: "round" });
    }
    // Confetti physics.
    for (const c of confetti) {
      const tau = t - BURST;
      if (tau < 0 || tau > LIFE) {
        c.g.visible = false;
        continue;
      }
      c.g.visible = true;
      c.g.x = cx + c.vx * tau;
      c.g.y = badgeCy + c.vy * tau + 0.5 * G * tau * tau;
      c.g.rotation = c.rot * tau;
      c.g.alpha = 1 - clamp01(tau / LIFE);
    }
  };

  return { timeline, duration: DURATION, update };
}

export const orderConfirmed: TemplateDefinition = {
  id: "order-confirmed",
  name: "Order Confirmed",
  tagline: "A check draws itself on, the order row slides up, and shipping starts.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.7,
  fontRoles: { headline: "display" },
  palettes: PALETTES,
  fields: [
    { key: "image", type: "image", label: "Product image", default: "", optional: true, help: "Fills the order-row thumbnail; a clean product shot works best." },
    { key: "headline", type: "text", label: "Headline", default: "Order confirmed", maxLength: 26, shrinkToFit: true },
    { key: "item", type: "text", label: "Item", default: "Aero Hoodie — size M", maxLength: 32, shrinkToFit: true },
    { key: "price", type: "text", label: "Price", default: "$59.00", maxLength: 10, shrinkToFit: true },
    { key: "steps", type: "textlist", label: "Delivery steps", default: DEFAULT_STEPS, minItems: 2, maxItems: 4, maxLength: 14 },
    { key: "showConfetti", type: "toggle", label: "Confetti", default: true },
    { key: "showGlow", type: "toggle", label: "Badge glow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "cardColor", type: "color", label: "Card", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
