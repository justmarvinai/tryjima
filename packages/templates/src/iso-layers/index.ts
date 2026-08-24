import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  makeOutBack,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { dashedPath } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

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

// An exploded isometric diagram: three flat iso plates rise off a base and
// separate vertically along a dashed spine, each picking up a label — the
// classic "UI / Logic / Data" architecture slide, with a gentle float on hold.
const ISO = 0.55; // vertical squash that turns a rotated square into an iso diamond

const PALETTES: Palette[] = [
  {
    id: "circuit",
    name: "Circuit",
    colors: {
      background: "#EEF2F7", textColor: "#101728", accent: "#3B6EF5", layerTop: "#3B6EF5",
      layerMid: "#FFFFFF", layerLow: "#DCE4F0", muted: "#8A93A6", topInk: "#FFFFFF",
    },
  },
  {
    id: "mint",
    name: "Mint",
    colors: {
      background: "#E9F7EF", textColor: "#06301F", accent: "#12B76A", layerTop: "#12B76A",
      layerMid: "#FFFFFF", layerLow: "#D3EDDD", muted: "#7FA692", topInk: "#FFFFFF",
    },
  },
  {
    id: "violet",
    name: "Violet",
    colors: {
      background: "#F2EEFB", textColor: "#27154E", accent: "#7C5CFF", layerTop: "#7C5CFF",
      layerMid: "#FFFFFF", layerLow: "#E0D8F5", muted: "#9C8FC4", topInk: "#FFFFFF",
    },
  },
  {
    id: "carbon",
    name: "Carbon",
    colors: {
      background: "#0F1218", textColor: "#F2F4F8", accent: "#4FC3F7", layerTop: "#4FC3F7",
      layerMid: "#232936", layerLow: "#1B202B", muted: "#7C8698", topInk: "#0F1218",
    },
  },
];

const DEFAULT_LABELS = ["UI", "Logic", "Data"];

/** An iso plate: rotated+squashed rounded square with a thickness lip and surface details. */
function makePlate(ls: number, fill: string, detail: string, kind: "ui" | "logic" | "data"): Container {
  const plate = new Container();
  plate.scale.y = ISO;
  const r = ls * 0.09;
  const th = ls * 0.07; // thickness offset (pre-squash)

  const lip = new Container();
  lip.rotation = Math.PI / 4;
  lip.position.set(0, th);
  lip.addChild(new Graphics().roundRect(-ls / 2, -ls / 2, ls, ls, r).fill(fill));
  lip.addChild(new Graphics().roundRect(-ls / 2, -ls / 2, ls, ls, r).fill({ color: "#000000", alpha: 0.24 }));
  plate.addChild(lip);

  const top = new Container();
  top.rotation = Math.PI / 4;
  top.addChild(new Graphics().roundRect(-ls / 2, -ls / 2, ls, ls, r).fill(fill));
  top.addChild(new Graphics().roundRect(-ls / 2, -ls / 2, ls, ls, r).stroke({ color: "#000000", width: Math.max(1, ls * 0.004), alpha: 0.08 }));

  // Surface details, drawn in plate space so they inherit the iso skew.
  const g = new Graphics();
  const u = ls * 0.09;
  if (kind === "ui") {
    g.roundRect(-u * 3.4, -u * 3.4, u * 4.4, u * 1.1, u * 0.4).fill({ color: detail, alpha: 0.95 });
    g.roundRect(-u * 3.4, -u * 1.6, u * 3, u * 0.8, u * 0.3).fill({ color: detail, alpha: 0.6 });
    g.roundRect(-u * 3.4, -u * 0.2, u * 3.8, u * 0.8, u * 0.3).fill({ color: detail, alpha: 0.6 });
    g.roundRect(-u * 3.4, u * 1.6, u * 2.2, u * 1.2, u * 0.6).fill({ color: detail, alpha: 0.95 });
    g.circle(u * 2.6, u * 2.4, u * 0.75).fill({ color: detail, alpha: 0.85 });
  } else if (kind === "logic") {
    const p = u * 2.4;
    g.moveTo(-p, -p).lineTo(p, -p).lineTo(p, p).lineTo(-p, p).lineTo(-p, -p)
      .moveTo(-p, -p).lineTo(p, p).moveTo(p, -p).lineTo(-p, p)
      .stroke({ color: detail, width: Math.max(1.5, u * 0.22), alpha: 0.5 });
    for (const [nx, ny] of [[-p, -p], [p, -p], [p, p], [-p, p]] as const) {
      g.circle(nx, ny, u * 0.62).fill(detail);
    }
    g.circle(0, 0, u * 0.85).fill(detail);
  } else {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const cellA = row === 0 && col === 0 ? 0.95 : 0.55;
        g.roundRect(-u * 3.2 + col * u * 2.3, -u * 3.2 + row * u * 2.3, u * 1.7, u * 1.7, u * 0.35).fill({ color: detail, alpha: cellA });
      }
    }
  }
  top.addChild(g);
  plate.addChild(top);
  return plate;
}

interface Cfg {
  lsF: number; // plate size as a fraction of min(safe w, safe h)
  stackXF: number; // stack center x as a fraction of safe width
}
const CFG: Record<Aspect, Cfg> = {
  "16:9": { lsF: 0.4, stackXF: 0.44 },
  "1:1": { lsF: 0.42, stackXF: 0.42 },
  "4:5": { lsF: 0.44, stackXF: 0.42 },
  "9:16": { lsF: 0.42, stackXF: 0.4 },
};

const SEP_START = 0.85;
const LABEL_START = 1.7;
const TITLE_START = 2.35;
const FLOAT_START = 2.9;
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF2F7"));
  const textColor = str(values.textColor, pc("textColor", "#101728"));
  const accent = str(values.accent, pc("accent", "#3B6EF5"));
  const layerTop = str(values.accent, pc("layerTop", "#3B6EF5"));
  const layerMid = pc("layerMid", "#FFFFFF");
  const layerLow = pc("layerLow", "#DCE4F0");
  const muted = pc("muted", "#8A93A6");
  const topInk = pc("topInk", "#FFFFFF");

  const title = str(values.title, "Under the hood");
  const labels = asList(values.labels, DEFAULT_LABELS).slice(0, 3);
  while (labels.length < 3) labels.push(DEFAULT_LABELS[labels.length]!);
  const showConnector = on(values.showConnector);
  const showBase = on(values.showBase);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cfg = CFG[ctx.aspect];
  const safe = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Stack geometry ---
  const LS = Math.min(safe.width, safe.height) * cfg.lsF;
  const Hv = LS * Math.SQRT2 * ISO; // visual height of one plate
  const G = LS * 0.48; // vertical separation between plate centers
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.044), safe.width * 0.86);
  const titleGap = Hv * 0.32; // clears the ground shadow + drafting ring
  const stackH = 2 * G + Hv;
  const totalH = stackH + titleGap + titleSize;
  const stackX = safe.x + safe.width * cfg.stackXF;
  const baseY = safe.y + Math.max(0, (safe.height - totalH) / 2) + stackH - Hv / 2; // bottom plate center
  const titleY = baseY + Hv / 2 + titleGap + titleSize * 0.55;

  // --- Base: soft ground shadow + a drafting ring (decorative) ---
  if (showBase) {
    const ground = new Container();
    ground.position.set(stackX, baseY);
    ground.alpha = 0;
    root.addChild(ground);
    const shadow = new Graphics().ellipse(0, Hv * 0.52, LS * 0.66, Hv * 0.12).fill({ color: "#000000", alpha: 0.11 });
    ground.addChild(shadow);
    const ringWrap = new Container();
    ringWrap.scale.y = ISO;
    ringWrap.position.set(0, Hv * 0.12);
    const rr = (LS * 1.24) / 2;
    const ringPts: number[] = [0, -rr, rr, 0, 0, rr, -rr, 0, 0, -rr];
    const ring = new Graphics();
    dashedPath(ring, ringPts, { dash: LS * 0.05, gap: LS * 0.035, width: Math.max(1.5, LS * 0.006), color: muted, cap: "round" });
    ring.alpha = 0.55;
    ringWrap.addChild(ring);
    ground.addChild(ringWrap);
    timeline.to(ground, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.45, ease: outQuad });
  }

  // --- Plates (bottom → top) + labels; each pair floats together on hold ---
  const kinds = ["data", "logic", "ui"] as const;
  const fills = [layerLow, layerMid, layerTop];
  const details = [muted, accent, topInk];
  const wrappers: Container[] = [];
  const finalYs: number[] = [];
  const labelSize = Math.round(minDim * 0.03);

  for (let i = 0; i < 3; i++) {
    const finalY = baseY - i * G;
    const collapsedY = baseY - i * LS * 0.09;
    const wrap = new Container();
    wrap.position.set(stackX, collapsedY);
    wrap.alpha = 0;
    root.addChild(wrap);
    wrappers.push(wrap);
    finalYs.push(finalY);

    const plate = makePlate(LS, fills[i]!, details[i]!, kinds[i]!);
    const pop = new Container();
    pop.scale.set(0.88);
    pop.addChild(plate);
    wrap.addChild(pop);

    const inAt = 0.12 + i * 0.12;
    timeline
      .to(wrap, { prop: "alpha", from: 0, to: 1, start: inAt, duration: 0.35, ease: outQuad })
      .to(pop, { prop: "scale.x", from: 0.88, to: 1, start: inAt, duration: 0.5, ease: makeOutBack(1.5) })
      .to(pop, { prop: "scale.y", from: 0.88, to: 1, start: inAt, duration: 0.5, ease: makeOutBack(1.5) });
    if (i > 0) {
      timeline.to(wrap, { prop: "y", from: collapsedY, to: finalY, start: SEP_START + (i - 1) * 0.15, duration: 0.8, ease: outQuint });
    }

    // Corner connector lines: dashed risers at the side vertices, growing up
    // toward the next plate as it lifts away (classic exploded-diagram look).
    // Parented to the LOWER plate of each gap so they ride its float on hold.
    if (showConnector && i < 2) {
      const vx = LS * Math.SQRT2 * 0.485; // just inside the side vertex
      const riseAt = SEP_START + i * 0.15;
      for (const sideX of [-vx, vx]) {
        const line = new Container();
        line.position.set(sideX, -Hv * 0.02);
        line.scale.y = 0;
        const lg = new Graphics();
        dashedPath(lg, [0, 0, 0, -G], { dash: minDim * 0.011, gap: minDim * 0.008, width: Math.max(2, minDim * 0.003), color: accent, cap: "round" });
        line.addChild(lg);
        wrap.addChildAt(line, 0); // behind the plate art
        timeline.to(line, { prop: "scale.y", from: 0, to: 1, start: riseAt, duration: 0.8, ease: outQuint });
      }
    }

    // Label: leader tick from the plate's right vertex + the label text.
    // (labels[] is authored top-first; plate i counts from the bottom.)
    const labelText = labels[2 - i]!;
    const vertexX = LS * Math.SQRT2 * 0.5;
    const leadW = minDim * 0.035;
    const leader = new Container();
    leader.position.set(vertexX + minDim * 0.008, 0);
    leader.scale.x = 0;
    leader.addChild(new Graphics().rect(0, -Math.max(1, minDim * 0.0018), leadW, Math.max(2, minDim * 0.0036)).fill(muted));
    wrap.addChild(leader);
    const maxLabelW = safe.x + safe.width - (stackX + vertexX + leadW + minDim * 0.05);
    const lSize = fitSize(fonts, labelText, "body", 600, labelSize, maxLabelW);
    const lNode = makeText(fonts, { text: labelText, role: "body", weight: 600, size: lSize, color: textColor, anchor: { x: 0, y: 0.5 }, letterSpacing: 1 });
    lNode.position.set(vertexX + minDim * 0.008 + leadW + minDim * 0.014, 0);
    lNode.alpha = 0;
    wrap.addChild(lNode);
    const labAt = LABEL_START + (2 - i) * 0.15;
    timeline
      .to(leader, { prop: "scale.x", from: 0, to: 1, start: labAt, duration: 0.4, ease: outExpo })
      .to(lNode, { prop: "alpha", from: 0, to: 1, start: labAt + 0.1, duration: 0.35, ease: outQuad })
      .to(lNode, { prop: "x", from: lNode.x + 12, to: lNode.x, start: labAt + 0.1, duration: 0.45, ease: outQuint });
  }

  // --- Title ---
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(w / 2, titleY + 14);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: TITLE_START, duration: 0.45, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + 14, to: titleY, start: TITLE_START, duration: 0.55, ease: outQuint });

  // --- Gentle float on hold (pure f(t); ramps in so there is no jump) ---
  const amp = LS * 0.012;
  const update = (t: number): void => {
    if (t < FLOAT_START) return;
    const env = clamp01((t - FLOAT_START) / 0.6);
    const ease = env * env * (3 - 2 * env); // smoothstep ramp
    for (let i = 0; i < wrappers.length; i++) {
      const phase = Math.PI * 2 * 0.45 * (t - FLOAT_START) + i * 1.3;
      wrappers[i]!.y = finalYs[i]! + ease * amp * Math.sin(phase);
    }
  };

  return { timeline, duration: DURATION, update };
}

export const isoLayers: TemplateDefinition = {
  id: "iso-layers",
  name: "Iso Layers",
  tagline: "Isometric plates rise apart into a labeled, floating stack.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { title: "display", labels: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Under the hood", maxLength: 30, shrinkToFit: true },
    { key: "labels", type: "textlist", label: "Layer labels", default: DEFAULT_LABELS, minItems: 3, maxItems: 3, maxLength: 14, help: "Top layer first." },
    { key: "showConnector", type: "toggle", label: "Connector spine", default: true },
    { key: "showBase", type: "toggle", label: "Ground base", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
