import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
function fitSize(fonts: FontRegistry, text: string, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family("display"), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

// A code editor window types faux source with syntax colors. The editor panel /
// chrome carry their own palette keys (dark or light) so they stay legible over
// the light page background; only the full-frame `background` rect follows the
// background field.
const PALETTES: Palette[] = [
  {
    id: "daylight",
    name: "Daylight",
    colors: {
      background: "#FFFFFF", panel: "#FBFBFD", chrome: "#EEF1F4", inkColor: "#101014", accent: "#2E7DF6",
      codeText: "#24292F", keyword: "#CF222E", strColor: "#0A7B34", fnColor: "#6639BA", numColor: "#9A4A00", comColor: "#6E7781",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    colors: {
      background: "#EEF0F7", panel: "#14161F", chrome: "#1E2130", inkColor: "#14161F", accent: "#FF4D1C",
      codeText: "#E6E8F0", keyword: "#FF7AB6", strColor: "#7EE787", fnColor: "#79C0FF", numColor: "#FFA657", comColor: "#8B93A7",
    },
  },
  {
    id: "grape",
    name: "Grape",
    colors: {
      background: "#F3EEFF", panel: "#1C1430", chrome: "#2A1E45", inkColor: "#241452", accent: "#7C5CFF",
      codeText: "#EDE7FF", keyword: "#FF8FD0", strColor: "#8FE3B0", fnColor: "#B7A6FF", numColor: "#FFB86C", comColor: "#9A8FC0",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    colors: {
      background: "#EAF4FF", panel: "#0E1B2A", chrome: "#15293D", inkColor: "#0B2447", accent: "#2E9BFF",
      codeText: "#DDEAF6", keyword: "#6FD3FF", strColor: "#7EE7C7", fnColor: "#9AB8FF", numColor: "#FFC978", comColor: "#6D8199",
    },
  },
];

type Cls = "kw" | "str" | "fn" | "num" | "com" | "plain";
interface Tok {
  text: string;
  cls: Cls;
}
const tk = (text: string, cls: Cls): Tok => ({ text, cls });

const CODE: Tok[][] = [
  [tk("// deterministic motion", "com")],
  [],
  [tk("import ", "kw"), tk("{ motion } ", "plain"), tk("from ", "kw"), tk('"jima"', "str")],
  [],
  [tk("const ", "kw"), tk("scene = ", "plain"), tk("build", "fn"), tk("(() => {", "plain")],
  [tk("  return ", "kw"), tk("fadeIn", "fn"), tk("(title, ", "plain"), tk("0.4", "num"), tk(")", "plain")],
  [tk("})", "plain")],
  [tk("export default ", "kw"), tk("scene", "plain")],
];

interface Cfg {
  winWF: number;
  winHF: number;
  cyF: number;
  capF: number;
}
const CFG: Record<Aspect, Cfg> = {
  "16:9": { winWF: 0.62, winHF: 0.72, cyF: 0.455, capF: 0.026 },
  "1:1": { winWF: 0.82, winHF: 0.66, cyF: 0.45, capF: 0.03 },
  "4:5": { winWF: 0.84, winHF: 0.6, cyF: 0.44, capF: 0.03 },
  "9:16": { winWF: 0.86, winHF: 0.52, cyF: 0.42, capF: 0.028 },
};

const TYPE_START = 0.62;
const TYPE_BUDGET = 2.1;
const HOLD = 1.3;
const DURATION = TYPE_START + TYPE_BUDGET + HOLD;

interface TokNode {
  node: Text;
  full: string;
  baseX: number;
  lineY: number;
  startIdx: number;
  len: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const panel = pc("panel", "#FBFBFD");
  const chrome = pc("chrome", "#EEF1F4");
  const inkColor = pc("inkColor", "#101014");
  const accent = str(values.accent, pc("accent", "#2E7DF6"));
  const codeText = str(values.textColor, pc("codeText", "#24292F"));
  const clsColor: Record<Cls, string> = {
    kw: str(values.accent, pc("keyword", "#CF222E")),
    str: pc("strColor", "#0A7B34"),
    fn: pc("fnColor", "#6639BA"),
    num: pc("numColor", "#9A4A00"),
    com: pc("comColor", "#6E7781"),
    plain: codeText,
  };

  const filename = str(values.filename, "scene.ts");
  const caption = str(values.caption, "Ship motion straight from the browser.");
  const showLines = values.showLineNumbers !== false;
  const showDots = values.showDots !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cfg = CFG[ctx.aspect];

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const monoFam = fonts.family("mono");

  const cx = w / 2;
  const cy = h * cfg.cyF;
  const winW = w * cfg.winWF;
  const winH = h * cfg.winHF;
  const bodyR = Math.min(winW, winH) * 0.04;
  const chromeH = Math.max(minDim * 0.05, winH * 0.13);
  const padW = winW * 0.04;

  // --- Fit the mono size to the window (height first, then width) ---
  const nLines = CODE.length;
  const topInset = -winH / 2 + chromeH + winH * 0.05;
  const botInset = winH / 2 - winH * 0.05;
  const availH = botInset - topInset;
  let mono = Math.min(Math.round(minDim * 0.03), Math.floor(availH / (nLines * 1.5)));
  const gutterW = showLines ? Math.ceil(mono * (String(nLines).length + 1.4)) : Math.round(mono * 0.4);
  const textLeft = -winW / 2 + padW + gutterW;
  const availTextW = winW / 2 - padW - textLeft;
  let maxLineW = 0;
  for (const line of CODE) {
    const full = line.map((t) => t.text).join("");
    if (full.length === 0) continue;
    maxLineW = Math.max(maxLineW, fonts.measure(full, { family: monoFam, weight: 500, size: mono }));
  }
  if (maxLineW > availTextW && maxLineW > 0) mono = Math.max(9, Math.floor(mono * (availTextW / maxLineW)));
  const gutterW2 = showLines ? Math.ceil(mono * (String(nLines).length + 1.4)) : Math.round(mono * 0.4);
  const textX = -winW / 2 + padW + gutterW2;
  const lineH = mono * 1.5;
  const firstY = topInset + lineH * 0.5;

  // --- Window group (pops in) ---
  const win = new Container();
  win.position.set(cx, cy);
  win.alpha = 0;
  win.scale.set(0.92);
  root.addChild(win);
  timeline
    .to(win, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.42, ease: outQuad })
    .to(win, { prop: "scale.x", from: 0.92, to: 1, start: 0, duration: 0.55, ease: makeOutBack(1.4) })
    .to(win, { prop: "scale.y", from: 0.92, to: 1, start: 0, duration: 0.55, ease: makeOutBack(1.4) });

  win.addChild(new Graphics().roundRect(-winW / 2, -winH / 2 + winH * 0.02, winW, winH, bodyR).fill({ color: "#000000", alpha: 0.2 }));
  win.addChild(new Graphics().roundRect(-winW / 2, -winH / 2, winW, winH, bodyR).fill(panel));
  win.addChild(new Graphics().roundRect(-winW / 2, -winH / 2, winW, chromeH, bodyR).fill(chrome));
  win.addChild(new Graphics().rect(-winW / 2, -winH / 2 + chromeH - 1, winW, 2).fill({ color: "#000000", alpha: 0.08 }));

  // Traffic-light dots + filename tab.
  const dotR = chromeH * 0.14;
  const dotY = -winH / 2 + chromeH * 0.5;
  const dotX0 = -winW / 2 + padW + dotR;
  if (showDots) {
    win.addChild(new Graphics().circle(dotX0, dotY, dotR).fill("#FF5F56"));
    win.addChild(new Graphics().circle(dotX0 + dotR * 2.7, dotY, dotR).fill("#FFBD2E"));
    win.addChild(new Graphics().circle(dotX0 + dotR * 5.4, dotY, dotR).fill("#27C93F"));
  }
  const tabSize = Math.round(chromeH * 0.32);
  const tabX0 = showDots ? dotX0 + dotR * 6.6 : -winW / 2 + padW;
  const tabW = Math.min(winW * 0.5, fonts.measure(filename, { family: monoFam, weight: 700, size: tabSize }) + tabSize * 2.4);
  win.addChild(new Graphics().roundRect(tabX0, -winH / 2 + chromeH * 0.22, tabW, chromeH * 0.56, chromeH * 0.16).fill(panel));
  const fnDot = new Graphics().circle(tabX0 + tabSize * 0.9, dotY, tabSize * 0.34).fill(accent);
  win.addChild(fnDot);
  const fnText = makeText(fonts, { text: filename, role: "mono", weight: 700, size: tabSize, color: codeText, anchor: { x: 0, y: 0.5 } });
  fnText.position.set(tabX0 + tabSize * 1.5, dotY);
  win.addChild(fnText);

  // --- Line numbers (static, appear with the window) ---
  if (showLines) {
    for (let i = 0; i < nLines; i++) {
      const ln = makeText(fonts, { text: String(i + 1), role: "mono", weight: 400, size: mono, color: clsColor.com, anchor: { x: 1, y: 0.5 } });
      ln.position.set(textX - mono * 0.7, firstY + i * lineH);
      ln.alpha = 0.7;
      win.addChild(ln);
    }
  }

  // --- Tokens (typed in) ---
  const toks: TokNode[] = [];
  let charIdx = 0;
  CODE.forEach((line, li) => {
    let bx = textX;
    const ly = firstY + li * lineH;
    for (const t of line) {
      const wFull = fonts.measure(t.text, { family: monoFam, weight: 500, size: mono });
      const node = makeText(fonts, { text: "", role: "mono", weight: 500, size: mono, color: clsColor[t.cls], anchor: { x: 0, y: 0.5 } });
      node.position.set(bx, ly);
      win.addChild(node);
      toks.push({ node, full: t.text, baseX: bx, lineY: ly, startIdx: charIdx, len: t.text.length });
      bx += wFull;
      charIdx += t.text.length;
    }
  });
  const totalChars = Math.max(1, charIdx);
  const perChar = TYPE_BUDGET / totalChars;

  // Blinking caret.
  const caret = new Graphics().roundRect(-mono * 0.05, -mono * 0.55, Math.max(2, mono * 0.1), mono * 1.05, mono * 0.05).fill(accent);
  caret.position.set(textX, firstY);
  win.addChild(caret);

  // --- Caption on the page background ---
  if (caption.length > 0) {
    const capSize = fitSize(fonts, caption, 600, Math.round(w * cfg.capF), w * 0.8);
    const capY = Math.min(h - (ctx.aspect === "9:16" ? 400 : minDim * 0.05) - capSize, cy + winH / 2 + minDim * 0.045);
    const capText = makeText(fonts, { text: caption, role: "body", weight: 600, size: capSize, color: inkColor, anchor: 0.5, align: "center" });
    capText.position.set(cx, capY);
    capText.alpha = 0;
    root.addChild(capText);
    timeline
      .to(capText, { prop: "alpha", from: 0, to: 0.92, start: TYPE_START + TYPE_BUDGET * 0.55, duration: 0.5, ease: outQuad })
      .to(capText, { prop: "y", from: capY + 14, to: capY, start: TYPE_START + TYPE_BUDGET * 0.55, duration: 0.55, ease: outExpo });
  }

  const update = (t: number): void => {
    const shown = t <= TYPE_START ? 0 : Math.min(totalChars, Math.floor((t - TYPE_START) / perChar));
    let caretX = textX;
    let caretY = firstY;
    for (const tn of toks) {
      const vis = Math.max(0, Math.min(tn.len, shown - tn.startIdx));
      tn.node.text = tn.full.slice(0, vis);
      if (tn.startIdx <= shown) {
        caretX = tn.baseX + fonts.measure(tn.full.slice(0, vis), { family: monoFam, weight: 500, size: mono });
        caretY = tn.lineY;
      }
    }
    caret.position.set(caretX, caretY);
    const typing = t >= TYPE_START && shown < totalChars;
    const blink = t % 0.9 < 0.5;
    caret.alpha = t < TYPE_START ? 0 : typing ? 1 : blink ? 0.9 : 0;
  };

  return { timeline, duration: DURATION, update };
}

export const codeEditor: TemplateDefinition = {
  id: "code-editor",
  name: "Code Editor",
  tagline: "A code editor window types faux source with live syntax colors.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { filename: "mono", caption: "body" },
  palettes: PALETTES,
  fields: [
    { key: "filename", type: "text", label: "Filename", default: "scene.ts", maxLength: 22, shrinkToFit: true },
    { key: "caption", type: "text", label: "Caption", default: "Ship motion straight from the browser.", maxLength: 52, optional: true, shrinkToFit: true },
    { key: "showLineNumbers", type: "toggle", label: "Line numbers", default: true },
    { key: "showDots", type: "toggle", label: "Traffic-light dots", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Code text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
