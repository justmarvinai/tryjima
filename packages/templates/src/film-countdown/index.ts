import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  linear,
  outQuad,
  makeOutBack,
  spring,
  safeZone,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

// A cinema film-leader look reads dark by convention; "paper noir" gives a
// light-mode option while keeping the same extreme, easily-compliant contrast.
const PALETTES: Palette[] = [
  { id: "silver-screen", name: "Silver screen", colors: { background: "#0B0B0C", textColor: "#F5F5F0", accent: "#F5F5F0" } },
  { id: "archive-amber", name: "Archive amber", colors: { background: "#14100A", textColor: "#FFF4DE", accent: "#FFB020" } },
  { id: "projector-blue", name: "Projector blue", colors: { background: "#0A0E16", textColor: "#EAF2FF", accent: "#4D96FF" } },
  { id: "paper-noir", name: "Paper noir", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#101014" } },
];

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

interface Layout {
  circleFrac: number;
  titleFrac: number;
}
function layoutFor(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { circleFrac: 0.3, titleFrac: 0.086 };
    case "9:16":
      return { circleFrac: 0.3, titleFrac: 0.104 };
    case "4:5":
      return { circleFrac: 0.32, titleFrac: 0.096 };
    case "1:1":
    default:
      return { circleFrac: 0.33, titleFrac: 0.096 };
  }
}

// Fixed pacing (not wall-clock): three even beats, then a settle gap, then the
// title takes over. Kept as named constants so the timing reads as intentional.
const SEG_DUR = 0.85;
const COUNT_END = SEG_DUR * 3;
const GAP = 0.15;
const TITLE_START = COUNT_END + GAP;
const DUR = 4.4;
const GRAIN_FPS = 12;
const GRAIN_FRAME_COUNT = 8;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#0B0B0C"));
  const textColor = str(values.textColor, pcol("textColor", "#F5F5F0"));
  const accent = str(values.accent, pcol("accent", "#F5F5F0"));
  const title = str(values.title, "Coming Up");
  const showGrain = on(values.showGrain);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;

  const zone = safeZone(ctx.aspect);
  const safeH = h - zone.top - zone.bottom;
  const cy = zone.top + safeH * 0.46;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Film grain: a deterministic flip-book of seeded dot patterns, behind
  // everything else so it never touches text contrast. Pure in t: the visible
  // frame index is `floor(t * GRAIN_FPS) % GRAIN_FRAME_COUNT`. ---
  const grainFrames: Graphics[] = [];
  if (showGrain) {
    const grainHolder = new Container();
    grainHolder.label = "grain";
    root.addChild(grainHolder);
    const DOTS = 70;
    for (let f = 0; f < GRAIN_FRAME_COUNT; f++) {
      const g = new Graphics();
      const fr = rng.fork(f * 11 + 5);
      for (let i = 0; i < DOTS; i++) {
        const x = fr.range(0, w);
        const y = fr.range(0, h);
        const r = fr.range(0.5, 1.6);
        const tone = fr.pick(["#FFFFFF", "#000000"] as const);
        const a = fr.range(0.03, 0.08);
        g.circle(x, y, r).fill({ color: tone, alpha: a });
      }
      g.visible = f === 0;
      grainHolder.addChild(g);
      grainFrames.push(g);
    }
  }

  const L = layoutFor(ctx.aspect);
  const R = minDim * L.circleFrac;

  const rig = new Container();
  rig.label = "rig";
  rig.position.set(cx, cy);
  root.addChild(rig);

  // Concentric rings.
  const rings = new Graphics();
  rings.circle(0, 0, R).stroke({ color: accent, width: Math.max(2, R * 0.018) });
  rings.circle(0, 0, R * 0.78).stroke({ color: accent, width: Math.max(1.5, R * 0.01), alpha: 0.45 });
  rings.circle(0, 0, R * 0.56).stroke({ color: accent, width: Math.max(1.5, R * 0.01), alpha: 0.3 });
  rig.addChild(rings);

  // Crosshair.
  const cross = new Graphics();
  cross.moveTo(-R * 1.05, 0).lineTo(R * 1.05, 0);
  cross.moveTo(0, -R * 1.05).lineTo(0, R * 1.05);
  cross.stroke({ color: accent, width: Math.max(1.5, R * 0.012), alpha: 0.4 });
  rig.addChild(cross);

  // Radar sweep hand — a full turn per count, driven purely by rotation tweens.
  const sweep = new Container();
  sweep.label = "sweep";
  const handW = Math.max(2, R * 0.032);
  sweep.addChild(new Graphics().rect(-handW / 2, -R * 0.96, handW, R * 0.96).fill(accent));
  sweep.addChild(new Graphics().circle(0, 0, handW * 1.5).fill(accent));
  rig.addChild(sweep);

  for (let i = 0; i < 3; i++) {
    const start = i * SEG_DUR;
    // 0 -> 2*PI reads as a seamless full turn (2*PI is visually identical to 0,
    // so the snap back to the next segment's `from: 0` never pops).
    timeline.to(sweep, { prop: "rotation", from: 0, to: Math.PI * 2, start, duration: SEG_DUR, ease: linear });
  }

  // Countdown number — one Text node, swapped in place with a pop per beat.
  const numberSize = Math.round(minDim * 0.22);
  const numberText = makeText(fonts, { text: "3", role: "display", weight: 700, size: numberSize, color: accent, anchor: 0.5, align: "center" });
  numberText.alpha = 0;
  numberText.scale.set(0.55);
  rig.addChild(numberText);

  const popDur = 0.22;
  const preSwapFade = 0.16;
  for (let i = 0; i < 3; i++) {
    const value = 3 - i;
    const start = i * SEG_DUR;
    timeline.set(numberText, "text", String(value), start);
    timeline
      .to(numberText, { prop: "alpha", from: 0, to: 1, start, duration: Math.min(0.14, popDur), ease: outQuad })
      .to(numberText, { prop: "scale.x", from: 0.55, to: 1, start, duration: popDur, ease: makeOutBack(2.1) })
      .to(numberText, { prop: "scale.y", from: 0.55, to: 1, start, duration: popDur, ease: makeOutBack(2.1) });
    if (i < 2) {
      const fadeStart = start + SEG_DUR - preSwapFade;
      timeline
        .to(numberText, { prop: "alpha", from: 1, to: 0, start: fadeStart, duration: preSwapFade, ease: outQuad })
        .to(numberText, { prop: "scale.x", from: 1, to: 1.12, start: fadeStart, duration: preSwapFade, ease: outQuad })
        .to(numberText, { prop: "scale.y", from: 1, to: 1.12, start: fadeStart, duration: preSwapFade, ease: outQuad });
    }
  }

  // The whole countdown rig (rings, crosshair, sweep, number) fades as one
  // unit once the title takes over — a clean handoff to the designed hold.
  timeline.to(rig, { prop: "alpha", from: 1, to: 0, start: TITLE_START, duration: 0.4, ease: outQuad });

  // --- Title reveal ---
  const titleSize0 = Math.round(w * L.titleFrac);
  const titleSize = fitSize(fonts, title, "display", 700, titleSize0, w * 0.82);
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, cy);
  titleText.alpha = 0;
  titleText.scale.set(0.7);
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: TITLE_START, duration: 0.3, ease: outQuad })
    .to(titleText, { prop: "scale.x", from: 0.7, to: 1, start: TITLE_START, duration: 0.55, ease: spring(0.42) })
    .to(titleText, { prop: "scale.y", from: 0.7, to: 1, start: TITLE_START, duration: 0.55, ease: spring(0.42) });

  const update = (t: number): void => {
    if (!showGrain || grainFrames.length === 0) return;
    const idx = Math.floor(t * GRAIN_FPS) % grainFrames.length;
    for (let i = 0; i < grainFrames.length; i++) {
      const gframe = grainFrames[i];
      if (gframe) gframe.visible = i === idx;
    }
  };

  return { timeline, duration: DUR, update };
}

export const filmCountdown: TemplateDefinition = {
  id: "film-countdown",
  name: "Film Countdown",
  tagline: "A cinema-leader countdown with a radar sweep, then your title.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.5,
  fontRoles: { title: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Coming Up", maxLength: 28, shrinkToFit: true },
    { key: "showGrain", type: "toggle", label: "Film grain", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
