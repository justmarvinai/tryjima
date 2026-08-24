import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { dashedPath } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
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

// globeColor / landColor are palette-only roles (the sphere + continent fills).
const PALETTES: Palette[] = [
  { id: "atlas-sky", name: "Atlas sky", colors: { background: "#EAF2FB", textColor: "#0B2A44", accent: "#FF5A36", globeColor: "#FFFFFF", landColor: "#BFE0FA" } },
  { id: "night-orbit", name: "Night orbit", colors: { background: "#0B0E17", textColor: "#F2F4FA", accent: "#6FE7DC", globeColor: "#131A2A", landColor: "#223252" } },
  { id: "desert-atlas", name: "Desert atlas", colors: { background: "#FBF3E6", textColor: "#2E2010", accent: "#C2410C", globeColor: "#FFFFFF", landColor: "#F0D9B0" } },
  { id: "forest-globe", name: "Forest globe", colors: { background: "#EEF5EC", textColor: "#14261A", accent: "#E0B23A", globeColor: "#FFFFFF", landColor: "#BFE0C9" } },
];

interface AspectLayout {
  globeFrac: number;
  globeCyFrac: number;
  subYFrac: number;
}

function layout(aspect: Aspect): AspectLayout {
  switch (aspect) {
    case "16:9":
      return { globeFrac: 0.25, globeCyFrac: 0.4, subYFrac: 0.86 };
    case "1:1":
      return { globeFrac: 0.29, globeCyFrac: 0.4, subYFrac: 0.83 };
    case "4:5":
      return { globeFrac: 0.29, globeCyFrac: 0.37, subYFrac: 0.8 };
    case "9:16":
      return { globeFrac: 0.29, globeCyFrac: 0.34, subYFrac: 0.68 };
  }
}

/** A soft, organic landmass silhouette — a fixed radial wobble, deterministic. */
function blobPoints(r: number, freq: number, amp: number, phase: number, steps = 22): number[] {
  const pts: number[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rr = r * (1 + amp * Math.sin(freq * a + phase));
    pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return pts;
}

function bezierPt(p0: { x: number; y: number }, p1: { x: number; y: number }, ctrl: { x: number; y: number }, u: number): { x: number; y: number } {
  const mt = 1 - u;
  return {
    x: mt * mt * p0.x + 2 * mt * u * ctrl.x + u * u * p1.x,
    y: mt * mt * p0.y + 2 * mt * u * ctrl.y + u * u * p1.y,
  };
}

// Fixed, hand-placed "continents" — longitude (rad), latitude fraction of R,
// blob size fraction of R, and a wobble freq/amp/phase. Deterministic constants.
const CONTINENTS = [
  { lon: 0.3, latFrac: -0.28, blobR: 0.42, freq: 3, amp: 0.18, phase: 0.6 },
  { lon: 2.6, latFrac: 0.22, blobR: 0.36, freq: 4, amp: 0.16, phase: 2.1 },
  { lon: 4.4, latFrac: -0.05, blobR: 0.3, freq: 5, amp: 0.2, phase: 3.4 },
];
const MERIDIAN_COUNT = 6;
const LAT_FRACS = [-0.62, -0.3, 0, 0.3, 0.62];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EAF2FB"));
  const textColor = str(values.textColor, pc("textColor", "#0B2A44"));
  const accent = str(values.accent, pc("accent", "#FF5A36"));
  const globeColor = pc("globeColor", "#FFFFFF");
  const landColor = pc("landColor", "#BFE0FA");
  const showGrid = values.showGrid !== false;

  const destination = str(values.destination, "Tokyo");
  const subtitle = str(values.subtitle, "Where to next?");

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h); // 1080 for every aspect
  const L = layout(ctx.aspect);
  const globeR = minDim * L.globeFrac;
  const globeCy = h * L.globeCyFrac;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- The globe ---
  const globe = new Container();
  globe.position.set(cx, globeCy);
  globe.alpha = 0;
  root.addChild(globe);
  timeline.to(globe, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.35, ease: outQuad });

  globe.addChild(new Graphics().circle(0, 0, globeR).fill(globeColor));

  const globeMask = new Graphics().circle(0, 0, globeR).fill(0xffffff);
  globe.addChild(globeMask);

  const globeContent = new Container();
  globeContent.mask = globeMask;
  globe.addChild(globeContent);

  // Latitude rings — static; rotating around the vertical axis never changes
  // their projected shape, only the meridians and continents move.
  if (showGrid) {
    const latG = new Graphics();
    LAT_FRACS.forEach((f) => {
      const ly = f * globeR;
      const halfW = Math.sqrt(Math.max(1, globeR * globeR - ly * ly));
      const isEquator = f === 0;
      latG.ellipse(0, ly, halfW, halfW * 0.16).stroke({ color: textColor, width: Math.max(1, globeR * (isEquator ? 0.016 : 0.011)), alpha: isEquator ? 0.32 : 0.22 });
    });
    globeContent.addChild(latG);
  }

  // Meridians — full-radius circles whose horizontal scale (sin of their
  // longitude offset from the viewer) is recomputed each frame in update().
  const meridians: Graphics[] = [];
  const meridianPhases: number[] = [];
  if (showGrid) {
    for (let i = 0; i < MERIDIAN_COUNT; i++) {
      const phase = (i * Math.PI) / MERIDIAN_COUNT;
      const g = new Graphics().ellipse(0, 0, globeR, globeR).stroke({ color: textColor, width: Math.max(1, globeR * 0.012), alpha: 0.28 });
      g.scale.x = Math.sin(phase);
      globeContent.addChild(g);
      meridians.push(g);
      meridianPhases.push(phase);
    }
  }

  // Continents — always on (the globe's base "map"); each orbits + foreshortens
  // with the spin, dimming as it swings to the far side.
  const continents: { c: Container; lon: number; orbitR: number }[] = [];
  CONTINENTS.forEach((cfg) => {
    const latY = cfg.latFrac * globeR;
    const orbitR = Math.sqrt(Math.max(0, globeR * globeR - latY * latY)) * 0.82;
    const c = new Container();
    c.addChild(new Graphics().poly(blobPoints(globeR * cfg.blobR, cfg.freq, cfg.amp, cfg.phase)).fill(landColor));
    const s0 = Math.cos(cfg.lon);
    c.position.set(orbitR * Math.sin(cfg.lon), latY);
    c.scale.x = s0;
    c.alpha = 0.3 + 0.7 * ((s0 + 1) / 2);
    globeContent.addChild(c);
    continents.push({ c, lon: cfg.lon, orbitR });
  });

  // --- Spin then settle (pure function of t) ---
  const SPIN_START = 0;
  const SPIN_DUR = 1.6;
  const SPIN_TURNS = 2.4;

  const update = (t: number): void => {
    const u = clamp01((t - SPIN_START) / SPIN_DUR);
    const angle = SPIN_TURNS * Math.PI * 2 * outQuint(u);
    for (let i = 0; i < meridians.length; i++) {
      meridians[i]!.scale.x = Math.sin(meridianPhases[i]! + angle);
    }
    for (const cn of continents) {
      const rel = cn.lon + angle;
      const s = Math.cos(rel);
      cn.c.position.x = cn.orbitR * Math.sin(rel);
      cn.c.scale.x = s;
      cn.c.alpha = 0.3 + 0.7 * ((s + 1) / 2);
    }
  };

  // --- Destination pin drops onto the settled globe ---
  const PIN_START = SPIN_START + SPIN_DUR + 0.15;
  const pinLocalX = globeR * 0.3;
  const pinLocalY = -globeR * 0.32;
  const pinSize = globeR * 0.34;
  const pinDropFrom = pinLocalY - globeR * 1.3;

  const pinC = new Container();
  pinC.pivot.set(0, pinSize * 0.5);
  pinC.addChild(makeIcon("pin", pinSize, { color: accent, holeColor: globeColor }));
  pinC.position.set(pinLocalX, pinDropFrom);
  globe.addChild(pinC);
  timeline
    .to(pinC, { prop: "y", from: pinDropFrom, to: pinLocalY, start: PIN_START, duration: 0.55, ease: makeOutBack(2) })
    .to(pinC, { prop: "scale.y", from: 1, to: 0.8, start: PIN_START + 0.55, duration: 0.08, ease: outQuad })
    .to(pinC, { prop: "scale.y", from: 0.8, to: 1, start: PIN_START + 0.63, duration: 0.2, ease: outQuad })
    .to(pinC, { prop: "scale.x", from: 1, to: 1.18, start: PIN_START + 0.55, duration: 0.08, ease: outQuad })
    .to(pinC, { prop: "scale.x", from: 1.18, to: 1, start: PIN_START + 0.63, duration: 0.2, ease: outQuad });

  // Destination label, floating just above the pin.
  const labelWorldX = cx + pinLocalX;
  const labelWorldY = globeCy + pinLocalY - pinSize * 1.15;
  const labelSize = fitSize(fonts, destination, "display", 700, Math.round(minDim * 0.052), minDim * 0.4);
  const labelText = makeText(fonts, { text: destination, role: "display", weight: 700, size: labelSize, color: textColor, anchor: { x: 0.5, y: 1 }, align: "center" });
  labelText.position.set(labelWorldX, labelWorldY + 10);
  labelText.alpha = 0;
  root.addChild(labelText);
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 1, start: PIN_START + 0.4, duration: 0.45, ease: outQuad })
    .to(labelText, { prop: "y", from: labelWorldY + 10, to: labelWorldY, start: PIN_START + 0.4, duration: 0.5, ease: outQuint });

  // Small origin marker + a dashed arc suggesting an incoming route.
  const originWorld = { x: cx - globeR * 1.3, y: globeCy - globeR * 0.5 };
  const destWorld = { x: labelWorldX, y: globeCy + pinLocalY };

  const originDotR = minDim * 0.011;
  const originDot = new Container();
  originDot.addChild(new Graphics().circle(0, 0, originDotR).fill(accent));
  originDot.addChild(new Graphics().circle(0, 0, originDotR * 0.42).fill(bg));
  originDot.position.set(originWorld.x, originWorld.y);
  originDot.scale.set(0);
  root.addChild(originDot);
  timeline
    .to(originDot, { prop: "scale.x", from: 0, to: 1, start: PIN_START + 0.15, duration: 0.4, ease: makeOutBack(2.2) })
    .to(originDot, { prop: "scale.y", from: 0, to: 1, start: PIN_START + 0.15, duration: 0.4, ease: makeOutBack(2.2) });

  const dx = destWorld.x - originWorld.x;
  const dy = destWorld.y - originWorld.y;
  const dist = Math.hypot(dx, dy) || 1;
  let nx = -dy / dist;
  let ny = dx / dist;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const bulge = dist * 0.22;
  const ctrl = { x: (originWorld.x + destWorld.x) / 2 + nx * bulge, y: (originWorld.y + destWorld.y) / 2 + ny * bulge };
  const ARC_STEPS = 36;
  const arcFlat: number[] = [];
  for (let i = 0; i <= ARC_STEPS; i++) {
    const p = bezierPt(originWorld, destWorld, ctrl, i / ARC_STEPS);
    arcFlat.push(p.x, p.y);
  }
  const arcG = new Graphics();
  dashedPath(arcG, arcFlat, { dash: 10, gap: 8, width: Math.max(2, minDim * 0.005), color: accent, cap: "round" });
  arcG.alpha = 0;
  root.addChild(arcG);
  timeline.to(arcG, { prop: "alpha", from: 0, to: 0.85, start: PIN_START + 0.35, duration: 0.5, ease: outQuad });

  // --- Subtitle caption below the globe ---
  if (subtitle.length > 0) {
    const subSize = fitSize(fonts, subtitle, "body", 500, Math.round(minDim * 0.032), w * 0.8);
    const subY = h * L.subYFrac;
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center" });
    subText.position.set(cx, subY + 14);
    subText.alpha = 0;
    root.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.85, start: PIN_START + 0.55, duration: 0.5, ease: outQuad })
      .to(subText, { prop: "y", from: subY + 14, to: subY, start: PIN_START + 0.55, duration: 0.55, ease: outQuint });
  }

  return { timeline, duration: 4.2, update };
}

export const globeSpin: TemplateDefinition = {
  id: "globe-spin",
  name: "Globe Spin",
  tagline: "A wireframe globe spins to a stop as a destination pin drops in.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.1,
  fontRoles: { destination: "display" },
  palettes: PALETTES,
  fields: [
    { key: "destination", type: "text", label: "Destination", default: "Tokyo", maxLength: 24, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "Where to next?", maxLength: 40, optional: true },
    { key: "showGrid", type: "toggle", label: "Coordinate grid", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
