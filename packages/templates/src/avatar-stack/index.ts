import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  outExpo,
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
import { makePill } from "../shared/ui";
import { groupThousands, parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Rough perceived luminance of a #rrggbb color (0..1). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** Largest size <= size0 at which `text` fits maxWidth (crisp, single-line). */
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
  return w > maxWidth ? Math.max(10, Math.floor((size0 * maxWidth) / w)) : size0;
}

// A fixed decorative hue bank for the avatar fills — varied on purpose and
// independent of the brand palette (like this-or-that's gradients).
const AVATAR_HUES = ["#FF8A3D", "#4FA3F7", "#8B5CF6", "#FF5B8F", "#12A66B", "#F7B245", "#FF6250", "#2FB8C6"];

const PALETTES: Palette[] = [
  { id: "porcelain", name: "Porcelain", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#0F7A3D", onAccent: "#FFFFFF" } },
  { id: "sky", name: "Sky", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2A5AD6", onAccent: "#FFFFFF" } },
  { id: "peach", name: "Peach", colors: { background: "#FFF1E6", textColor: "#3A1500", accent: "#C2380F", onAccent: "#FFFFFF" } },
  { id: "ink", name: "Ink", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D", onAccent: "#101014" } },
];

const N_AVATARS = 7;
const POP_START = 0.45;
const POP_STAGGER = 0.14;
const COUNT_START = 1.0;
const COUNT_END = 2.4;
const CTA_AT = 2.6;
const SPARKLE_AT = 2.85;
const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#0F7A3D"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const title = str(values.title, "You're in good company");
  const target = Math.max(1, Math.round(parseTargetNumber(str(values.count, "2,481")) || 2481));
  const suffix = str(values.countLabel, "others");
  const cta = str(values.cta, "Join them");
  const showCta = on(values.showCta);
  const showSparkles = on(values.showSparkles);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // Seeded variety — drawn up-front so toggles don't reshuffle the stream.
  const hueStart = rng.int(0, AVATAR_HUES.length - 1);
  const tilts: number[] = [];
  for (let i = 0; i < N_AVATARS; i++) tilts.push(rng.range(-0.16, 0.16));
  // Sparkles flank the pile left/right so they never sit on the text lines.
  interface Spark {
    side: number;
    outX: number;
    offY: number;
    s: number;
    star: boolean;
  }
  const sparks: Spark[] = [];
  for (let i = 0; i < 8; i++) {
    sparks.push({
      side: i % 2 === 0 ? 1 : -1,
      outX: rng.range(0.035, 0.095),
      offY: rng.range(-1.3, 1.3),
      s: rng.range(0.011, 0.019),
      star: rng.next() < 0.5,
    });
  }

  // --- Vertical stack: title, avatar pile, count line, CTA pill ---
  const ts = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.055), safe.width * 0.9);
  const titleH = ts * 1.2;
  const gapT = minDim * 0.05;
  const r = Math.min(minDim * 0.06, (safe.width * 0.84) / (2 + (N_AVATARS - 1) * 1.5));
  const pileH = r * 2;
  const gapP = minDim * 0.05;
  const cs = Math.round(minDim * 0.052);
  const countH = cs * 1.2;
  const gapC = minDim * 0.045;
  const pillH = minDim * 0.075;
  const totalH = titleH + gapT + pileH + gapP + countH + (showCta ? gapC + pillH : 0);
  const top = safe.y + (safe.height - totalH) / 2;

  // --- Title ---
  const titleCy = top + titleH / 2;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: ts, color: textColor, anchor: 0.5 });
  titleText.position.set(cx, titleCy);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.12, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleCy - 14, to: titleCy, start: 0.12, duration: 0.5, ease: outExpo });

  // --- Overlapping avatar pile, popping in one by one ---
  const step = r * 1.5;
  const pileW = r * 2 + (N_AVATARS - 1) * step;
  const pileCy = top + titleH + gapT + r;
  const pileLeft = cx - pileW / 2 + r;
  const ringW = Math.max(3, r * 0.14);

  for (let i = 0; i < N_AVATARS; i++) {
    const hue = AVATAR_HUES[(hueStart + i) % AVATAR_HUES.length]!;
    const iconColor = luminance(hue) < 0.55 ? "#FFFFFF" : "#1F2430";
    const av = new Container();
    av.addChild(new Graphics().circle(0, 0, r + ringW).fill(bg));
    av.addChild(new Graphics().circle(0, 0, r).fill(hue));
    const face = makeIcon("user", r * 1.08, { color: iconColor });
    face.position.set(0, r * 0.08);
    av.addChild(face);
    av.position.set(pileLeft + i * step, pileCy);
    av.scale.set(0);
    av.rotation = tilts[i]!;
    root.addChild(av);

    const start = POP_START + i * POP_STAGGER;
    timeline
      .to(av, { prop: "scale.x", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(1.85) })
      .to(av, { prop: "scale.y", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(1.85) })
      .to(av, { prop: "rotation", from: tilts[i]!, to: 0, start, duration: 0.55, ease: outCubic });
  }

  // --- "+2,481 others" count line (ticks up in update) ---
  const countCy = top + titleH + gapT + pileH + gapP + countH / 2;
  const finalLine = `+${groupThousands(target)} ${suffix}`;
  const csFit = fitSize(fonts, finalLine, "display", 700, cs, safe.width * 0.9);
  const countText = makeText(fonts, { text: `+0 ${suffix}`, role: "display", weight: 700, size: csFit, color: textColor, anchor: 0.5 });
  countText.position.set(cx, countCy);
  countText.alpha = 0;
  root.addChild(countText);
  timeline
    .to(countText, { prop: "alpha", from: 0, to: 1, start: COUNT_START - 0.1, duration: 0.35, ease: outQuad })
    .to(countText, { prop: "scale.x", from: 1, to: 1.06, start: COUNT_END, duration: 0.13, ease: outQuad })
    .to(countText, { prop: "scale.y", from: 1, to: 1.06, start: COUNT_END, duration: 0.13, ease: outQuad })
    .to(countText, { prop: "scale.x", from: 1.06, to: 1, start: COUNT_END + 0.13, duration: 0.3, ease: outCubic })
    .to(countText, { prop: "scale.y", from: 1.06, to: 1, start: COUNT_END + 0.13, duration: 0.3, ease: outCubic });

  // --- CTA pill lands beneath ---
  if (showCta) {
    const pillCy = top + totalH - pillH / 2;
    const ctaSize = fitSize(fonts, cta, "display", 700, Math.round(pillH * 0.42), safe.width * 0.7);
    const ctaText = makeText(fonts, { text: cta, role: "display", weight: 700, size: ctaSize, color: onAccent, anchor: 0.5 });
    const pillW = ctaText.width + pillH * 1.2;
    const pill = new Container();
    const pShadow = makePill(pillW, pillH, "#000000");
    pShadow.alpha = 0.14;
    pShadow.position.set(0, pillH * 0.08);
    pill.addChild(pShadow);
    pill.addChild(makePill(pillW, pillH, accent));
    pill.addChild(ctaText);
    pill.position.set(cx, pillCy + minDim * 0.04);
    pill.alpha = 0;
    pill.scale.set(0.7);
    root.addChild(pill);
    timeline
      .to(pill, { prop: "alpha", from: 0, to: 1, start: CTA_AT, duration: 0.25, ease: outQuad })
      .to(pill, { prop: "scale.x", from: 0.7, to: 1, start: CTA_AT, duration: 0.6, ease: spring(0.45) })
      .to(pill, { prop: "scale.y", from: 0.7, to: 1, start: CTA_AT, duration: 0.6, ease: spring(0.45) })
      .to(pill, { prop: "y", from: pillCy + minDim * 0.04, to: pillCy, start: CTA_AT, duration: 0.6, ease: outExpo });
  }

  // --- Sparkles around the pile (decorative) ---
  if (showSparkles) {
    sparks.forEach((sp, i) => {
      const sx = cx + sp.side * (pileW * 0.5 + sp.outX * minDim);
      const sy = pileCy + sp.offY * r;
      const g = makeIcon(sp.star ? "star" : "plus", sp.s * minDim * 2, { color: accent });
      g.position.set(sx, sy);
      g.scale.set(0);
      g.rotation = sp.offY;
      root.addChild(g);
      const start = SPARKLE_AT + i * 0.045;
      timeline
        .to(g, { prop: "scale.x", from: 0, to: 1, start, duration: 0.4, ease: makeOutBack(2.2) })
        .to(g, { prop: "scale.y", from: 0, to: 1, start, duration: 0.4, ease: makeOutBack(2.2) })
        .to(g, { prop: "rotation", from: sp.offY, to: sp.offY + 0.4, start, duration: 0.5, ease: outCubic });
    });
  }

  // --- Pure per-frame hook: count-up ---
  const update = (t: number): void => {
    const u = clamp01((t - COUNT_START) / (COUNT_END - COUNT_START));
    const eased = 1 - Math.pow(1 - u, 3);
    countText.text = `+${groupThousands(Math.round(target * eased))} ${suffix}`;
  };

  return { timeline, duration: DURATION, update };
}

export const avatarStack: TemplateDefinition = {
  id: "avatar-stack",
  name: "Avatar Stack",
  tagline: "Avatars pile up one by one, the crowd count ticks in, and a join pill lands.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.7,
  fontRoles: { title: "display", cta: "display", countLabel: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "You're in good company", maxLength: 32, shrinkToFit: true },
    { key: "count", type: "text", label: "Count", default: "2,481", maxLength: 9 },
    { key: "countLabel", type: "text", label: "Count label", default: "others", maxLength: 20, shrinkToFit: true },
    { key: "cta", type: "text", label: "Button", default: "Join them", maxLength: 18, shrinkToFit: true },
    { key: "showCta", type: "toggle", label: "CTA pill", default: true },
    { key: "showSparkles", type: "toggle", label: "Sparkles", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
