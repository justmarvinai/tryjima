import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  makeOutBack,
  spring,
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
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

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

const TAU = Math.PI * 2;

/** Normalize an angle to (-π, π]. */
function normAngle(a: number): number {
  let x = a % TAU;
  if (x > Math.PI) x -= TAU;
  if (x <= -Math.PI) x += TAU;
  return x;
}

// A carnival prize wheel spins hard and always lands the first wedge under the
// pointer — the win is baked into the final rotation, so it's deterministic.
const DEFAULT_LABELS = ["20% OFF", "Free ship", "10% OFF", "Mystery box", "5% OFF", "Try again"];

const PALETTES: Palette[] = [
  { id: "carnival", name: "Carnival", colors: { background: "#FFF4E3", textColor: "#3A1608", wedgeA: "#B3301C", onWedgeA: "#FFFFFF", wedgeB: "#FFF9EE", onWedgeB: "#8C2B12", rim: "#3A1608", hub: "#FFF9EE", accent: "#14805E", onAccent: "#FFFFFF" } },
  { id: "arcade-night", name: "Arcade night", colors: { background: "#131022", textColor: "#FFFFFF", wedgeA: "#6D3BEA", onWedgeA: "#FFFFFF", wedgeB: "#241E3D", onWedgeB: "#FFFFFF", rim: "#FFD166", hub: "#FFFFFF", accent: "#FF4FA0", onAccent: "#33081C" } },
  { id: "fresh-market", name: "Fresh market", colors: { background: "#EFF7EF", textColor: "#123020", wedgeA: "#0F7A4E", onWedgeA: "#FFFFFF", wedgeB: "#FFFFFF", onWedgeB: "#0F6B44", rim: "#123020", hub: "#FFFFFF", accent: "#C74A14", onAccent: "#FFFFFF" } },
  { id: "gold-rush", name: "Gold rush", colors: { background: "#FFF8E6", textColor: "#2A2140", wedgeA: "#33296B", onWedgeA: "#FFFFFF", wedgeB: "#FFD766", onWedgeB: "#4A3400", rim: "#2A2140", hub: "#FFFDF4", accent: "#B3301C", onAccent: "#FFFFFF" } },
];

const SPIN_START = 0.8;
const SPIN_DUR = 2.1;
const LAND = SPIN_START + SPIN_DUR; // 2.9
const BURST = 2.98;
const LIFE = 0.85;
const CHIP_IN = 3.1;
const DURATION = 4.6;

const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

interface Confetto {
  g: Graphics;
  vx: number;
  vy: number;
  rot: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF4E3"));
  const textColor = str(values.textColor, pc("textColor", "#3A1608"));
  const wedgeA = str(values.wedgeA, pc("wedgeA", "#B3301C"));
  const wedgeB = str(values.wedgeB, pc("wedgeB", "#FFF9EE"));
  const onWedgeA = pc("onWedgeA", "#FFFFFF");
  const onWedgeB = pc("onWedgeB", "#8C2B12");
  const rim = pc("rim", "#3A1608");
  const hub = pc("hub", "#FFF9EE");
  const accent = str(values.accent, pc("accent", "#14805E"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const headline = str(values.headline, "Spin to win");
  const labels = asList(values.labels, DEFAULT_LABELS).slice(0, 6);
  const winnerText = typeof values.winnerText === "string" ? values.winnerText : "You won";
  const showBulbs = values.showBulbs !== false;
  const showConfetti = values.showConfetti !== false;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const zone = safeRect(ctx.aspect);
  const cx = W / 2;

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const R = Math.min(minDim * 0.3, zone.width * 0.42, zone.height * 0.3);
  const wheelCy = zone.y + zone.height * 0.52;
  const headCy = wheelCy - R - minDim * 0.135;
  const chipCy = wheelCy + R + minDim * 0.075;
  const n = labels.length;
  const step = TAU / n;

  // The whole win is decided here: wedge 0 must end under the top pointer, so
  // the final rotation is computed from that constraint (plus a small seeded
  // jitter within the wedge so it doesn't land dead-center every seed).
  const jitter = rng.range(-0.3, 0.3) * step;
  const finalRot = -Math.PI / 2 + jitter;
  const fromRot = finalRot - (4 * TAU + step * 1.4);

  // --- Headline ---
  const headSize = fitSize(fonts, headline, "display", 700, Math.round(minDim * 0.062), zone.width * 0.9);
  const headText = makeText(fonts, { text: headline, role: "display", weight: 700, size: headSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: headSize * 0.01 });
  headText.position.set(cx, headCy);
  headText.alpha = 0;
  root.addChild(headText);
  timeline
    .to(headText, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.4, ease: outQuad })
    .to(headText, { prop: "y", from: headCy + 18, to: headCy, start: 0.05, duration: 0.55, ease: outQuint });

  // --- Wheel group (pops in, holds the spin container + hub + pointer) ---
  const wheel = new Container();
  wheel.position.set(cx, wheelCy);
  wheel.alpha = 0;
  wheel.scale.set(0.6);
  root.addChild(wheel);
  timeline
    .to(wheel, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.35, ease: outQuad })
    .to(wheel, { prop: "scale.x", from: 0.6, to: 1, start: 0.15, duration: 0.6, ease: makeOutBack(1.5) })
    .to(wheel, { prop: "scale.y", from: 0.6, to: 1, start: 0.15, duration: 0.6, ease: makeOutBack(1.5) });

  // Soft drop shadow under the wheel disc.
  const discShadow = new Graphics().circle(0, minDim * 0.014, R * 1.02).fill({ color: 0x000000, alpha: 0.14 });
  wheel.addChild(discShadow);

  // --- Spinning disc: wedges, separators, rim ring, bulbs, labels ---
  const spinC = new Container();
  wheel.addChild(spinC);

  const wedgeG = new Graphics();
  for (let i = 0; i < n; i++) {
    const a0 = i * step - step / 2;
    const a1 = i * step + step / 2;
    wedgeG.moveTo(0, 0).arc(0, 0, R, a0, a1).closePath().fill(i % 2 === 0 ? wedgeA : wedgeB);
  }
  // Crisp separators keep adjacent wedges readable even with odd counts.
  const sepW = Math.max(2, R * 0.014);
  for (let i = 0; i < n; i++) {
    const b = i * step + step / 2;
    wedgeG.moveTo(0, 0).lineTo(Math.cos(b) * R, Math.sin(b) * R).stroke({ color: rim, width: sepW });
  }
  spinC.addChild(wedgeG);

  const ring = new Graphics().circle(0, 0, R).stroke({ color: rim, width: R * 0.06 });
  spinC.addChild(ring);

  if (showBulbs) {
    const bulbs = new Graphics();
    for (let i = 0; i < n; i++) {
      const b = i * step + step / 2;
      bulbs.circle(Math.cos(b) * R, Math.sin(b) * R, R * 0.028).fill(hub);
    }
    spinC.addChild(bulbs);
  }

  const labelR = R * 0.66;
  const labelMaxW = 2 * Math.sin(step / 2) * labelR * 0.84;
  labels.forEach((label, i) => {
    const mid = i * step;
    const lSize = fitSize(fonts, label, "display", 700, Math.round(minDim * 0.03), labelMaxW);
    const lText = makeText(fonts, {
      text: label,
      role: "display",
      weight: 700,
      size: lSize,
      color: i % 2 === 0 ? onWedgeA : onWedgeB,
      anchor: 0.5,
      align: "center",
    });
    lText.position.set(Math.cos(mid) * labelR, Math.sin(mid) * labelR);
    // Tangential orientation, flipped where needed so no label rests
    // upside-down once the wheel has landed.
    let rot = mid + Math.PI / 2;
    if (Math.abs(normAngle(mid + jitter)) > Math.PI / 2) rot += Math.PI;
    lText.rotation = rot;
    spinC.addChild(lText);
  });

  // The spin: one long tween with a hard outExpo deceleration into the win.
  timeline.to(spinC, { prop: "rotation", from: fromRot, to: finalRot, start: SPIN_START, duration: SPIN_DUR, ease: outExpo });

  // --- Hub (static center cap) ---
  const hubC = new Container();
  const hubR = R * 0.17;
  hubC.addChild(new Graphics().circle(0, 0, hubR).fill(hub));
  hubC.addChild(new Graphics().circle(0, 0, hubR).stroke({ color: rim, width: Math.max(2, R * 0.018) }));
  hubC.addChild(makeIcon("star", hubR * 1.05, { color: accent }));
  wheel.addChild(hubC);

  // --- Pointer (top, ticks during the spin, bounces on the land) ---
  const ph = R * 0.22;
  const pointer = new Container();
  const pointerY = -(R + ph * 0.42);
  pointer.position.set(0, pointerY);
  const tri = new Graphics()
    .poly([-ph * 0.42, 0, ph * 0.42, 0, 0, ph])
    .fill(accent)
    .poly([-ph * 0.42, 0, ph * 0.42, 0, 0, ph])
    .stroke({ color: hub, width: Math.max(2, ph * 0.07), join: "round" });
  pointer.addChild(tri);
  pointer.addChild(new Graphics().circle(0, 0, ph * 0.26).fill(accent));
  wheel.addChild(pointer);

  // Ticks: quick flicks that fade in amplitude as the wheel slows.
  const kicks: [number, number][] = [
    [1.0, 0.2],
    [1.35, 0.15],
    [1.75, 0.11],
    [2.2, 0.07],
    [2.52, 0.045],
  ];
  for (const [t0, amp] of kicks) {
    timeline
      .to(pointer, { prop: "rotation", from: 0, to: amp, start: t0, duration: 0.08, ease: outQuad })
      .to(pointer, { prop: "rotation", from: amp, to: 0, start: t0 + 0.08, duration: 0.15, ease: outQuad });
  }
  // Landing bounce.
  timeline
    .to(pointer, { prop: "y", from: pointerY, to: pointerY - ph * 0.14, start: LAND - 0.04, duration: 0.1, ease: outQuad })
    .to(pointer, { prop: "y", from: pointerY - ph * 0.14, to: pointerY, start: LAND + 0.06, duration: 0.24, ease: makeOutBack(2.2) });

  // --- Winner chip (pops once the wheel has settled) ---
  const winnerLabel = labels[0] ?? "20% OFF";
  const chipText = winnerText.length > 0 ? `${winnerText} ${winnerLabel}` : winnerLabel;
  const chipH = minDim * 0.085;
  const chipMaxW = Math.min(zone.width * 0.9, minDim * 0.82);
  const iconS = chipH * 0.48;
  const padX = chipH * 0.5;
  const gap = chipH * 0.26;
  const chipFont = fitSize(fonts, chipText, "display", 700, Math.round(chipH * 0.4), chipMaxW - padX * 2 - iconS - gap);
  const chipLabel = makeText(fonts, { text: chipText, role: "display", weight: 700, size: chipFont, color: onAccent, anchor: { x: 0, y: 0.5 } });
  const chipW = padX + iconS + gap + chipLabel.width + padX;
  const chip = new Container();
  chip.position.set(cx, chipCy);
  const chipShadow = new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill({ color: 0x000000, alpha: 0.16 });
  chipShadow.position.set(0, minDim * 0.008);
  chip.addChild(chipShadow);
  chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill(accent));
  const chipStar = makeIcon("star", iconS, { color: onAccent });
  chipStar.position.set(-chipW / 2 + padX + iconS / 2, 0);
  chip.addChild(chipStar);
  chipLabel.position.set(-chipW / 2 + padX + iconS + gap, 0);
  chip.addChild(chipLabel);
  chip.scale.set(0);
  root.addChild(chip);
  timeline
    .to(chip, { prop: "scale.x", from: 0, to: 1, start: CHIP_IN, duration: 0.6, ease: spring(0.45) })
    .to(chip, { prop: "scale.y", from: 0, to: 1, start: CHIP_IN, duration: 0.6, ease: spring(0.45) });

  // --- Confetti burst on the win (seeded physics, pure update) ---
  const confetti: Confetto[] = [];
  const originY = wheelCy - R * 0.55;
  if (showConfetti) {
    const cRng = rng.fork(101);
    const festive = [accent, wedgeA, "#FFD166", "#4FC3F7"];
    const cSize = minDim * 0.015;
    for (let i = 0; i < 26; i++) {
      const g = new Graphics().rect(-cSize / 2, -cSize / 2, cSize, cSize * cRng.range(0.7, 1.5)).fill(cRng.pick(festive));
      g.position.set(cx, originY);
      g.visible = false;
      root.addChild(g);
      const angle = cRng.range(-Math.PI * 0.92, -Math.PI * 0.08);
      const speed = cRng.range(0.32, 0.72) * minDim;
      confetti.push({ g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, rot: cRng.range(-7, 7) });
    }
  }
  const G = 2.5 * minDim;
  const update = (t: number): void => {
    for (const c of confetti) {
      const tau = t - BURST;
      if (tau < 0 || tau > LIFE) {
        c.g.visible = false;
        continue;
      }
      c.g.visible = true;
      c.g.x = cx + c.vx * tau;
      c.g.y = originY + c.vy * tau + 0.5 * G * tau * tau;
      c.g.rotation = c.rot * tau;
      c.g.alpha = 1 - clamp01(tau / LIFE);
    }
  };

  return { timeline, duration: DURATION, update };
}

export const spinWheel: TemplateDefinition = {
  id: "spin-wheel",
  name: "Spin to Win",
  tagline: "A prize wheel spins hard, slows, and lands your offer under the pointer.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 4.0,
  fontRoles: { headline: "display" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Spin to win", maxLength: 24, shrinkToFit: true },
    {
      key: "labels",
      type: "textlist",
      label: "Wheel prizes",
      default: DEFAULT_LABELS,
      minItems: 3,
      maxItems: 6,
      maxLength: 12,
      help: "The first prize always wins.",
    },
    { key: "winnerText", type: "text", label: "Winner label", default: "You won", maxLength: 16, optional: true },
    { key: "showBulbs", type: "toggle", label: "Rim lights", default: true },
    { key: "showConfetti", type: "toggle", label: "Confetti", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "wedgeA", type: "color", label: "Wedge A", default: "", optional: true },
    { key: "wedgeB", type: "color", label: "Wedge B", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
