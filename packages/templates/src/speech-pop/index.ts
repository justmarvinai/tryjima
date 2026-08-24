import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
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

const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#EEF0F3", bubble: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0E0E12", bubble: "#1C1C22", textColor: "#FFFFFF", accent: "#FF6A3D" } },
  { id: "mint", name: "Mint", colors: { background: "#E9F7F0", bubble: "#FFFFFF", textColor: "#08221A", accent: "#17A34A" } },
  { id: "grape-night", name: "Grape night", colors: { background: "#1B1030", bubble: "#2A1C4A", textColor: "#FFFFFF", accent: "#B98CFF" } },
];

/** Greedy word-wrap to ≤ maxLines lines, shrinking the size until the widest line fits. */
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
    size = Math.max(12, Math.floor(size * (maxWidth / widest)));
  }
  return { lines: packed, size };
}

function bubbleMaxFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.52 : aspect === "9:16" ? 0.8 : aspect === "4:5" ? 0.74 : 0.7;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#EEF0F3"));
  const textColor = str(values.textColor, pcol("textColor", "#101014"));
  const accent = str(values.accent, pcol("accent", "#FF4D1C"));
  const bubbleColor = pcol("bubble", "#FFFFFF");
  const text = str(values.text, "Wait... did that just happen?!");
  const showTail = values.showTail !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;

  const zone = safeZone(ctx.aspect);
  const safeH = h - zone.top - zone.bottom;
  const cy = zone.top + safeH * 0.44;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const bubbleMaxW = w * bubbleMaxFrac(ctx.aspect);
  const fontSize0 = Math.round(minDim * 0.06);
  const padX = Math.round(fontSize0 * 0.95);
  const padY = Math.round(fontSize0 * 0.85);
  const innerMaxW = bubbleMaxW - padX * 2;

  const { lines, size: textSize } = wrapAndFit(fonts, text, "display", 700, fontSize0, innerMaxW, 2);
  const lineH = Math.round(textSize * 1.26);
  const widest = Math.max(...lines.map((l) => fonts.measure(l, { family: fonts.family("display"), weight: 700, size: textSize })));
  const bubbleW = Math.min(bubbleMaxW, widest + padX * 2);
  const bubbleH = padY * 2 + lines.length * lineH;
  const cornerR = Math.min(bubbleH * 0.4, minDim * 0.045);

  const bubbleC = new Container();
  bubbleC.position.set(cx, cy);
  bubbleC.scale.set(0);
  bubbleC.label = "bubble";
  root.addChild(bubbleC);

  if (showTail) {
    const tailW = bubbleW * 0.15;
    const tailH = bubbleH * 0.3;
    const tailX = -bubbleW * 0.22;
    const tail = new Graphics()
      .poly([tailX - tailW / 2, bubbleH / 2 - bubbleH * 0.02, tailX + tailW / 2, bubbleH / 2 - bubbleH * 0.02, tailX - tailW * 0.1, bubbleH / 2 + tailH])
      .fill(accent);
    tail.label = "tail";
    bubbleC.addChild(tail);
  }

  bubbleC.addChild(new Graphics().roundRect(-bubbleW / 2, -bubbleH / 2, bubbleW, bubbleH, cornerR).fill(bubbleColor));

  const blockTop = -bubbleH / 2 + padY;
  lines.forEach((line, i) => {
    const restY = blockTop + i * lineH + lineH / 2;
    const t = makeText(fonts, { text: line, role: "display", weight: 700, size: textSize, color: textColor, anchor: 0.5, align: "center" });
    t.position.set(0, restY + 10);
    t.alpha = 0;
    bubbleC.addChild(t);
    const start = 0.68 + i * 0.12;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
      .to(t, { prop: "y", from: restY + 10, to: restY, start, duration: 0.45, ease: outQuint });
  });

  timeline
    .to(bubbleC, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.55, ease: spring(0.42) })
    .to(bubbleC, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.55, ease: spring(0.42) });

  return { timeline, duration: 4.0 };
}

export const speechPop: TemplateDefinition = {
  id: "speech-pop",
  name: "Speech Pop",
  tagline: "A speech bubble pops in and the reaction reveals inside.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.2,
  fontRoles: { text: "display" },
  palettes: PALETTES,
  fields: [
    { key: "text", type: "textarea", label: "Text", default: "Wait... did that just happen?!", maxLength: 90, maxLines: 2 },
    { key: "showTail", type: "toggle", label: "Bubble tail", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
