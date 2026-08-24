import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  spring,
  makeOutBack,
  safeRect,
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

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", nodeBg: "#F5F1EC", centerBg: "#101014", onCenter: "#FFFFFF" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", nodeBg: "#FFFFFF", centerBg: "#0B1F4D", onCenter: "#FFFFFF" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#17A34A", nodeBg: "#FFFFFF", centerBg: "#0B3B26", onCenter: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D", nodeBg: "#1D1D24", centerBg: "#D8F34D", onCenter: "#101014" } },
];

interface Node {
  name: string;
  role: string;
}

const DEFAULT_CHILDREN = ["Maya Lopez|Operations", "Sam Rivera|Engineering", "Ada Kern|Marketing"];

function parseNode(raw: string, fallbackName: string): Node {
  const idx = raw.indexOf("|");
  const name = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const role = (idx >= 0 ? raw.slice(idx + 1) : "").trim();
  return { name: name.length ? name : fallbackName, role };
}

function childrenOf(values: Values): Node[] {
  return asList(values.children, DEFAULT_CHILDREN).slice(0, 4).map((r, i) => parseNode(r, `Report ${i + 1}`));
}

const TOP_POP = 0.15;
const TRUNK_START = 0.5;
const BUS_START = 0.75;
const BRANCH_START = 0.95;
const BRANCH_EACH = 0.14;
const CHILD_DELAY = 0.3;
const CHILD_DUR = 0.5;
const HOLD = 0.95;

function computeDuration(values: Values): number {
  const n = Math.max(1, childrenOf(values).length);
  return BRANCH_START + (n - 1) * BRANCH_EACH + CHILD_DELAY + CHILD_DUR + HOLD;
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

  const top = parseNode(str(values.top, "Alex Kim|CEO"), "Lead");
  const children = childrenOf(values);
  const nc = children.length;
  const showLines = values.showLines !== false;
  const showRoles = values.showRoles !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const safe = safeRect(ctx.aspect);

  // --- Card metrics ---
  const gap = Math.max(minDim * 0.02, safe.width * 0.03);
  const childCardW = Math.min(minDim * 0.34, (safe.width - (nc - 1) * gap) / nc);
  const topCardW = Math.min(safe.width * 0.6, Math.max(childCardW * 1.15, minDim * 0.34));
  const nameFont = Math.round(minDim * 0.032);
  const roleFont = Math.round(minDim * 0.024);
  const cardPadY = minDim * 0.028;
  const roleGap = showRoles ? minDim * 0.012 : 0;
  const childCardH = nameFont * 1.15 + (showRoles ? roleGap + roleFont * 1.1 : 0) + cardPadY * 2;
  const topNameFont = Math.round(minDim * 0.036);
  const topCardH = topNameFont * 1.15 + (showRoles ? roleGap + roleFont * 1.1 : 0) + cardPadY * 2;
  const radius = Math.min(childCardH, topCardH) * 0.24;

  const gapV = minDim * 0.13;
  const totalH = topCardH + gapV + childCardH;
  const topCY = safe.y + Math.max(0, (safe.height - totalH) / 2) + topCardH / 2;
  const childCY = topCY + topCardH / 2 + gapV + childCardH / 2;
  const cxCanvas = w / 2;

  // --- Connector lines (draw first, under nodes) ---
  const lineC = Math.max(3, minDim * 0.006);
  const childXs = children.map((_, i) => safe.x + (safe.width - (nc - 1) * gap - childCardW) / 2 + i * (gap + childCardW) + childCardW / 2);
  if (showLines && nc > 0) {
    const busY = topCY + topCardH / 2 + gapV * 0.5;
    // Trunk (vertical from top card).
    const trunkH = busY - (topCY + topCardH / 2);
    const trunk = new Container();
    trunk.position.set(cxCanvas, topCY + topCardH / 2);
    trunk.scale.set(1, 0);
    trunk.addChild(new Graphics().roundRect(-lineC / 2, 0, lineC, trunkH, lineC / 2).fill(accent));
    root.addChild(trunk);
    timeline.to(trunk, { prop: "scale.y", from: 0, to: 1, start: TRUNK_START, duration: 0.4, ease: outExpo });

    // Horizontal bus across children.
    const leftX = Math.min(...childXs, cxCanvas);
    const rightX = Math.max(...childXs, cxCanvas);
    const busW = Math.max(lineC, rightX - leftX);
    const bus = new Container();
    bus.position.set((leftX + rightX) / 2, busY);
    bus.scale.set(0, 1);
    bus.addChild(new Graphics().roundRect(-busW / 2, -lineC / 2, busW, lineC, lineC / 2).fill(accent));
    root.addChild(bus);
    timeline.to(bus, { prop: "scale.x", from: 0, to: 1, start: BUS_START, duration: 0.45, ease: outExpo });

    // Branch drops to each child.
    childXs.forEach((bx, i) => {
      const dropH = childCY - childCardH / 2 - busY;
      const drop = new Container();
      drop.position.set(bx, busY);
      drop.scale.set(1, 0);
      drop.addChild(new Graphics().roundRect(-lineC / 2, 0, lineC, Math.max(lineC, dropH), lineC / 2).fill(accent));
      root.addChild(drop);
      timeline.to(drop, { prop: "scale.y", from: 0, to: 1, start: BRANCH_START + i * BRANCH_EACH, duration: 0.35, ease: outExpo });
    });
  }

  const addCard = (node: Node, cx: number, cy: number, cw: number, ch: number, strong: boolean, start: number, ease: (u: number) => number): void => {
    const card = new Container();
    card.position.set(cx, cy);
    card.scale.set(0);
    root.addChild(card);

    const shOff = Math.round(ch * 0.06);
    card.addChild(new Graphics().roundRect(-cw / 2, -ch / 2 + shOff, cw, ch, radius).fill({ color: "#000000", alpha: 0.12 }));
    card.addChild(new Graphics().roundRect(-cw / 2, -ch / 2, cw, ch, radius).fill(strong ? centerBg : nodeBg));
    if (!strong) {
      card.addChild(new Graphics().roundRect(-cw / 2, -ch / 2, cw, ch, radius).stroke({ color: accent, width: Math.max(2, minDim * 0.004), alpha: 0.55 }));
    }

    const nColor = strong ? onCenter : textColor;
    const nSize = fitSize(fonts, node.name, "display", 700, strong ? topNameFont : nameFont, cw * 0.86);
    const roleH = showRoles && node.role.length > 0 ? roleGap + roleFont * 1.1 : 0;
    const nameText = makeText(fonts, { text: node.name, role: "display", weight: 700, size: nSize, color: nColor, anchor: 0.5, align: "center" });
    nameText.position.set(0, roleH > 0 ? -roleH / 2 : 0);
    card.addChild(nameText);
    if (roleH > 0) {
      const rSize = fitSize(fonts, node.role, "body", 600, roleFont, cw * 0.86);
      const roleText = makeText(fonts, { text: node.role, role: "body", weight: 600, size: rSize, color: nColor, anchor: 0.5, align: "center" });
      roleText.alpha = strong ? 0.85 : 0.7;
      roleText.position.set(0, nSize * 0.62 + roleGap * 0.2);
      card.addChild(roleText);
    }

    timeline
      .to(card, { prop: "scale.x", from: 0, to: 1, start, duration: CHILD_DUR, ease })
      .to(card, { prop: "scale.y", from: 0, to: 1, start, duration: CHILD_DUR, ease });
  };

  addCard(top, cxCanvas, topCY, topCardW, topCardH, true, TOP_POP, spring(0.5));
  children.forEach((child, i) => {
    const bx = childXs[i] ?? cxCanvas;
    addCard(child, bx, childCY, childCardW, childCardH, false, BRANCH_START + i * BRANCH_EACH + CHILD_DELAY, makeOutBack(1.8));
  });

  return { timeline, duration: computeDuration(values) };
}

export const orgChart: TemplateDefinition = {
  id: "org-chart",
  name: "Org Chart",
  tagline: "A lead card branches down connector lines to its team as cards pop in.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  fontRoles: { top: "display", children: "display" },
  palettes: PALETTES,
  fields: [
    { key: "top", type: "text", label: "Top node (name | role)", default: "Alex Kim|CEO", maxLength: 28, shrinkToFit: true },
    {
      key: "children",
      type: "textlist",
      label: "Reports (name | role)",
      default: DEFAULT_CHILDREN,
      minItems: 2,
      maxItems: 4,
      maxLength: 26,
      help: 'One per line as "name | role".',
    },
    { key: "showLines", type: "toggle", label: "Connector lines", default: true },
    { key: "showRoles", type: "toggle", label: "Role labels", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
