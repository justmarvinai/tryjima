import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  safeRect,
  outQuad,
  outQuint,
  inOutCubic,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon, type IconName } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const DEFAULT_TABS = ["Create", "Automate", "Share", "Grow"];
const DEFAULT_DESCRIPTIONS = [
  "Design in minutes, not hours.",
  "Set it once and let it run.",
  "Post everywhere from one tap.",
  "Watch the results roll in.",
];
const ICON_CYCLE: IconName[] = ["bolt", "star", "share", "check", "heart", "bell"];

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF4EE", textColor: "#101014", accent: "#FF4D1C", muted: "#D8C7BE" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", textColor: "#241452", accent: "#7C5CFF", muted: "#CBC0E8" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", textColor: "#0F1B2A", accent: "#2E5BD6", muted: "#C0D0E4" } },
  { id: "ink", name: "Ink", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#84CC16", muted: "#4B4E56" } },
];

function strList(values: Values, key: string, fallback: string[], min: number, max: number): string[] {
  const raw = values[key];
  if (Array.isArray(raw)) {
    const arr = raw.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length >= min) return arr.slice(0, max);
  }
  return fallback;
}

const HOLD_FIRST = 0.9;
const SWITCH = 0.45;
const HOLD = 1.0;
const END_EXTRA = 0.4;

function schedule(n: number): { starts: number[]; totalDur: number } {
  const starts: number[] = [];
  let t = HOLD_FIRST;
  for (let i = 0; i < n - 1; i++) {
    starts.push(t);
    t += SWITCH + HOLD;
  }
  return { starts, totalDur: t + END_EXTRA };
}

function computeDuration(values: Values): number {
  const tabs = strList(values, "tabs", DEFAULT_TABS, 3, 4);
  const desc = strList(values, "descriptions", DEFAULT_DESCRIPTIONS, 3, 4);
  const n = Math.min(tabs.length, desc.length);
  return schedule(n).totalDur;
}

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF4EE"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const muted = pc("muted", "#D8C7BE");
  const showUnderline = values.showUnderline !== false;

  const tabsArr = strList(values, "tabs", DEFAULT_TABS, 3, 4);
  const descArr = strList(values, "descriptions", DEFAULT_DESCRIPTIONS, 3, 4);
  const n = Math.min(tabsArr.length, descArr.length);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const safe = safeRect(ctx.aspect);
  const cx = safe.x + safe.width / 2;
  const timeline = new JimaTimeline();

  const { starts } = schedule(n);
  const fadeSchedule = (i: number): { inStart: number; inDur: number; outStart: number | null } => ({
    inStart: i === 0 ? 0.15 : starts[i - 1]!,
    inDur: i === 0 ? 0.5 : SWITCH,
    outStart: i < n - 1 ? starts[i]! : null,
  });

  // --- Tab row: measure at a base size, then shrink the whole row if it would
  // overflow the safe width (keeps long/German labels from spilling off-frame). ---
  const measureRow = (fontSize: number): { widths: number[]; gap: number; total: number } => {
    const widths = tabsArr.slice(0, n).map((label) =>
      fonts.measure(label, { family: fonts.family("display"), weight: 700, size: fontSize }),
    );
    const gapPx = fontSize * 1.7;
    const total = widths.reduce((a, b) => a + b, 0) + (n - 1) * gapPx;
    return { widths, gap: gapPx, total };
  };
  let tabFont = Math.round(minDim * 0.036);
  let row = measureRow(tabFont);
  const maxRowW = safe.width * 0.94;
  if (row.total > maxRowW && tabFont > 14) {
    tabFont = Math.max(14, Math.floor(tabFont * (maxRowW / row.total)));
    row = measureRow(tabFont);
  }

  const tabY = safe.y + safe.height * 0.12;
  const tabCenters: number[] = [];
  {
    let cursor = cx - row.total / 2;
    for (let i = 0; i < n; i++) {
      const wi = row.widths[i]!;
      tabCenters.push(cursor + wi / 2);
      cursor += wi + row.gap;
    }
  }

  for (let i = 0; i < n; i++) {
    const label = tabsArr[i]!;
    const cxi = tabCenters[i]!;
    const dim = makeText(fonts, { text: label, role: "display", weight: 700, size: tabFont, color: muted, anchor: 0.5 });
    dim.position.set(cxi, tabY);
    root.addChild(dim);
    const bright = makeText(fonts, { text: label, role: "display", weight: 700, size: tabFont, color: textColor, anchor: 0.5 });
    bright.position.set(cxi, tabY);
    bright.alpha = i === 0 ? 1 : 0;
    root.addChild(bright);
    const sc = fadeSchedule(i);
    if (i !== 0) {
      timeline.to(bright, { prop: "alpha", from: 0, to: 1, start: sc.inStart, duration: sc.inDur, ease: outQuad });
    }
    if (sc.outStart !== null) {
      timeline.to(bright, { prop: "alpha", from: 1, to: 0, start: sc.outStart, duration: SWITCH, ease: outQuad });
    }
  }

  // --- Sliding underline (decorative — gated by showUnderline). ---
  if (showUnderline) {
    const barH = Math.max(3, tabFont * 0.14);
    const barY = tabY + tabFont * 0.62;
    const UNIT = 100;
    const padW = tabFont * 0.5;
    const widthAt = (i: number): number => row.widths[i]! + padW;
    const underline = new Graphics().roundRect(-UNIT / 2, 0, UNIT, barH, barH / 2).fill(accent);
    underline.position.set(tabCenters[0]!, barY);
    underline.scale.set(widthAt(0) / UNIT, 1);
    root.addChild(underline);
    starts.forEach((st, i) => {
      timeline
        .to(underline, { prop: "x", from: tabCenters[i]!, to: tabCenters[i + 1]!, start: st, duration: SWITCH, ease: inOutCubic })
        .to(underline, { prop: "scale.x", from: widthAt(i) / UNIT, to: widthAt(i + 1) / UNIT, start: st, duration: SWITCH, ease: inOutCubic });
    });
  }

  // --- Panel content per tab (icon + heading + description line), crossfading. ---
  const panelIconY = safe.y + safe.height * 0.42;
  const panelHeadY = safe.y + safe.height * 0.6;
  const panelDescY = safe.y + safe.height * 0.72;
  const iconSize = minDim * 0.13;
  const headSize = Math.round(minDim * 0.052);
  const descSize = Math.round(minDim * 0.028);

  for (let i = 0; i < n; i++) {
    const group = new Container();
    const icon = makeIcon(ICON_CYCLE[i % ICON_CYCLE.length]!, iconSize, { color: accent });
    icon.position.set(cx, panelIconY);
    group.addChild(icon);
    const heading = fitText(
      fonts,
      { text: tabsArr[i]!, role: "display", weight: 700, size: headSize, color: textColor, anchor: 0.5, align: "center" },
      safe.width * 0.86,
    );
    heading.position.set(cx, panelHeadY);
    group.addChild(heading);
    const desc = fitText(
      fonts,
      { text: descArr[i]!, role: "body", weight: 500, size: descSize, color: textColor, anchor: 0.5, align: "center" },
      safe.width * 0.72,
    );
    desc.alpha = 0.72;
    desc.position.set(cx, panelDescY);
    group.addChild(desc);
    root.addChild(group);

    const sc = fadeSchedule(i);
    if (i === 0) {
      group.alpha = 0;
      group.y = 16;
      timeline
        .to(group, { prop: "alpha", from: 0, to: 1, start: sc.inStart, duration: sc.inDur, ease: outQuad })
        .to(group, { prop: "y", from: 16, to: 0, start: sc.inStart, duration: sc.inDur + 0.1, ease: outQuint });
    } else {
      group.alpha = 0;
      group.y = 0;
      timeline.to(group, { prop: "alpha", from: 0, to: 1, start: sc.inStart, duration: sc.inDur, ease: outQuad });
    }
    if (sc.outStart !== null) {
      timeline.to(group, { prop: "alpha", from: 1, to: 0, start: sc.outStart, duration: SWITCH, ease: outQuad });
    }
  }

  return { timeline, duration: computeDuration(values) };
}

export const featureTabs: TemplateDefinition = {
  id: "feature-tabs",
  name: "Feature Tabs",
  tagline: "A tabbed feature switcher cycles through your highlights.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 4.5,
  estimateDuration: computeDuration,
  fontRoles: { tabs: "display", descriptions: "body" },
  palettes: PALETTES,
  fields: [
    { key: "tabs", type: "textlist", label: "Tab labels", default: DEFAULT_TABS, minItems: 3, maxItems: 4, maxLength: 12 },
    { key: "descriptions", type: "textlist", label: "Descriptions", default: DEFAULT_DESCRIPTIONS, minItems: 3, maxItems: 4, maxLength: 48 },
    { key: "showUnderline", type: "toggle", label: "Sliding underline", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
