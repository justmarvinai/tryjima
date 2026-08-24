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
  type Rng,
  type TemplateContext,
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

function fitSize(fonts: FontRegistry, text: string, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family("display"), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

// A CLI window: a $ prompt types commands, then faux output lines appear. The
// terminal panel/chrome carry their own palette keys so the (often dark) window
// stays legible over the light page background.
const PALETTES: Palette[] = [
  {
    id: "carbon",
    name: "Carbon",
    colors: {
      background: "#EEF0F6", panel: "#15171E", chrome: "#20232D", inkColor: "#15171E", accent: "#3DDC84",
      cmdColor: "#E7EAF2", okColor: "#3DDC84", mutedColor: "#8A93A6",
    },
  },
  {
    id: "paper",
    name: "Paper",
    colors: {
      background: "#FFFFFF", panel: "#F7F8FA", chrome: "#ECEEF2", inkColor: "#101014", accent: "#0A7B34",
      cmdColor: "#1F2430", okColor: "#0A7B34", mutedColor: "#6E7781",
    },
  },
  {
    id: "ember",
    name: "Ember",
    colors: {
      background: "#FFF4EE", panel: "#1E1310", chrome: "#2C1D18", inkColor: "#3A1500", accent: "#FF7A32",
      cmdColor: "#FBE7DC", okColor: "#FFB86C", mutedColor: "#B08D7E",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    colors: {
      background: "#EAF4FF", panel: "#0E1B2A", chrome: "#16293C", inkColor: "#0B2447", accent: "#41D0C0",
      cmdColor: "#DDEAF6", okColor: "#5FE0D0", mutedColor: "#6D8199",
    },
  },
];

const DEFAULT_CMDS = ["npm install", "npm run build", "npm test"];

interface OutLine {
  text: string;
  kind: "ok" | "muted";
}

function fauxOutput(cmd: string, rng: Rng): OutLine[] {
  const c = cmd.toLowerCase();
  if (c.includes("install") || c.includes(" add") || c.startsWith("add") || c.includes("yarn add"))
    return [
      { text: `added ${rng.int(120, 480)} packages in ${rng.int(2, 9)}s`, kind: "muted" },
      { text: "done — no vulnerabilities", kind: "ok" },
    ];
  if (c.includes("build") || c.includes("compile")) return [{ text: `compiled successfully in ${rng.int(700, 2400)}ms`, kind: "ok" }];
  if (c.includes("dev") || c.includes("start") || c.includes("serve"))
    return [{ text: `ready on http://localhost:${rng.int(3000, 5999)}`, kind: "ok" }];
  if (c.includes("test") || c.includes("vitest") || c.includes("jest")) return [{ text: `${rng.int(24, 180)} passed  (${rng.int(1, 6)}s)`, kind: "ok" }];
  if (c.includes("push") || c.includes("git")) return [{ text: `pushed to origin/main`, kind: "ok" }];
  if (c.includes("deploy") || c.includes("ship")) return [{ text: `deployed to production`, kind: "ok" }];
  return [{ text: "done", kind: "ok" }];
}

interface Cfg {
  winWF: number;
  winHF: number;
  cyF: number;
  capF: number;
}
const CFG: Record<Aspect, Cfg> = {
  "16:9": { winWF: 0.64, winHF: 0.72, cyF: 0.455, capF: 0.026 },
  "1:1": { winWF: 0.84, winHF: 0.66, cyF: 0.45, capF: 0.03 },
  "4:5": { winWF: 0.86, winHF: 0.6, cyF: 0.44, capF: 0.03 },
  "9:16": { winWF: 0.88, winHF: 0.52, cyF: 0.42, capF: 0.028 },
};

const PER_CHAR = 0.042;
const HOLD = 1.0;

interface CmdRec {
  cmdNode: Text;
  cmdStr: string;
  baseX: number;
  y: number;
  typeStart: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF0F6"));
  const panel = pc("panel", "#15171E");
  const chrome = pc("chrome", "#20232D");
  const inkColor = pc("inkColor", "#15171E");
  const accent = str(values.accent, pc("accent", "#3DDC84"));
  const cmdColor = str(values.textColor, pc("cmdColor", "#E7EAF2"));
  const okColor = pc("okColor", "#3DDC84");
  const mutedColor = pc("mutedColor", "#8A93A6");

  const promptPath = str(values.prompt, "~/project");
  const caption = str(values.caption, "Free. Client-side. No install.");
  const showDots = values.showDots !== false;

  const commands = asList(values.commands, DEFAULT_CMDS).slice(0, 3);

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
  const chromeH = Math.max(minDim * 0.045, winH * 0.12);
  const padW = winW * 0.045;

  // Build the row plan: each command → a prompt+command row and its output rows,
  // plus a trailing fresh prompt row with a blinking caret.
  const prompt = `${promptPath} $ `;
  interface Plan {
    kind: "cmd" | "out";
    text: string;
    color: string;
    cmdIndex?: number;
    fadeStart?: number;
  }
  const plan: Plan[] = [];
  const cmdMeta: { index: number; typeStart: number }[] = [];
  let tCur = 0.55;
  commands.forEach((cmd, i) => {
    const typeStart = tCur + 0.05;
    plan.push({ kind: "cmd", text: cmd, color: cmdColor, cmdIndex: i, fadeStart: tCur });
    cmdMeta.push({ index: i, typeStart });
    const typeEnd = typeStart + cmd.length * PER_CHAR;
    const outs = fauxOutput(cmd, rng);
    const outStart = typeEnd + 0.26;
    outs.forEach((o, k) => {
      plan.push({ kind: "out", text: o.text, color: o.kind === "ok" ? okColor : mutedColor, fadeStart: outStart + k * 0.14 });
    });
    tCur = outStart + outs.length * 0.14 + 0.3;
  });
  const finalPromptStart = tCur;
  plan.push({ kind: "out", text: prompt.trimEnd() + " ", color: accent, fadeStart: finalPromptStart });
  const duration = finalPromptStart + HOLD;

  // Fit the mono size so every full line (prompt + command / output) fits.
  const totalRows = plan.length;
  const topInset = -winH / 2 + chromeH + winH * 0.05;
  const botInset = winH / 2 - winH * 0.05;
  const availH = botInset - topInset;
  let mono = Math.min(Math.round(minDim * 0.028), Math.floor(availH / Math.max(1, totalRows * 1.55)));
  const leftX = -winW / 2 + padW;
  const availTextW = winW - padW * 2;
  let maxW = 0;
  for (const p of plan) {
    const full = p.kind === "cmd" ? prompt + p.text : p.text;
    maxW = Math.max(maxW, fonts.measure(full, { family: monoFam, weight: p.kind === "cmd" ? 700 : 400, size: mono }));
  }
  if (maxW > availTextW && maxW > 0) mono = Math.max(9, Math.floor(mono * (availTextW / maxW)));
  const lineH = mono * 1.55;
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

  const dotR = chromeH * 0.15;
  const dotY = -winH / 2 + chromeH * 0.5;
  const dotX0 = -winW / 2 + padW + dotR;
  if (showDots) {
    win.addChild(new Graphics().circle(dotX0, dotY, dotR).fill("#FF5F56"));
    win.addChild(new Graphics().circle(dotX0 + dotR * 2.7, dotY, dotR).fill("#FFBD2E"));
    win.addChild(new Graphics().circle(dotX0 + dotR * 5.4, dotY, dotR).fill("#27C93F"));
  }
  const titleSize = Math.round(chromeH * 0.32);
  const titleText = makeText(fonts, { text: `${promptPath} — bash`, role: "mono", weight: 500, size: titleSize, color: mutedColor, anchor: 0.5 });
  titleText.position.set(0, dotY);
  titleText.alpha = 0.85;
  win.addChild(titleText);

  // --- Rows ---
  const cmdRecs: CmdRec[] = [];
  plan.forEach((p, ri) => {
    const y = firstY + ri * lineH;
    if (p.kind === "cmd") {
      const promptNode = makeText(fonts, { text: prompt, role: "mono", weight: 700, size: mono, color: accent, anchor: { x: 0, y: 0.5 } });
      promptNode.position.set(leftX, y);
      promptNode.alpha = 0;
      win.addChild(promptNode);
      const promptW = fonts.measure(prompt, { family: monoFam, weight: 700, size: mono });
      const cmdNode = makeText(fonts, { text: "", role: "mono", weight: 700, size: mono, color: p.color, anchor: { x: 0, y: 0.5 } });
      cmdNode.position.set(leftX + promptW, y);
      win.addChild(cmdNode);
      timeline.to(promptNode, { prop: "alpha", from: 0, to: 1, start: p.fadeStart ?? 0, duration: 0.18, ease: outQuad });
      const meta = cmdMeta[p.cmdIndex ?? 0]!;
      cmdRecs.push({ cmdNode, cmdStr: p.text, baseX: leftX + promptW, y, typeStart: meta.typeStart });
    } else {
      const isFinalPrompt = ri === plan.length - 1;
      const node = makeText(fonts, { text: p.text, role: "mono", weight: isFinalPrompt ? 700 : 400, size: mono, color: p.color, anchor: { x: 0, y: 0.5 } });
      node.position.set(leftX, y);
      node.alpha = 0;
      win.addChild(node);
      timeline.to(node, { prop: "alpha", from: 0, to: isFinalPrompt ? 1 : 0.95, start: p.fadeStart ?? 0, duration: 0.28, ease: outQuad });
    }
  });

  // Blinking caret (follows the active command, then rests on the final prompt).
  const finalPromptW = fonts.measure(prompt.trimEnd() + " ", { family: monoFam, weight: 700, size: mono });
  const finalPromptY = firstY + (plan.length - 1) * lineH;
  const caret = new Graphics().roundRect(0, -mono * 0.55, Math.max(2, mono * 0.5), mono * 1.05, mono * 0.06).fill(accent);
  caret.alpha = 0;
  win.addChild(caret);

  const update = (t: number): void => {
    let caretX = leftX;
    let caretY = firstY;
    let caretOn = false;
    for (const c of cmdRecs) {
      const shown = t <= c.typeStart ? 0 : Math.min(c.cmdStr.length, Math.floor((t - c.typeStart) / PER_CHAR));
      c.cmdNode.text = c.cmdStr.slice(0, shown);
      const typing = t >= c.typeStart && shown < c.cmdStr.length;
      if (typing) {
        caretX = c.baseX + fonts.measure(c.cmdStr.slice(0, shown), { family: monoFam, weight: 700, size: mono });
        caretY = c.y;
        caretOn = true;
      }
    }
    if (!caretOn && t >= finalPromptStart) {
      caretX = leftX + finalPromptW;
      caretY = finalPromptY;
      caretOn = true;
    }
    caret.position.set(caretX, caretY);
    const blink = t % 0.9 < 0.5;
    caret.alpha = caretOn ? (t < finalPromptStart ? 1 : blink ? 0.95 : 0) : 0;
  };

  // --- Caption on the page background ---
  if (caption.length > 0) {
    const capSize = fitSize(fonts, caption, 600, Math.round(w * cfg.capF), w * 0.8);
    const capY = Math.min(h - (ctx.aspect === "9:16" ? 400 : minDim * 0.05) - capSize, cy + winH / 2 + minDim * 0.045);
    const capText = makeText(fonts, { text: caption, role: "body", weight: 600, size: capSize, color: inkColor, anchor: 0.5, align: "center" });
    capText.position.set(cx, capY);
    capText.alpha = 0;
    root.addChild(capText);
    timeline
      .to(capText, { prop: "alpha", from: 0, to: 0.92, start: finalPromptStart - 0.4, duration: 0.5, ease: outQuad })
      .to(capText, { prop: "y", from: capY + 14, to: capY, start: finalPromptStart - 0.4, duration: 0.55, ease: outExpo });
  }

  return { timeline, duration, update };
}

export const terminal: TemplateDefinition = {
  id: "terminal",
  name: "Terminal",
  tagline: "A CLI window types commands and prints their output line by line.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 4.3,
  fontRoles: { command: "mono", caption: "body" },
  palettes: PALETTES,
  fields: [
    { key: "prompt", type: "text", label: "Prompt path", default: "~/project", maxLength: 22, shrinkToFit: true },
    { key: "commands", type: "textlist", label: "Commands", default: DEFAULT_CMDS, minItems: 1, maxItems: 3, maxLength: 34 },
    { key: "caption", type: "text", label: "Caption", default: "Free. Client-side. No install.", maxLength: 48, optional: true, shrinkToFit: true },
    { key: "showDots", type: "toggle", label: "Traffic-light dots", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Command text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
