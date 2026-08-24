import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  spring,
  makeOutBack,
  safeRect,
  safeCenter,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type Values,
  type TemplateDefinition,
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

// Node labels sit on light `nodeBg`; number badges + center reuse the verified
// centerBg/onCenter pair, so no text ever rides the user-editable accent.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", nodeBg: "#F5F1EC", centerBg: "#101014", onCenter: "#FFFFFF" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", nodeBg: "#FFFFFF", centerBg: "#0B1F4D", onCenter: "#FFFFFF" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#17A34A", nodeBg: "#FFFFFF", centerBg: "#0B3B26", onCenter: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D", nodeBg: "#1D1D24", centerBg: "#D8F34D", onCenter: "#101014" } },
];

const DEFAULT_STAGES = ["Plan", "Build", "Measure", "Learn"];

const CENTER_POP = 0.1;
const NODE_START = 0.45;
const NODE_EACH = 0.18;
const ARROW_START = 0.6;
const ARROW_STAGGER = 0.32;
const ARROW_DUR = 0.42;
const HOLD = 1.0;

function stagesOf(values: Values): string[] {
  return asList(values.stages, DEFAULT_STAGES).slice(0, 8);
}

function computeDuration(values: Values): number {
  const n = Math.max(1, stagesOf(values).length);
  const lastNode = NODE_START + (n - 1) * NODE_EACH + 0.5;
  const lastArrow = ARROW_START + (n - 1) * ARROW_STAGGER + ARROW_DUR;
  return Math.max(lastNode, lastArrow) + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const nodeBg = pc("nodeBg", "#F5F1EC");
  const centerBg = pc("centerBg", "#101014");
  const onCenter = pc("onCenter", "#FFFFFF");

  const center = str(values.center, "Growth loop");
  const stages = stagesOf(values);
  const n = stages.length;
  const showArrows = values.showArrows !== false;
  const showNumbers = values.showNumbers !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const safe = safeRect(ctx.aspect);
  const cc = safeCenter(ctx.aspect);
  const cx = cc.x;
  const cy = cc.y;

  const half = Math.min(safe.width, safe.height) / 2;
  const ringR = half * 0.6;
  const spacingCap = n > 1 ? ringR * Math.sin(Math.PI / n) * 0.82 : ringR * 0.62;
  const nodeR = Math.max(minDim * 0.055, Math.min(minDim * 0.12, ringR * 0.62, spacingCap));
  const centerR = Math.min(nodeR * 1.15, (ringR - nodeR) * 0.9);

  const angleOf = (i: number): number => -Math.PI / 2 + (i / n) * Math.PI * 2;

  // --- Arrows layer (below nodes), redrawn per frame ---
  const arrowsG = new Graphics();
  root.addChild(arrowsG);
  const arrowR = ringR;
  const gapAng = Math.min(Math.PI / n - 0.06, (nodeR * 1.12) / ringR);
  const arrowW = Math.max(3, minDim * 0.008);
  const headS = Math.max(minDim * 0.02, arrowW * 2.2);

  // --- Center node ---
  const centerNode = new Container();
  centerNode.position.set(cx, cy);
  centerNode.scale.set(0);
  root.addChild(centerNode);
  centerNode.addChild(new Graphics().circle(0, 0, centerR).fill({ color: "#000000", alpha: 0.12 }).circle(0, centerR * 0.06, centerR).fill(centerBg));
  const centerFont = fitSize(fonts, center, "display", 700, Math.round(centerR * 0.42), centerR * 1.55);
  centerNode.addChild(makeText(fonts, { text: center, role: "display", weight: 700, size: centerFont, color: onCenter, anchor: 0.5, align: "center" }));
  timeline
    .to(centerNode, { prop: "scale.x", from: 0, to: 1, start: CENTER_POP, duration: 0.55, ease: spring(0.5) })
    .to(centerNode, { prop: "scale.y", from: 0, to: 1, start: CENTER_POP, duration: 0.55, ease: spring(0.5) });

  // --- Stage nodes ---
  stages.forEach((label, i) => {
    const ang = angleOf(i);
    const nx = cx + Math.cos(ang) * ringR;
    const ny = cy + Math.sin(ang) * ringR;
    const start = NODE_START + i * NODE_EACH;

    const node = new Container();
    node.position.set(nx, ny);
    node.scale.set(0);
    root.addChild(node);

    node.addChild(new Graphics().circle(0, nodeR * 0.07, nodeR).fill({ color: "#000000", alpha: 0.12 }));
    node.addChild(new Graphics().circle(0, 0, nodeR).fill(nodeBg));
    node.addChild(new Graphics().circle(0, 0, nodeR).stroke({ color: accent, width: Math.max(2.5, nodeR * 0.06) }));

    const lblSize = fitSize(fonts, label, "display", 700, Math.round(nodeR * 0.36), nodeR * 1.5);
    const lbl = makeText(fonts, { text: label, role: "display", weight: 700, size: lblSize, color: textColor, anchor: 0.5, align: "center" });
    lbl.position.set(0, showNumbers ? nodeR * 0.14 : 0);
    node.addChild(lbl);

    if (showNumbers) {
      const badgeR = nodeR * 0.32;
      const badge = new Container();
      badge.position.set(0, -nodeR * 0.46);
      badge.addChild(new Graphics().circle(0, 0, badgeR).fill(centerBg));
      badge.addChild(makeText(fonts, { text: String(i + 1), role: "display", weight: 700, size: Math.round(badgeR * 1.0), color: onCenter, anchor: 0.5 }));
      node.addChild(badge);
    }

    timeline
      .to(node, { prop: "scale.x", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(1.8) })
      .to(node, { prop: "scale.y", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(1.8) });
  });

  const update = (t: number): void => {
    arrowsG.clear();
    if (!showArrows) return;
    for (let i = 0; i < n; i++) {
      const a0 = angleOf(i) + gapAng;
      const a1 = angleOf(i + 1) - gapAng; // angleOf(i+1) continues past 2π for the wrap
      const start = ARROW_START + i * ARROW_STAGGER;
      const p = clamp01((t - start) / ARROW_DUR);
      if (p <= 0.001 || a1 <= a0) continue;
      const aEnd = a0 + (a1 - a0) * p;
      arrowsG.arc(cx, cy, arrowR, a0, aEnd).stroke({ color: accent, width: arrowW, cap: "round" });
      // Arrowhead at the moving tip, pointing along the clockwise tangent.
      const tipX = cx + Math.cos(aEnd) * arrowR;
      const tipY = cy + Math.sin(aEnd) * arrowR;
      const td = aEnd + Math.PI / 2;
      const dx = Math.cos(td);
      const dy = Math.sin(td);
      const nxv = -dy;
      const nyv = dx;
      arrowsG
        .poly([
          tipX + dx * headS,
          tipY + dy * headS,
          tipX - dx * headS * 0.2 + nxv * headS * 0.7,
          tipY - dy * headS * 0.2 + nyv * headS * 0.7,
          tipX - dx * headS * 0.2 - nxv * headS * 0.7,
          tipY - dy * headS * 0.2 - nyv * headS * 0.7,
        ])
        .fill(accent);
    }
  };

  return { timeline, duration: computeDuration(values), update };
}

export const cycleDiagram: TemplateDefinition = {
  id: "cycle-diagram",
  name: "Cycle Diagram",
  tagline: "Stage nodes pop around a ring as curved arrows sweep the loop.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  estimateDuration: computeDuration,
  fontRoles: { center: "display", stages: "display" },
  palettes: PALETTES,
  fields: [
    { key: "center", type: "text", label: "Center label", default: "Growth loop", maxLength: 18, shrinkToFit: true },
    { key: "stages", type: "textlist", label: "Stages", default: DEFAULT_STAGES, minItems: 3, maxItems: 8, maxLength: 14 },
    { key: "showArrows", type: "toggle", label: "Flow arrows", default: true },
    { key: "showNumbers", type: "toggle", label: "Stage numbers", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
