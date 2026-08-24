import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
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
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

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
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}

// Above the waterline text is textColor-on-sky; below it, labels use each
// palette's dedicated deepText-on-water pair — both ≥ 4.5:1 at the end frame.
// The ice/ghost fills and accent dots are decorative (no text on them).
const PALETTES: Palette[] = [
  { id: "arctic", name: "Arctic", colors: { background: "#EAF6FF", textColor: "#0A2A44", water: "#0E3A5C", deepText: "#EAF6FF", ice: "#F8FCFF", ghost: "#9CC8E4", accent: "#2E7DF6" } },
  { id: "lagoon", name: "Lagoon", colors: { background: "#ECFDF4", textColor: "#0B3B26", water: "#0A4238", deepText: "#E7FBF3", ice: "#F2FFFA", ghost: "#8FD9C2", accent: "#17A34A" } },
  { id: "dusk", name: "Dusk", colors: { background: "#FFF1E6", textColor: "#3A1500", water: "#4A1D3F", deepText: "#FFE9DB", ice: "#FFF9F4", ghost: "#E0A9C4", accent: "#FF7A32" } },
  { id: "midnight", name: "Midnight", colors: { background: "#14141B", textColor: "#F2F4F8", water: "#0A2E52", deepText: "#E6F0FF", ice: "#DDEBFA", ghost: "#6E9CC7", accent: "#4FC3F7" } },
];

// Iceberg silhouette in unit space: x in [-0.5, 0.5], y = 0 on the waterline,
// a small tip above (−0.28 peak) and the big mass below (down to +0.95).
const UNIT_PTS: ReadonlyArray<readonly [number, number]> = [
  [-0.22, 0.0],
  [-0.13, -0.13],
  [-0.04, -0.09],
  [0.06, -0.28],
  [0.13, -0.1],
  [0.24, 0.0],
  [0.38, 0.18],
  [0.3, 0.42],
  [0.34, 0.6],
  [0.14, 0.85],
  [-0.06, 0.95],
  [-0.28, 0.72],
  [-0.22, 0.5],
  [-0.36, 0.3],
  [-0.3, 0.12],
];

const DEFAULT_DEEP = ["The practice", "The failures", "The hours"];

function deepOf(values: Values): string[] {
  return asList(values.deepLabels, DEFAULT_DEEP).slice(0, 3);
}

function waterlineFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.4;
    case "9:16":
      return 0.38;
    case "4:5":
      return 0.36;
    case "1:1":
      return 0.38;
  }
}

const TIP_START = 1.35;
const DEEP_START = 1.75;
const DEEP_EACH = 0.3;
const DEEP_FADE = 0.45;
const HOLD = 1.2;

function computeDuration(values: Values): number {
  return DEEP_START + (deepOf(values).length - 1) * DEEP_EACH + DEEP_FADE + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const sky = str(values.background, pc("background", "#EAF6FF"));
  const textColor = str(values.textColor, pc("textColor", "#0A2A44"));
  const water = str(values.water, pc("water", "#0E3A5C"));
  const deepText = pc("deepText", "#EAF6FF");
  const ice = pc("ice", "#F8FCFF");
  const ghost = pc("ghost", "#9CC8E4");
  const accent = str(values.accent, pc("accent", "#2E7DF6"));

  const title = str(values.title, "The Iceberg Model");
  const tipLabel = str(values.tipLabel, "What people see");
  const deepLabels = deepOf(values);
  const nDeep = deepLabels.length;
  const showWave = values.showWave !== false;
  const showConnectors = values.showConnectors !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(sky);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);
  const waterlineY = Math.round(h * waterlineFrac(ctx.aspect));

  // --- Title, centered in the sky ---
  const hasTitle = title.length > 0;
  let titleBottom = zone.y + minDim * 0.02;
  if (hasTitle) {
    const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.05), zone.width * 0.92);
    const titleY = zone.y + titleSize * 0.75;
    const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
    titleText.position.set(w / 2, titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.45, ease: outQuad })
      .to(titleText, { prop: "y", from: titleY - 14, to: titleY, start: 0.05, duration: 0.55, ease: outQuint });
    titleBottom = titleY + titleSize * 0.75;
  }

  // --- Water body (solid, below the waterline) ---
  const waterRect = new Graphics().rect(0, waterlineY, w, h - waterlineY).fill(water);
  waterRect.alpha = 0;
  root.addChild(waterRect);
  timeline.to(waterRect, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.45, ease: outQuad });

  // --- Iceberg: one silhouette, split by two fixed waterline masks so the tip
  // renders solid ice against the sky and the mass renders as a ghost tint on
  // the water. The whole berg rises into place, then bobs via pure update(t). ---
  const aboveAvail = Math.max(minDim * 0.1, waterlineY - (titleBottom + minDim * 0.02));
  const belowAvail = Math.max(minDim * 0.2, zone.y + zone.height - waterlineY);
  const S = Math.min(zone.width * 0.58, (aboveAvail * 0.85) / 0.28, (belowAvail * 0.88) / 0.95);
  const bergCx = zone.x + zone.width * 0.3;

  const pts: number[] = [];
  for (const [ux, uy] of UNIT_PTS) {
    pts.push((ux + rng.range(-0.012, 0.012)) * S, (uy + rng.range(-0.012, 0.012)) * S);
  }

  const bergOuter = new Container();
  bergOuter.position.set(bergCx, waterlineY);
  bergOuter.alpha = 0;
  root.addChild(bergOuter);
  const bob = new Container();
  bergOuter.addChild(bob);

  const edgeW = Math.max(2, minDim * 0.0035);
  const gBelow = new Graphics().poly(pts, true).fill({ color: ghost, alpha: 0.5 }).stroke({ color: ghost, width: edgeW, alpha: 0.55, join: "round" });
  const gAbove = new Graphics().poly(pts, true).fill(ice).stroke({ color: ghost, width: edgeW, alpha: 0.7, join: "round" });
  bob.addChild(gBelow, gAbove);

  const maskAbove = new Graphics().rect(0, 0, w, waterlineY).fill("#FFFFFF");
  const maskBelow = new Graphics().rect(0, waterlineY, w, h - waterlineY).fill("#FFFFFF");
  root.addChild(maskAbove, maskBelow);
  gAbove.mask = maskAbove;
  gBelow.mask = maskBelow;

  const riseFrom = waterlineY + minDim * 0.055;
  timeline
    .to(bergOuter, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.5, ease: outQuad })
    .to(bergOuter, { prop: "y", from: riseFrom, to: waterlineY, start: 0.3, duration: 0.9, ease: outQuint });

  // --- Waterline waves (decorative foam, drifting via update) ---
  const waveAmp = minDim * 0.006;
  const waveLen = minDim * 0.2;
  const drift = minDim * 0.02;
  const drawWave = (): Graphics => {
    const g = new Graphics();
    const pad = drift * 2 + waveLen;
    let first = true;
    for (let x = -pad; x <= w + pad; x += waveLen / 8) {
      const y = Math.sin((x / waveLen) * Math.PI * 2) * waveAmp;
      if (first) {
        g.moveTo(x, y);
        first = false;
      } else {
        g.lineTo(x, y);
      }
    }
    g.stroke({ color: ice, width: Math.max(2.5, minDim * 0.004), cap: "round", join: "round" });
    return g;
  };

  let wave1: Container | null = null;
  let wave2: Container | null = null;
  if (showWave) {
    wave1 = new Container();
    wave1.position.set(0, waterlineY);
    wave1.addChild(drawWave());
    wave1.alpha = 0;
    root.addChild(wave1);
    timeline.to(wave1, { prop: "alpha", from: 0, to: 0.9, start: 0.8, duration: 0.45, ease: outQuad });

    wave2 = new Container();
    wave2.position.set(0, waterlineY + minDim * 0.03);
    wave2.addChild(drawWave());
    wave2.alpha = 0;
    root.addChild(wave2);
    timeline.to(wave2, { prop: "alpha", from: 0, to: 0.3, start: 0.95, duration: 0.45, ease: outQuad });
  }

  // --- Label rail: one tip label above, 2–3 deep labels fading in below ---
  const labelX = zone.x + zone.width * 0.64;
  const labelMaxW = zone.x + zone.width - labelX;
  const labelFont = Math.round(minDim * 0.032);
  const railDotR = Math.max(4, minDim * 0.007);
  const connGap = minDim * 0.012;

  const addLabel = (
    text: string,
    y: number,
    color: string,
    endXFrac: number,
    start: number,
  ): void => {
    const row = new Container();
    row.position.set(0, y);
    row.alpha = 0;
    root.addChild(row);

    const lSize = fitSize(fonts, text, "body", 600, labelFont, labelMaxW);
    const lbl = makeText(fonts, { text, role: "body", weight: 600, size: lSize, color, anchor: { x: 0, y: 0.5 } });
    lbl.position.set(labelX, 0);
    row.addChild(lbl);

    if (showConnectors) {
      const dotX = labelX - minDim * 0.022;
      const endX = bergCx + S * endXFrac + connGap;
      row.addChild(new Graphics().circle(dotX, 0, railDotR).fill(accent));
      if (dotX - railDotR - 4 > endX) {
        row.addChild(
          new Graphics()
            .moveTo(endX, 0)
            .lineTo(dotX - railDotR - 4, 0)
            .stroke({ color, width: Math.max(1.5, minDim * 0.002), alpha: 0.4 }),
        );
      }
    }

    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start, duration: DEEP_FADE, ease: outQuad })
      .to(row, { prop: "y", from: y + 10, to: y, start, duration: DEEP_FADE + 0.1, ease: outQuint });
  };

  addLabel(tipLabel, waterlineY - S * 0.155, textColor, 0.2, TIP_START);

  // Connector endpoints sit just outside the silhouette's right edge at each
  // label depth (the edge tapers as the mass narrows toward the bottom).
  const deepFracs = nDeep === 2 ? [0.36, 0.66] : [0.3, 0.55, 0.78];
  const deepEndX = nDeep === 2 ? [0.38, 0.33] : [0.38, 0.38, 0.24];
  deepLabels.forEach((lbl, k) => {
    addLabel(
      lbl,
      waterlineY + S * (deepFracs[k] ?? 0.5),
      deepText,
      deepEndX[k] ?? 0.3,
      DEEP_START + k * DEEP_EACH,
    );
  });

  // --- Pure per-frame motion: gentle bob + wave drift ---
  const bobAmp = minDim * 0.008;
  const update = (t: number): void => {
    const ramp = clamp01((t - 1.2) / 0.9);
    bob.y = Math.sin((t - 1.2) * 1.4) * bobAmp * ramp;
    bob.rotation = Math.sin((t - 1.2) * 1.1 + 0.7) * 0.008 * ramp;
    if (wave1) wave1.x = Math.sin(t * 0.6) * drift;
    if (wave2) wave2.x = Math.sin(t * 0.6 + 2.1) * drift * 1.2;
  };

  return { timeline, duration: computeDuration(values), update };
}

export const icebergModel: TemplateDefinition = {
  id: "iceberg-model",
  name: "Iceberg Model",
  tagline: "A small visible tip, a bobbing hidden mass, and the labels that explain both.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.4,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", tipLabel: "body", deepLabels: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "The Iceberg Model", maxLength: 30, optional: true, shrinkToFit: true },
    { key: "tipLabel", type: "text", label: "Above the line", default: "What people see", maxLength: 24, shrinkToFit: true },
    {
      key: "deepLabels",
      type: "textlist",
      label: "Below the line",
      default: DEFAULT_DEEP,
      minItems: 2,
      maxItems: 3,
      maxLength: 24,
      help: "2–3 hidden-mass labels, one per line — deepest last.",
    },
    { key: "showWave", type: "toggle", label: "Waterline waves", default: true },
    { key: "showConnectors", type: "toggle", label: "Label connectors", default: true },
    { key: "background", type: "color", label: "Sky", default: "", optional: true },
    { key: "water", type: "color", label: "Water", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
