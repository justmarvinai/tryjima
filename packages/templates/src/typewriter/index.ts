import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);
const asLines = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string");
    if (arr.length) return arr;
  }
  return fallback;
};

const PALETTES: Palette[] = [
  { id: "paper-terminal", name: "Paper terminal", colors: { background: "#F4F5F7", card: "#FFFFFF", textColor: "#1B1F24", accent: "#FF4D1C" } },
  { id: "solarized", name: "Solarized light", colors: { background: "#FDF6E3", card: "#FBF1D6", textColor: "#586E75", accent: "#CB4B16" } },
  { id: "mint-console", name: "Mint console", colors: { background: "#ECFBF3", card: "#FFFFFF", textColor: "#14342A", accent: "#12A150" } },
  { id: "blueprint", name: "Blueprint", colors: { background: "#EAF1FB", card: "#FFFFFF", textColor: "#14294A", accent: "#2E5BD6" } },
];

const DEFAULT_LINES = ["npm install future", "> shipping v2.0 today"];
const INTRO = 0.4;
const HOLD = 1.4;
const GAP_UNITS = 4;

function typeSpeedSec(values: Values): number {
  return num(values.typeSpeed, 45) / 1000;
}
function totalUnits(lines: string[]): number {
  return lines.reduce((n, l) => n + l.length, 0) + Math.max(0, lines.length - 1) * GAP_UNITS;
}
function computeDuration(values: Values): number {
  const lines = asLines(values.lines, DEFAULT_LINES);
  const d = INTRO + totalUnits(lines) * typeSpeedSec(values) + HOLD;
  return Math.max(3, Math.min(10, d));
}

function fontFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.038 : aspect === "9:16" ? 0.052 : 0.046;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F5F7"));
  const card = pc("card", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#1B1F24"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const chrome = values.chrome !== false;
  const lines = asLines(values.lines, DEFAULT_LINES).slice(0, 3);
  const speed = typeSpeedSec(values);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const fontSize = Math.round(size.width * fontFrac(ctx.aspect));
  const lineH = Math.round(fontSize * 1.5);
  const charW = fonts.measure("M", { family: fonts.family("mono"), weight: 400, size: fontSize });
  const maxChars = Math.max(...lines.map((l) => l.length), 1);
  const padX = fontSize * 1.2;
  const titleH = chrome ? fontSize * 2.2 : fontSize * 0.6;
  const winW = Math.min(size.width * 0.86, maxChars * charW + padX * 2);
  const winH = titleH + lines.length * lineH + fontSize * 1.2;
  const winX = (size.width - winW) / 2;
  const winY = (size.height - winH) / 2;

  const timeline = new JimaTimeline();

  const window = new Container();
  window.position.set(size.width / 2, size.height / 2);
  window.pivot.set(size.width / 2, size.height / 2);
  root.addChild(window);
  window.scale.set(0.96);
  window.alpha = 0;
  timeline
    .to(window, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.3, ease: outQuad })
    .to(window, { prop: "scale.x", from: 0.96, to: 1, start: 0, duration: 0.35, ease: outQuad })
    .to(window, { prop: "scale.y", from: 0.96, to: 1, start: 0, duration: 0.35, ease: outQuad });

  if (chrome) {
    window.addChild(new Graphics().roundRect(winX, winY, winW, winH, fontSize * 0.6).fill({ color: card }).stroke({ color: 0x000000, alpha: 0.06, width: 1 }));
    const lightY = winY + titleH / 2;
    const colors = [0xff5f56, 0xffbd2e, 0x27c93f];
    colors.forEach((c, i) => {
      window.addChild(new Graphics().circle(winX + padX + i * fontSize * 1.1, lightY, fontSize * 0.32).fill(c));
    });
  }

  const textTop = winY + titleH + fontSize * 0.2;
  const lineTexts: Text[] = [];
  lines.forEach((_, i) => {
    const isPrompt = lines[i]!.startsWith(">");
    const t = makeText(fonts, { text: "", role: "mono", weight: isPrompt ? 700 : 400, size: fontSize, color: isPrompt ? accent : textColor, anchor: { x: 0, y: 0 } });
    t.position.set(winX + padX, textTop + i * lineH);
    window.addChild(t);
    lineTexts.push(t);
  });

  // Caret.
  const caret = new Graphics().rect(0, 0, Math.max(2, charW * 0.6), fontSize).fill(accent);
  caret.position.set(winX + padX, textTop);
  window.addChild(caret);

  const starts: number[] = [];
  let acc = 0;
  for (const l of lines) {
    starts.push(acc);
    acc += l.length + GAP_UNITS;
  }

  const update = (t: number) => {
    const elapsed = t - INTRO;
    const shown = elapsed <= 0 ? 0 : Math.floor(elapsed / speed);
    let caretLine = 0;
    let caretCol = 0;
    lines.forEach((line, i) => {
      const vis = Math.max(0, Math.min(line.length, shown - starts[i]!));
      lineTexts[i]!.text = line.slice(0, vis);
      if (vis > 0) {
        caretLine = i;
        caretCol = vis;
      }
    });
    caret.position.set(winX + padX + caretCol * charW, textTop + caretLine * lineH);
    caret.visible = elapsed > 0 && t % 1.06 < 0.53;
  };

  return { timeline, duration: computeDuration(values), update };
}

export const typewriter: TemplateDefinition = {
  id: "typewriter",
  name: "Typewriter",
  tagline: "Monospace type-on with a blinking caret.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.2,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "lines", type: "textlist", label: "Lines", default: DEFAULT_LINES, minItems: 1, maxItems: 3, maxLength: 48 },
    { key: "chrome", type: "toggle", label: "Terminal window", default: true },
    { key: "typeSpeed", type: "slider", label: "Type speed (ms/char)", default: 45, min: 20, max: 80, step: 1 },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
