import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  inOutCubic,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

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
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = h.length >= 6 ? h.slice(0, 6) : h.padEnd(6, h.slice(-1) || "0");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

/** Mix two #rrggbb colors: u = 0 → a, u = 1 → b. */
function mixHex(a: string, b: string, u: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  let out = "#";
  for (let i = 0; i < 3; i++) {
    const v = Math.round(ca[i]! + (cb[i]! - ca[i]!) * clamp01(u));
    out += v.toString(16).padStart(2, "0");
  }
  return out;
}

// One landscape, four moods. Each palette gives a base sky (= `background`, the
// colour the text sits on in every season, so contrast never drifts), two hill
// tones and a trunk; the four season hues tint them.
const PALETTES: Palette[] = [
  {
    id: "nordic-day",
    name: "Nordic day",
    colors: {
      background: "#E4EEF5", hillFar: "#9FB3A8", hillNear: "#6E8878", trunk: "#4A3A2E",
      spring: "#86C48A", summer: "#2F7A46", autumn: "#C9702A", winter: "#CFE0EE",
      textColor: "#16232C", accent: "#2E7DF6",
    },
  },
  {
    id: "warm-paper",
    name: "Warm paper",
    colors: {
      background: "#FAF3E7", hillFar: "#C7B79C", hillNear: "#A08D6E", trunk: "#5A4632",
      spring: "#9BC97F", summer: "#4E8B3C", autumn: "#D0762B", winter: "#DED9CB",
      textColor: "#2B2013", accent: "#B5561F",
    },
  },
  {
    id: "dusk-violet",
    name: "Dusk violet",
    colors: {
      background: "#1B2036", hillFar: "#2E3550", hillNear: "#1D2338", trunk: "#171326",
      spring: "#4E8467", summer: "#2F6B4B", autumn: "#8A4A2C", winter: "#6E82A8",
      textColor: "#F2F4FB", accent: "#FFB05C",
    },
  },
  {
    id: "sea-glass",
    name: "Sea glass",
    colors: {
      background: "#E8F3F1", hillFar: "#96B7B1", hillNear: "#64908A", trunk: "#3E4A44",
      spring: "#8CC79B", summer: "#2E7F5E", autumn: "#C97C34", winter: "#D3E6EC",
      textColor: "#0F2622", accent: "#0E7C6B",
    },
  },
];

const DEFAULT_SEASONS = ["Spring", "Summer", "Autumn", "Winter"];
const SEASON_KEYS = ["spring", "summer", "autumn", "winter"];
/** Start times of the three crossfades — nothing ever cuts. */
const TRANS = [0.85, 2.05, 3.25];
const TRANS_DUR = 0.9;
const SKY_BANDS = 40;
const DURATION = 5.0;
// How far each season's hue takes over the ground. Winter goes furthest so the
// hills actually read as snow rather than a tinted summer.
const FAR_MIX = [0.6, 0.6, 0.6, 0.85];
const NEAR_MIX = [0.42, 0.42, 0.42, 0.72];

/** Where the horizon sits — higher in tall frames so the sky never yawns. */
const horizonFrac = (aspect: Aspect): number => {
  switch (aspect) {
    case "16:9":
      return 0.58;
    case "1:1":
      return 0.54;
    case "4:5":
      return 0.5;
    case "9:16":
      return 0.46;
  }
};

interface Drift {
  x0: number;
  y0: number;
  speed: number;
  sway: number;
  freq: number;
  phase: number;
  size: number;
}

function seasonLabels(values: Values): string[] {
  const src = asList(values.seasons, DEFAULT_SEASONS);
  const out: string[] = [];
  for (let i = 0; i < 4; i++) out.push(src[i] ?? DEFAULT_SEASONS[i]!);
  return out;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#E4EEF5"));
  const hillFarBase = pc("hillFar", "#9FB3A8");
  const hillNearBase = pc("hillNear", "#6E8878");
  const trunkBase = pc("trunk", "#4A3A2E");
  const textColor = str(values.textColor, pc("textColor", "#16232C"));
  const accent = str(values.accent, pc("accent", "#2E7DF6"));
  const hues = SEASON_KEYS.map((k, i) => pc(k, ["#86C48A", "#2F7A46", "#C9702A", "#CFE0EE"][i]!));

  const title = str(values.title, "Hokkaido");
  const labels = seasonLabels(values);
  const showParticles = values.showParticles !== false;
  const showTree = values.showTree !== false;
  const showHorizon = values.showHorizon !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Scene: four identical landscapes, one per season, cross-dissolving ---
  const scene = new Container();
  scene.position.set(cx, h / 2);
  scene.pivot.set(cx, h / 2);
  scene.alpha = 0;
  root.addChild(scene);
  timeline
    .to(scene, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.7, ease: outQuad })
    // A very slow push-in so the frame never feels frozen between seasons.
    .to(scene, { prop: "scale.x", from: 1.06, to: 1, start: 0, duration: 4.4, ease: outQuad })
    .to(scene, { prop: "scale.y", from: 1.06, to: 1, start: 0, duration: 4.4, ease: outQuad });

  const horizonY = h * horizonFrac(ctx.aspect);
  const hillTop = horizonY + minDim * 0.125;
  const amp = minDim * 0.02;
  const bandH = horizonY / SKY_BANDS;
  const treeH = minDim * 0.2;
  const treeX = w * 0.27;
  const treeBaseY = hillTop + minDim * 0.005;

  for (let k = 0; k < 4; k++) {
    const hue = hues[k]!;
    const skyLow = mixHex(bg, hue, 0.3);
    const far = mixHex(hillFarBase, hue, FAR_MIX[k]!);
    const near = mixHex(hillNearBase, hue, NEAR_MIX[k]!);
    const trunk = mixHex(trunkBase, hue, 0.15);
    const canopyEdge = mixHex(hue, trunkBase, 0.2);

    const layer = new Container();
    scene.addChild(layer);

    // Sky — banded gradient from the base sky down to the season's horizon glow.
    const sky = new Graphics();
    for (let i = 1; i < SKY_BANDS; i++) {
      sky.rect(-w * 0.06, i * bandH, w * 1.12, bandH + 1).fill(mixHex(bg, skyLow, i / (SKY_BANDS - 1)));
    }
    layer.addChild(sky);

    // Far ground.
    layer.addChild(
      new Graphics()
        .moveTo(-w * 0.06, horizonY + amp * 0.3)
        .quadraticCurveTo(w * 0.3, horizonY - amp, w * 0.62, horizonY + amp * 0.2)
        .quadraticCurveTo(w * 0.86, horizonY + amp * 0.9, w * 1.06, horizonY - amp * 0.2)
        .lineTo(w * 1.06, h * 1.06)
        .lineTo(-w * 0.06, h * 1.06)
        .closePath()
        .fill(far),
    );

    // Near hill.
    layer.addChild(
      new Graphics()
        .moveTo(-w * 0.06, hillTop + minDim * 0.06)
        .quadraticCurveTo(w * 0.26, hillTop - minDim * 0.045, w * 0.62, hillTop + minDim * 0.05)
        .quadraticCurveTo(w * 0.85, hillTop + minDim * 0.09, w * 1.06, hillTop + minDim * 0.03)
        .lineTo(w * 1.06, h * 1.06)
        .lineTo(-w * 0.06, h * 1.06)
        .closePath()
        .fill(near),
    );

    if (showTree) {
      const tw = Math.max(3, treeH * 0.075);
      const rim = treeH * 0.022;
      const tree = new Graphics()
        .roundRect(treeX - tw / 2, treeBaseY - treeH * 0.66, tw, treeH * 0.66, tw * 0.4)
        .fill(trunk)
        // A soft rim keeps the canopy readable even when the season hue and the
        // hill behind it are both pale (winter).
        .circle(treeX - treeH * 0.2, treeBaseY - treeH * 0.56, treeH * 0.24 + rim)
        .fill(canopyEdge)
        .circle(treeX + treeH * 0.21, treeBaseY - treeH * 0.57, treeH * 0.23 + rim)
        .fill(canopyEdge)
        .circle(treeX, treeBaseY - treeH * 0.74, treeH * 0.3 + rim)
        .fill(canopyEdge)
        .circle(treeX - treeH * 0.2, treeBaseY - treeH * 0.56, treeH * 0.24)
        .fill(hue)
        .circle(treeX + treeH * 0.21, treeBaseY - treeH * 0.57, treeH * 0.23)
        .fill(hue)
        .circle(treeX, treeBaseY - treeH * 0.74, treeH * 0.3)
        .fill(hue);
      layer.addChild(tree);
    }

    if (k > 0) {
      layer.alpha = 0;
      timeline.to(layer, { prop: "alpha", from: 0, to: 1, start: TRANS[k - 1]!, duration: TRANS_DUR, ease: inOutCubic });
    }
  }

  if (showHorizon) {
    const line = new Graphics()
      .moveTo(-w * 0.06, horizonY + amp * 0.3)
      .quadraticCurveTo(w * 0.3, horizonY - amp, w * 0.62, horizonY + amp * 0.2)
      .quadraticCurveTo(w * 0.86, horizonY + amp * 0.9, w * 1.06, horizonY - amp * 0.2)
      .stroke({ color: accent, width: Math.max(1.5, minDim * 0.003), alpha: 0.3 });
    line.alpha = 0;
    scene.addChild(line);
    timeline.to(line, { prop: "alpha", from: 0, to: 1, start: 0.35, duration: 0.8, ease: outQuad });
  }

  // --- Drifting particles: petals → leaves → snow, tinted by the same clock ---
  const driftG = new Graphics();
  driftG.alpha = 0;
  root.addChild(driftG);
  const drifts: Drift[] = [];
  const pad = h * 0.08;
  const span = h + pad * 2;
  if (showParticles) {
    for (let i = 0; i < 16; i++) {
      const r = rng.fork(i + 11);
      drifts.push({
        x0: r.range(w * 0.04, w * 0.96),
        y0: r.range(0, span),
        speed: h * r.range(0.055, 0.11),
        sway: w * r.range(0.012, 0.03),
        freq: r.range(0.7, 1.4),
        phase: r.range(0, Math.PI * 2),
        size: minDim * r.range(0.004, 0.008),
      });
    }
    timeline.to(driftG, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.9, ease: outQuad });
  }

  // --- Place name + the season word crossfading in step with the scene ---
  // One shared size so the words trade places without resizing mid-dissolve.
  const placeSize = Math.round(minDim * 0.028);
  let seasonSize = Math.round(minDim * 0.085);
  for (const l of labels) seasonSize = Math.min(seasonSize, fitSize(fonts, l, "display", 700, seasonSize, zone.width * 0.82));
  // The pair sits centered in the open sky above the horizon, not pinned to the
  // very top — keeps tall aspects from opening on a big empty band.
  const blockH = placeSize + minDim * 0.024 + seasonSize;
  const placeY = Math.max(zone.y + placeSize * 0.7, (zone.y + horizonY) / 2 - blockH / 2 + placeSize * 0.5);
  const seasonY = placeY + placeSize * 0.5 + minDim * 0.024 + seasonSize * 0.5;

  const placeText = makeText(fonts, { text: title, role: "body", weight: 600, size: fitSize(fonts, title, "body", 600, placeSize, zone.width * 0.7), color: textColor, anchor: 0.5, letterSpacing: 4 });
  placeText.position.set(cx, placeY);
  placeText.alpha = 0;
  root.addChild(placeText);
  timeline
    .to(placeText, { prop: "alpha", from: 0, to: 0.7, start: 0.15, duration: 0.6, ease: outQuad })
    .to(placeText, { prop: "y", from: placeY - 10, to: placeY, start: 0.15, duration: 0.7, ease: outQuint });

  labels.forEach((label, i) => {
    const t = makeText(fonts, { text: label, role: "display", weight: 700, size: seasonSize, color: textColor, anchor: 0.5, align: "center" });
    t.position.set(cx, seasonY);
    t.alpha = 0;
    root.addChild(t);
    const inAt = i === 0 ? 0.25 : TRANS[i - 1]! + 0.2;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start: inAt, duration: 0.5, ease: outQuad })
      .to(t, { prop: "y", from: seasonY + 14, to: seasonY, start: inAt, duration: 0.65, ease: outQuint });
    if (i < 3) {
      const outAt = TRANS[i]! + 0.05;
      timeline
        .to(t, { prop: "alpha", from: 1, to: 0, start: outAt, duration: 0.45, ease: outQuad })
        .to(t, { prop: "y", from: seasonY, to: seasonY - 14, start: outAt, duration: 0.6, ease: outQuad });
    }
  });

  /** How far through the four seasons we are at time t: 0 → 3. */
  const seasonProgress = (t: number): number => {
    let p = 0;
    for (const s of TRANS) p += inOutCubic(clamp01((t - s) / TRANS_DUR));
    return p;
  };

  const update = (t: number): void => {
    if (drifts.length === 0) return;
    driftG.clear();
    const p = seasonProgress(t);
    const i = Math.min(2, Math.floor(p));
    const tint = mixHex(mixHex(hues[i]!, hues[i + 1]!, clamp01(p - i)), "#FFFFFF", 0.42);
    for (const d of drifts) {
      const y = (((d.y0 + d.speed * t) % span) + span) % span - pad;
      const x = d.x0 + Math.sin(t * d.freq + d.phase) * d.sway;
      const fade = clamp01(Math.min(y + pad, h + pad - y) / pad);
      if (fade <= 0.01) continue;
      driftG.circle(x, y, d.size).fill({ color: tint, alpha: fade * 0.8 });
    }
  };

  return { timeline, duration: DURATION, update };
}

export const seasonShift: TemplateDefinition = {
  id: "season-shift",
  name: "Season Shift",
  tagline: "One quiet landscape dissolves through spring, summer, autumn and winter.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 4.7,
  fontRoles: { title: "body", seasons: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Place", default: "Hokkaido", maxLength: 22, shrinkToFit: true },
    {
      key: "seasons",
      type: "textlist",
      label: "Season words",
      default: DEFAULT_SEASONS,
      minItems: 4,
      maxItems: 4,
      maxLength: 14,
      help: "Four labels, in order — they cross-dissolve with the scene.",
    },
    { key: "showTree", type: "toggle", label: "Tree", default: true },
    { key: "showParticles", type: "toggle", label: "Drifting particles", default: true },
    { key: "showHorizon", type: "toggle", label: "Horizon line", default: true },
    { key: "background", type: "color", label: "Sky", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
