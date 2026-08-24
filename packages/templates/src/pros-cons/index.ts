import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const DEG = Math.PI / 180;
const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (a.length) return a;
  }
  return fb;
};

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

/** Create text; if it would overflow `maxWidth`, re-make one size smaller (crisp). */
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number): Text {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#151016", goodColor: "#17A34A", badColor: "#E1483D", onGood: "#FFFFFF", onBad: "#FFFFFF" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", goodColor: "#17A34A", badColor: "#E1483D", onGood: "#FFFFFF", onBad: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FAF5EA", goodColor: "#3DDC84", badColor: "#FF5C5C", onGood: "#101014", onBad: "#101014" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", goodColor: "#17A34A", badColor: "#E1483D", onGood: "#FFFFFF", onBad: "#FFFFFF" } },
];

const DEFAULT_PROS = ["Quick to set up", "No fees to start", "Works on any device"];
const DEFAULT_CONS = ["Takes practice at first", "Fewer options than a full app"];

function resolvePros(values: Values): string[] {
  const raw = asList(values.pros, DEFAULT_PROS).slice(0, 4);
  return raw.length >= 2 ? raw : DEFAULT_PROS;
}
function resolveCons(values: Values): string[] {
  const raw = asList(values.cons, DEFAULT_CONS).slice(0, 4);
  return raw.length >= 2 ? raw : DEFAULT_CONS;
}

const ROWSTART = 0.75;
const ROW_EACH = 0.32;
const CONS_OFFSET = 0.1;
const ROW_DUR = 0.5;
const HOLD = 1.0;

function computeDuration(values: Values): number {
  const rows = Math.max(resolvePros(values).length, resolveCons(values).length);
  return ROWSTART + (rows - 1) * ROW_EACH + CONS_OFFSET + ROW_DUR + HOLD;
}

const CFG: Record<Aspect, { titleY: number; headerY: number; rowsTop: number; rowsBot: number }> = {
  "16:9": { titleY: 0.12, headerY: 0.26, rowsTop: 0.36, rowsBot: 0.9 },
  "1:1": { titleY: 0.1, headerY: 0.22, rowsTop: 0.31, rowsBot: 0.92 },
  "4:5": { titleY: 0.09, headerY: 0.19, rowsTop: 0.27, rowsBot: 0.93 },
  "9:16": { titleY: 0.145, headerY: 0.21, rowsTop: 0.28, rowsBot: 0.78 },
};

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const aspect = ctx.aspect;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#151016"));
  const goodColor = str(values.goodColor, pc("goodColor", "#17A34A"));
  const badColor = str(values.badColor, pc("badColor", "#E1483D"));
  const onGood = pc("onGood", "#FFFFFF");
  const onBad = pc("onBad", "#FFFFFF");
  const titleRaw = str(values.title, "Pros & Cons");
  const prosLabel = str(values.prosLabel, "Pros");
  const consLabel = str(values.consLabel, "Cons");
  const showDivider = values.showDivider !== false;
  const showRowBg = values.rowBg !== false;

  const pros = resolvePros(values);
  const cons = resolveCons(values);
  const rows = Math.max(pros.length, cons.length);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  const cfg = CFG[aspect];
  const marginX = w * 0.08;
  const totalInner = w - marginX * 2;
  const gap = totalInner * 0.08;
  const colW = (totalInner - gap) / 2;
  const leftColCX = marginX + colW / 2;
  const rightColCX = marginX + colW + gap + colW / 2;

  const titleY = h * cfg.titleY;
  const headerY = h * cfg.headerY;
  const rowsTop = h * cfg.rowsTop;
  const rowsBot = h * cfg.rowsBot;
  const rowH = (rowsBot - rowsTop) / rows;
  const rowCY = (i: number): number => rowsTop + (i + 0.5) * rowH;
  const Rchk = Math.min(rowH * 0.3, colW * 0.16, minDim * 0.05);

  // --- Title ---
  const titleSize = fitSize(fonts, titleRaw, "display", 700, Math.round(minDim * 0.056), totalInner);
  const titleText = makeText(fonts, { text: titleRaw, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(w / 2, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 16, to: titleY, start: 0, duration: 0.55, ease: outExpo });

  // --- Column divider ---
  if (showDivider) {
    const divTh = Math.max(2, minDim * 0.004);
    const divTop = headerY + titleSize * 0.5;
    const div = new Graphics().roundRect(-divTh / 2, divTop, divTh, rowsBot - divTop, divTh / 2).fill({ color: textColor, alpha: 0.12 });
    div.position.set(w / 2, 0);
    div.alpha = 0;
    root.addChild(div);
    timeline.to(div, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.5, ease: outQuad });
  }

  // --- Column headers ---
  const headFont = Math.round(minDim * 0.042);
  const mkHeader = (text: string, cx: number, delay: number): void => {
    const t = fitText(fonts, { text, role: "display", weight: 700, size: headFont, color: textColor, anchor: 0.5, align: "center" }, colW * 0.9);
    t.position.set(cx, headerY);
    t.alpha = 0;
    root.addChild(t);
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start: delay, duration: 0.4, ease: outQuad })
      .to(t, { prop: "y", from: headerY - 14, to: headerY, start: delay, duration: 0.5, ease: outExpo });
  };
  mkHeader(prosLabel, leftColCX, 0.4);
  mkHeader(consLabel, rightColCX, 0.5);

  const rowFont = Math.max(10, Math.round(minDim * 0.032));
  const slideDist = minDim * 0.12;

  // --- Pros rows: slide in from the left ---
  pros.forEach((text, i) => {
    const cy = rowCY(i);
    const start = ROWSTART + i * ROW_EACH;

    if (showRowBg) {
      const rowBgG = new Graphics()
        .roundRect(marginX, cy - rowH * 0.4, colW, rowH * 0.8, rowH * 0.16)
        .fill({ color: textColor, alpha: 0.05 });
      rowBgG.alpha = 0;
      root.addChild(rowBgG);
      timeline.to(rowBgG, { prop: "alpha", from: 0, to: 1, start: start - 0.1, duration: 0.4, ease: outQuad });
    }

    const iconX = marginX + Rchk;
    const textX = iconX + Rchk + rowH * 0.16;
    const maxW = Math.max(20, leftColCX + colW / 2 - textX - 8);

    const chip = new Container();
    chip.addChild(new Graphics().circle(0, 0, Rchk).fill(goodColor));
    chip.addChild(makeIcon("check", Rchk * 1.2, { color: onGood }));
    chip.position.set(iconX - slideDist, cy);
    chip.scale.set(0);
    root.addChild(chip);

    const label = fitText(fonts, { text, role: "body", weight: 600, size: rowFont, color: textColor, anchor: { x: 0, y: 0.5 } }, maxW);
    label.position.set(textX - slideDist, cy);
    label.alpha = 0;
    root.addChild(label);

    timeline
      .to(chip, { prop: "x", from: iconX - slideDist, to: iconX, start, duration: 0.5, ease: outQuint })
      .to(chip, { prop: "scale.x", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(1.7) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(1.7) })
      .to(label, { prop: "x", from: textX - slideDist, to: textX, start, duration: 0.5, ease: outQuint })
      .to(label, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad });
  });

  // --- Cons rows: slide in from the right ---
  cons.forEach((text, i) => {
    const cy = rowCY(i);
    const start = ROWSTART + i * ROW_EACH + CONS_OFFSET;

    if (showRowBg) {
      const rowBgG = new Graphics()
        .roundRect(marginX + colW + gap, cy - rowH * 0.4, colW, rowH * 0.8, rowH * 0.16)
        .fill({ color: textColor, alpha: 0.05 });
      rowBgG.alpha = 0;
      root.addChild(rowBgG);
      timeline.to(rowBgG, { prop: "alpha", from: 0, to: 1, start: start - 0.1, duration: 0.4, ease: outQuad });
    }

    const iconX = w - marginX - Rchk;
    const textX = iconX - Rchk - rowH * 0.16;
    const maxW = Math.max(20, textX - (rightColCX - colW / 2) - 8);

    const chip = new Container();
    chip.addChild(new Graphics().circle(0, 0, Rchk).fill(badColor));
    const cross = makeIcon("plus", Rchk * 1.2, { color: onBad });
    cross.rotation = 45 * DEG;
    chip.addChild(cross);
    chip.position.set(iconX + slideDist, cy);
    chip.scale.set(0);
    root.addChild(chip);

    const label = fitText(fonts, { text, role: "body", weight: 600, size: rowFont, color: textColor, anchor: { x: 1, y: 0.5 } }, maxW);
    label.position.set(textX + slideDist, cy);
    label.alpha = 0;
    root.addChild(label);

    timeline
      .to(chip, { prop: "x", from: iconX + slideDist, to: iconX, start, duration: 0.5, ease: outQuint })
      .to(chip, { prop: "scale.x", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(1.7) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(1.7) })
      .to(label, { prop: "x", from: textX + slideDist, to: textX, start, duration: 0.5, ease: outQuint })
      .to(label, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad });
  });

  return { timeline, duration: computeDuration(values) };
}

export const prosCons: TemplateDefinition = {
  id: "pros-cons",
  name: "Pros & Cons",
  tagline: "A two-column pros vs cons list checks in row by row.",
  category: "comparison",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.1,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", item: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Pros & Cons", maxLength: 32, shrinkToFit: true },
    { key: "prosLabel", type: "text", label: "Pros label", default: "Pros", maxLength: 16 },
    { key: "consLabel", type: "text", label: "Cons label", default: "Cons", maxLength: 16 },
    { key: "pros", type: "textlist", label: "Pros", default: DEFAULT_PROS, minItems: 2, maxItems: 4, maxLength: 32 },
    { key: "cons", type: "textlist", label: "Cons", default: DEFAULT_CONS, minItems: 2, maxItems: 4, maxLength: 32 },
    { key: "showDivider", type: "toggle", label: "Divider line", default: true },
    { key: "rowBg", type: "toggle", label: "Row background", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "goodColor", type: "color", label: "Pros color", default: "", optional: true },
    { key: "badColor", type: "color", label: "Cons color", default: "", optional: true },
  ],
  build,
};
