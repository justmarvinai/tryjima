import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outExpo,
  spring,
  safeRect,
  safeCenter,
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

// The central node fills with a palette-only strong color (`centerBg`) + fixed
// `onCenter` text, so its label never rides the user-editable accent. Branch
// chips are light `chipBg` cards with textColor labels; connectors carry the
// accent (a line, no text). Every text pairing stays ≥ 4.5:1.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", chipBg: "#F5F1EC", centerBg: "#101014", onCenter: "#FFFFFF" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", chipBg: "#FFFFFF", centerBg: "#0B1F4D", onCenter: "#FFFFFF" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#17A34A", chipBg: "#FFFFFF", centerBg: "#0B3B26", onCenter: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D", chipBg: "#1D1D24", centerBg: "#D8F34D", onCenter: "#101014" } },
];

const DEFAULT_BRANCHES = ["Audience", "Format", "Hook", "Caption", "Hashtags", "Timing"];

const NODE_POP = 0.1;
const CONN_START = 0.55;
const CONN_STAGGER = 0.26;
const CONN_DUR = 0.4;
const CHIP_DELAY = 0.32;
const CHIP_DUR = 0.4;
const HOLD = 1.1;

function branchesOf(values: Values): string[] {
  return asList(values.branches, DEFAULT_BRANCHES).slice(0, 6);
}

function computeDuration(values: Values): number {
  const n = Math.max(1, branchesOf(values).length);
  return CONN_START + (n - 1) * CONN_STAGGER + CHIP_DELAY + CHIP_DUR + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const chipBg = pc("chipBg", "#F5F1EC");
  const centerBg = pc("centerBg", "#101014");
  const onCenter = pc("onCenter", "#FFFFFF");

  const center = str(values.center, "Big idea");
  const branches = branchesOf(values);
  const n = branches.length;
  const showConnectors = values.showConnectors !== false;
  const showRing = values.showRing !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);
  const cc = safeCenter(ctx.aspect);
  const cx = cc.x;
  const cy = cc.y;

  // --- Chip metrics ---
  const chipH = Math.round(minDim * 0.062);
  const chipPadX = chipH * 0.5;
  const chipFont0 = Math.round(chipH * 0.42);
  const maxChipW = zone.width * 0.28;
  const margin = minDim * 0.02;
  const gap = minDim * 0.03;

  // --- Radial radii, pinned to the outer safe edge; the node is capped so its
  // horizontal/vertical extent clears the nearest chips. ---
  const rx = Math.max(minDim * 0.12, zone.width / 2 - maxChipW / 2 - margin);
  const ry = Math.max(minDim * 0.12, zone.height / 2 - chipH / 2 - margin);

  // --- Central node ---
  const nodeWcap = Math.max(minDim * 0.22, Math.min(zone.width * 0.5, 2 * rx - maxChipW - gap * 2));
  const nodeFont = fitSize(fonts, center, "display", 700, Math.round(minDim * 0.05), nodeWcap - chipPadX * 2);
  const centerLabel = makeText(fonts, { text: center, role: "display", weight: 700, size: nodeFont, color: onCenter, anchor: 0.5, align: "center" });
  const nodeW = Math.min(nodeWcap, centerLabel.width + nodeFont * 1.4);
  const nodeH = nodeFont + minDim * 0.045;

  // Connectors live in their own layer BELOW the node, so the node masks their
  // inner ends and the central label never gets crossed by a line.
  const connLayer = new Container();
  root.addChild(connLayer);

  const node = new Container();
  node.position.set(cx, cy);
  node.scale.set(0);
  root.addChild(node);
  const nodeShadowOff = Math.round(nodeH * 0.08);
  node.addChild(new Graphics().roundRect(-nodeW / 2, -nodeH / 2 + nodeShadowOff, nodeW, nodeH, nodeH * 0.34).fill({ color: "#000000", alpha: 0.14 }));
  if (showRing) {
    const ringPad = Math.max(4, minDim * 0.011);
    node.addChild(
      new Graphics()
        .roundRect(-nodeW / 2 - ringPad, -nodeH / 2 - ringPad, nodeW + ringPad * 2, nodeH + ringPad * 2, nodeH * 0.34 + ringPad)
        .stroke({ color: accent, width: Math.max(3, minDim * 0.008) }),
    );
  }
  node.addChild(new Graphics().roundRect(-nodeW / 2, -nodeH / 2, nodeW, nodeH, nodeH * 0.34).fill(centerBg));
  node.addChild(centerLabel);
  timeline
    .to(node, { prop: "scale.x", from: 0, to: 1, start: NODE_POP, duration: 0.55, ease: spring(0.5) })
    .to(node, { prop: "scale.y", from: 0, to: 1, start: NODE_POP, duration: 0.55, ease: spring(0.5) });

  // --- Branches on an even radial spread (start at top) ---
  const connThick = Math.max(4, minDim * 0.009);
  branches.forEach((label, i) => {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const bx = cx + Math.cos(angle) * rx;
    const by = cy + Math.sin(angle) * ry;
    const connStart = CONN_START + i * CONN_STAGGER;

    // Connector line drawn from center outward (under node + chip).
    if (showConnectors) {
      const dist = Math.hypot(bx - cx, by - cy);
      const lineC = new Container();
      lineC.position.set(cx, cy);
      lineC.rotation = Math.atan2(by - cy, bx - cx);
      lineC.scale.set(0, 1);
      lineC.addChild(new Graphics().roundRect(0, -connThick / 2, dist, connThick, connThick / 2).fill(accent));
      connLayer.addChild(lineC);
      timeline.to(lineC, { prop: "scale.x", from: 0, to: 1, start: connStart, duration: CONN_DUR, ease: outExpo });
    }

    // Chip pops at the line end.
    const chipFont = fitSize(fonts, label, "body", 600, chipFont0, maxChipW - chipPadX * 2);
    const chipLabel = makeText(fonts, { text: label, role: "body", weight: 600, size: chipFont, color: textColor, anchor: 0.5 });
    const chipW = Math.min(maxChipW, chipLabel.width + chipPadX * 2);

    const chip = new Container();
    chip.position.set(bx, by);
    chip.scale.set(0);
    root.addChild(chip);
    const chipShadowOff = Math.round(chipH * 0.09);
    chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2 + chipShadowOff, chipW, chipH, chipH / 2).fill({ color: "#000000", alpha: 0.12 }));
    chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill(chipBg));
    chip.addChild(new Graphics().circle(-chipW / 2 + chipH * 0.34, 0, chipH * 0.13).fill(accent));
    chipLabel.position.set(chipH * 0.16, 0);
    chip.addChild(chipLabel);

    const chipStart = connStart + (showConnectors ? CHIP_DELAY : 0.08);
    timeline
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: chipStart, duration: CHIP_DUR, ease: makeOutBack(2) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: chipStart, duration: CHIP_DUR, ease: makeOutBack(2) });
  });

  return { timeline, duration: computeDuration(values) };
}

export const mindMap: TemplateDefinition = {
  id: "mind-map",
  name: "Mind Map",
  tagline: "A central idea spiders out to branch chips on connector lines.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  estimateDuration: computeDuration,
  fontRoles: { center: "display", branches: "body" },
  palettes: PALETTES,
  fields: [
    { key: "center", type: "text", label: "Central idea", default: "Big idea", maxLength: 22, shrinkToFit: true },
    { key: "branches", type: "textlist", label: "Branches", default: DEFAULT_BRANCHES, minItems: 4, maxItems: 6, maxLength: 18 },
    { key: "showConnectors", type: "toggle", label: "Connector lines", default: true },
    { key: "showRing", type: "toggle", label: "Accent ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
