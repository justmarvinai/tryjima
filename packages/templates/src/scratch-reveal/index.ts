import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outBack,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Scratch Card — a silver panel is scratched away in a few passes to reveal the
// offer underneath, flakes and all. The one promo mechanic that makes a viewer
// wait for the end of the clip.
//
// The coating comes off in strokes rather than dissolving, and the flakes that
// fly off are seeded, so every project scratches a little differently but
// always the same way twice.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "silver", name: "Silver", colors: { background: "#15161A", textColor: "#F6F6F8", accent: "#F5A623" } },
  { id: "rose", name: "Rose", colors: { background: "#170F13", textColor: "#FBEFF3", accent: "#FB7185" } },
  { id: "mint", name: "Mint", colors: { background: "#0D1815", textColor: "#EAF7F1", accent: "#34D399" } },
  { id: "paper", name: "Paper", colors: { background: "#F5F4F0", textColor: "#15161A", accent: "#E11D48" } },
];

interface Layout {
  cardFrac: number;
  prizeFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { cardFrac: 0.44, prizeFrac: 0.062, centerFrac: 0.48 };
    case "9:16":
      return { cardFrac: 0.84, prizeFrac: 0.088, centerFrac: 0.46 };
    case "4:5":
      return { cardFrac: 0.8, prizeFrac: 0.082, centerFrac: 0.47 };
    case "1:1":
    default:
      return { cardFrac: 0.78, prizeFrac: 0.08, centerFrac: 0.47 };
  }
}

const SCRATCH_AT = 0.6;
const SCRATCH_DUR = 1.5;
const DURATION = 5.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#15161A"));
  const textColor = str(values.textColor, pc("textColor", "#F6F6F8"));
  const accent = str(values.accent, pc("accent", "#F5A623"));
  const prize = str(values.prize, "20% OFF");
  const caption = str(values.caption, "Scratch to reveal");
  const code = str(values.code, "").trim();
  const showFlakes = on(values.showFlakes);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cy = size.height * L.centerFrac;
  const cardW = size.width * L.cardFrac;
  const cardH = cardW * 0.6;
  const prizeSize = Math.round(size.width * L.prizeFrac);
  const radius = cardW * 0.06;

  const timeline = new JimaTimeline();

  // --- The card, and the prize underneath ---
  const card = new Container();
  card.position.set(cx, cy);
  root.addChild(card);

  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius).fill(accent));
  const prizeText = makeText(fonts, {
    text: prize,
    role: "display",
    weight: 800,
    size: prizeSize,
    color: bg,
    anchor: 0.5,
  });
  if (prizeText.width > cardW * 0.82) prizeText.scale.set((cardW * 0.82) / prizeText.width);
  prizeText.y = code ? -prizeSize * 0.35 : 0;
  card.addChild(prizeText);

  if (code.length > 0) {
    const cSize = prizeSize * 0.34;
    const cText = makeText(fonts, {
      text: code.toUpperCase(),
      role: "mono",
      weight: 700,
      size: cSize,
      color: bg,
      anchor: 0.5,
      letterSpacing: cSize * 0.1,
    });
    const w = cText.width + cSize * 1.4;
    const h = cSize * 2;
    const chip = new Container();
    chip.addChild(
      new Graphics().roundRect(-w / 2, -h / 2, w, h, cSize * 0.3).stroke({ color: bg, width: Math.max(2, cSize * 0.09), alpha: 0.6 }),
      cText,
    );
    chip.y = prizeSize * 0.6;
    card.addChild(chip);
  }

  // --- The coating, and the mask that eats it ---
  const coat = new Container();
  card.addChild(coat);
  coat.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius).fill("#9AA0A8"));
  // Brushed-metal streaks, so it looks like foil rather than grey paint.
  for (let i = 0; i < 14; i++) {
    const y = -cardH / 2 + (cardH * (i + 0.5)) / 14;
    coat.addChild(
      new Graphics()
        .rect(-cardW / 2, y, cardW, cardH * 0.02)
        .fill({ color: "#FFFFFF", alpha: 0.05 + rng.range(0, 0.06) }),
    );
  }
  const hint = makeText(fonts, {
    text: caption,
    role: "body",
    weight: 700,
    size: prizeSize * 0.28,
    color: "#3F4650",
    anchor: 0.5,
  });
  hint.alpha = 0.85;
  coat.addChild(hint);
  timeline.to(hint, { prop: "alpha", from: 0.85, to: 0, start: SCRATCH_AT, duration: 0.35, ease: outQuad });

  // A Pixi mask is an additive stencil, so the coating cannot have holes cut
  // in it. Instead the coat is masked by strips that *retreat*: each strip
  // scales to nothing from its own leading edge, so the foil comes off in
  // strokes, alternating direction like a thumb going back and forth.
  const passes = 6;
  const stripH = cardH / passes;
  const clip = new Container();
  card.addChild(clip);
  coat.mask = clip;
  for (let i = 0; i < passes; i++) {
    const y = -cardH / 2 + stripH * i;
    const g = new Graphics().rect(-cardW / 2, y, cardW, stripH + 1).fill("#FFFFFF");
    // Each strip is wiped away from alternating sides, like a thumb going back
    // and forth. Scale about the leading edge so it retreats rather than shrinks.
    const fromLeft = i % 2 === 0;
    g.pivot.set(fromLeft ? -cardW / 2 : cardW / 2, 0);
    g.position.set(fromLeft ? -cardW / 2 : cardW / 2, 0);
    clip.addChild(g);
    const at = SCRATCH_AT + (SCRATCH_DUR / passes) * i;
    timeline.to(g, { prop: "scale.x", from: 1, to: 0, start: at, duration: (SCRATCH_DUR / passes) * 1.5, ease: outQuad });
  }

  // --- Flakes flying off ---
  if (showFlakes) {
    for (let i = 0; i < 22; i++) {
      const s = cardW * (0.008 + rng.range(0, 0.014));
      const f = new Graphics().rect(-s / 2, -s / 2, s, s * 0.7).fill("#9AA0A8");
      const x0 = -cardW / 2 + rng.range(0, cardW);
      const y0 = -cardH / 2 + rng.range(0, cardH);
      f.position.set(x0, y0);
      f.rotation = rng.range(0, Math.PI);
      f.alpha = 0;
      card.addChild(f);
      const at = SCRATCH_AT + (Math.abs(y0 + cardH / 2) / cardH) * SCRATCH_DUR;
      const drift = rng.range(-cardW * 0.12, cardW * 0.12);
      timeline
        .to(f, { prop: "alpha", from: 0.9, to: 0, start: at, duration: 0.6, ease: outQuad })
        .to(f, { prop: "x", from: x0, to: x0 + drift, start: at, duration: 0.75, ease: outQuad })
        .to(f, { prop: "y", from: y0, to: y0 + cardH * 0.35, start: at, duration: 0.75, ease: outQuad })
        .to(f, { prop: "rotation", from: f.rotation, to: f.rotation + rng.range(-2, 2), start: at, duration: 0.75, ease: outQuad });
    }
  }

  // --- Card entrance and a pop when the prize is fully out ---
  card.alpha = 0;
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.3, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.86, to: 1, start: 0.2, duration: 0.7, ease: outBack })
    .to(card, { prop: "scale.y", from: 0.86, to: 1, start: 0.2, duration: 0.7, ease: outBack })
    .to(card, { prop: "scale.x", from: 1, to: 1.05, start: SCRATCH_AT + SCRATCH_DUR, duration: 0.22, ease: outQuad })
    .to(card, { prop: "scale.y", from: 1, to: 1.05, start: SCRATCH_AT + SCRATCH_DUR, duration: 0.22, ease: outQuad })
    .to(card, { prop: "scale.x", from: 1.05, to: 1, start: SCRATCH_AT + SCRATCH_DUR + 0.22, duration: 0.5, ease: outExpo })
    .to(card, { prop: "scale.y", from: 1.05, to: 1, start: SCRATCH_AT + SCRATCH_DUR + 0.22, duration: 0.5, ease: outExpo });

  // --- Caption under the card, once revealed ---
  const cap = makeText(fonts, {
    text: caption,
    role: "body",
    weight: 600,
    size: prizeSize * 0.3,
    color: textColor,
    anchor: 0.5,
  });
  const cy2 = cy + cardH / 2 + prizeSize * 0.6;
  cap.alpha = 0;
  cap.position.set(cx, cy2);
  root.addChild(cap);
  timeline
    .to(cap, { prop: "alpha", from: 0, to: 0.7, start: SCRATCH_AT + SCRATCH_DUR + 0.15, duration: 0.5, ease: outQuad })
    .to(cap, { prop: "y", from: cy2 + prizeSize * 0.2, to: cy2, start: SCRATCH_AT + SCRATCH_DUR + 0.15, duration: 0.75, ease: outExpo });

  return { timeline, duration: DURATION };
}

export const scratchReveal: TemplateDefinition = {
  id: "scratch-reveal",
  name: "Scratch Card",
  tagline: "A silver panel is scratched off in strokes, flakes flying, to reveal the offer.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { prize: "display", caption: "body" },
  palettes: PALETTES,
  fields: [
    { key: "prize", type: "text", label: "Prize", default: "20% OFF", maxLength: 22, shrinkToFit: true },
    { key: "code", type: "text", label: "Code", default: "SPRING20", maxLength: 16, optional: true },
    { key: "caption", type: "text", label: "Caption", default: "Scratch to reveal", maxLength: 34 },
    { key: "showFlakes", type: "toggle", label: "Flakes", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Caption", default: "", optional: true },
    { key: "accent", type: "color", label: "Under the coating", default: "", optional: true },
  ],
  build,
};
