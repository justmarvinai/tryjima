import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  spring,
  makeOutBack,
  safeRect,
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

function wrapAndFit(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; size: number } {
  const family = fonts.family(role);
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight, size: sz });
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [""], size: size0 };
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || measure(next, size0) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  let packed = lines;
  if (packed.length > maxLines) {
    packed = [...packed.slice(0, maxLines - 1), packed.slice(maxLines - 1).join(" ")];
  }
  let size = size0;
  for (let guard = 0; guard < 8; guard++) {
    const widest = Math.max(...packed.map((l) => measure(l, size)));
    if (widest <= maxWidth || widest === 0) break;
    size = Math.max(14, Math.floor(size * (maxWidth / widest)));
  }
  return { lines: packed, size };
}

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
  return w > maxWidth ? Math.max(12, Math.floor((size * maxWidth) / w)) : size;
}

// treeColor + snow are palette-only decorative roles. greeting/name always render
// in textColor on background (each pairing is >= 4.5:1). Trunk is a fixed woody tone.
const PALETTES: Palette[] = [
  { id: "evergreen", name: "Evergreen", colors: { background: "#F3EEE1", textColor: "#22301F", accent: "#B23A2E", treeColor: "#2F6B43", snow: "#B9C9C0" } },
  { id: "frost", name: "Frost", colors: { background: "#EAF2F8", textColor: "#16304A", accent: "#B98A1E", treeColor: "#2E7D64", snow: "#8FB0CB" } },
  { id: "cranberry", name: "Cranberry", colors: { background: "#FBEDE9", textColor: "#48140F", accent: "#1F7A4D", treeColor: "#2F7D50", snow: "#CBA9A0" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101826", textColor: "#F1F5FA", accent: "#E4B23A", treeColor: "#3FA06A", snow: "#FFFFFF" } },
];

const TRUNK_COLOR = "#6B4A2B";

interface Flake {
  x0: number;
  r: number;
  speed: number;
  phase0: number;
  driftAmp: number;
  driftFreq: number;
  driftPhase: number;
  alpha: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F3EEE1"));
  const textColor = str(values.textColor, pc("textColor", "#22301F"));
  const accent = str(values.accent, pc("accent", "#B23A2E"));
  const treeColor = pc("treeColor", "#2F6B43");
  const snowColor = pc("snow", "#B9C9C0");

  const greeting = str(values.greeting, "Happy Holidays");
  const name = str(values.name, "from the Rivera family");
  const showSnow = on(values.showSnow);
  const showTree = on(values.showTree);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const maxW = zone.width * 0.9;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Snowfall (pure closed-form, seamless wrap) ---
  const flakeLayer = new Container();
  flakeLayer.alpha = 0;
  root.addChild(flakeLayer);
  const flakes: Flake[] = [];
  const margin = minDim * 0.06;
  const span = h + margin * 2;
  if (showSnow) {
    const N = 40;
    for (let i = 0; i < N; i++) {
      const r = minDim * rng.range(0.004, 0.013);
      const g = new Graphics().circle(0, 0, r).fill(snowColor);
      flakeLayer.addChild(g);
      flakes.push({
        x0: rng.range(0, w),
        r,
        speed: rng.range(0.06, 0.16),
        phase0: rng.next(),
        driftAmp: minDim * rng.range(0.01, 0.03),
        driftFreq: rng.range(0.5, 1.2),
        driftPhase: rng.range(0, Math.PI * 2),
        alpha: rng.range(0.5, 0.95),
      });
    }
  }
  const children = flakeLayer.children;
  const update = (t: number): void => {
    for (let i = 0; i < flakes.length; i++) {
      const f = flakes[i]!;
      const node = children[i];
      if (!node) continue;
      const prog = (f.phase0 + t * f.speed) % 1;
      const y = -margin + prog * span;
      const x = f.x0 + Math.sin(t * f.driftFreq + f.driftPhase) * f.driftAmp;
      node.position.set(x, y);
      node.alpha = f.alpha;
    }
  };
  if (showSnow) {
    timeline.to(flakeLayer, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.6, ease: outQuad });
  }

  // --- Metrics for centered stack: [tree] greeting name ---
  const S = minDim * 0.11;
  const treeBlockH = showTree ? S * 1.5 : 0;
  const greetFont0 = Math.round(minDim * 0.088);
  const { lines: greetLines, size: greetFont } = wrapAndFit(fonts, greeting, "display", 700, greetFont0, maxW, 2);
  const greetLH = Math.round(greetFont * 1.06);
  const greetH = greetLines.length * greetLH;
  const nameFont = fitSize(fonts, name, "body", 500, Math.round(minDim * 0.036), maxW);
  const gapM = minDim * 0.04;
  const gapS = minDim * 0.028;

  const totalH = treeBlockH + (showTree ? gapM : 0) + greetH + gapS + nameFont;
  let cursorY = zone.y + zone.height / 2 - totalH / 2;

  // --- Tree (decorative) ---
  if (showTree) {
    const tree = new Container();
    tree.position.set(cx, cursorY + S * 1.08);
    tree.scale.set(0);
    root.addChild(tree);
    const body = new Graphics();
    body.roundRect(-0.08 * S, 0.2 * S, 0.16 * S, 0.18 * S, 0.03 * S).fill(TRUNK_COLOR);
    body.poly([0, -0.34 * S, 0.52 * S, 0.22 * S, -0.52 * S, 0.22 * S]).fill(treeColor);
    body.poly([0, -0.7 * S, 0.4 * S, -0.16 * S, -0.4 * S, -0.16 * S]).fill(treeColor);
    body.poly([0, -1.0 * S, 0.28 * S, -0.54 * S, -0.28 * S, -0.54 * S]).fill(treeColor);
    tree.addChild(body);
    const star = new Graphics().star(0, -1.05 * S, 5, 0.15 * S, 0.065 * S).fill(accent);
    tree.addChild(star);
    timeline
      .to(tree, { prop: "scale.x", from: 0, to: 1, start: 0.2, duration: 0.7, ease: makeOutBack(1.7) })
      .to(tree, { prop: "scale.y", from: 0, to: 1, start: 0.2, duration: 0.7, ease: makeOutBack(1.7) });
    cursorY += treeBlockH + gapM;
  }

  // --- Greeting ---
  const greetCy = cursorY + greetH / 2;
  const greetText = makeText(fonts, {
    text: greetLines.join("\n"),
    role: "display",
    weight: 700,
    size: greetFont,
    color: textColor,
    anchor: 0.5,
    align: "center",
    lineHeight: greetLH,
  });
  greetText.position.set(cx, greetCy);
  greetText.alpha = 0;
  greetText.scale.set(0.7);
  root.addChild(greetText);
  timeline
    .to(greetText, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.4, ease: outQuad })
    .to(greetText, { prop: "scale.x", from: 0.7, to: 1, start: 0.5, duration: 0.7, ease: spring(0.5) })
    .to(greetText, { prop: "scale.y", from: 0.7, to: 1, start: 0.5, duration: 0.7, ease: spring(0.5) });
  cursorY += greetH + gapS;

  // --- Name / sign-off ---
  const nameY = cursorY + nameFont / 2;
  const nameText = makeText(fonts, { text: name, role: "body", weight: 500, size: nameFont, color: textColor, anchor: 0.5, letterSpacing: 0.5 });
  nameText.position.set(cx, nameY + 12);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 0.85, start: 0.85, duration: 0.5, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 12, to: nameY, start: 0.85, duration: 0.55, ease: outQuint });

  return { timeline, duration: 4.4, update };
}

export const holidayCard: TemplateDefinition = {
  id: "holiday-card",
  name: "Holiday Card",
  tagline: "A festive greeting settles under a little tree as snow drifts down.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { greeting: "display", name: "body" },
  palettes: PALETTES,
  fields: [
    { key: "greeting", type: "text", label: "Greeting", default: "Happy Holidays", maxLength: 30, shrinkToFit: true },
    { key: "name", type: "text", label: "Sign-off", default: "from the Rivera family", maxLength: 36, shrinkToFit: true },
    { key: "showSnow", type: "toggle", label: "Snowfall", default: true },
    { key: "showTree", type: "toggle", label: "Tree", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
