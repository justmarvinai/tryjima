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
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { groupThousands } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}

// A SaaS dashboard mockup: a sidebar, a KPI row that counts up, and a bar-chart
// widget. The window/panel/tiles carry their own palette keys so the mockup
// stays legible over the page background.
const PALETTES: Palette[] = [
  {
    id: "cloud",
    name: "Cloud",
    colors: {
      background: "#EEF1F7", panel: "#FFFFFF", sidebar: "#101728", tile: "#F4F6FA", inkColor: "#101728",
      textColor: "#101728", accent: "#3B6EF5", good: "#17A34A", chartBg: "#F4F6FA", muted: "#8A93A6",
    },
  },
  {
    id: "mint",
    name: "Mint",
    colors: {
      background: "#E9F7EF", panel: "#FFFFFF", sidebar: "#0C2A1E", tile: "#F1F8F4", inkColor: "#06301F",
      textColor: "#06301F", accent: "#12B76A", good: "#12B76A", chartBg: "#F1F8F4", muted: "#7FA692",
    },
  },
  {
    id: "grape",
    name: "Grape",
    colors: {
      background: "#F1ECFF", panel: "#FFFFFF", sidebar: "#1C1140", tile: "#F5F1FF", inkColor: "#241452",
      textColor: "#241452", accent: "#7C5CFF", good: "#17A34A", chartBg: "#F5F1FF", muted: "#9488BE",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    colors: {
      background: "#0E1017", panel: "#191C27", sidebar: "#12141D", tile: "#222634", inkColor: "#F2F4F8",
      textColor: "#F2F4F8", accent: "#5B8CFF", good: "#3DDC84", chartBg: "#222634", muted: "#8891A6",
    },
  },
];

const DEFAULT_STATS = ["Revenue | $48.2K", "Active users | 12,480", "Churn | 1.4%"];

interface Stat {
  label: string;
  prefix: string;
  target: number;
  decimals: number;
  suffix: string;
}

function parseStat(raw: string): Stat {
  const parts = raw.split("|");
  const label = (parts[0] ?? "").trim();
  const valuePart = (parts[1] ?? "0").trim();
  const m = valuePart.match(/\d[\d,]*(\.\d+)?/);
  let prefix = valuePart;
  let suffix = "";
  let decimals = 0;
  let target = 0;
  if (m) {
    const numStr = m[0];
    const idx = m.index ?? 0;
    prefix = valuePart.slice(0, idx);
    suffix = valuePart.slice(idx + numStr.length);
    const dot = numStr.indexOf(".");
    decimals = dot >= 0 ? numStr.length - dot - 1 : 0;
    target = Number(numStr.replace(/,/g, ""));
  }
  return { label: label.length ? label : raw.trim(), prefix, target, decimals, suffix };
}

function formatValue(value: number, decimals: number): string {
  if (decimals > 0) {
    const factor = Math.pow(10, decimals);
    const rounded = Math.round(value * factor) / factor;
    const whole = Math.floor(rounded);
    const frac = Math.round((rounded - whole) * factor);
    return `${groupThousands(whole)}.${String(frac).padStart(decimals, "0")}`;
  }
  return groupThousands(value);
}

interface Cfg {
  winWF: number;
  winHF: number;
  cyF: number;
  sbF: number;
}
const CFG: Record<Aspect, Cfg> = {
  "16:9": { winWF: 0.82, winHF: 0.78, cyF: 0.5, sbF: 0.2 },
  "1:1": { winWF: 0.88, winHF: 0.82, cyF: 0.49, sbF: 0.22 },
  "4:5": { winWF: 0.9, winHF: 0.74, cyF: 0.48, sbF: 0.24 },
  "9:16": { winWF: 0.92, winHF: 0.6, cyF: 0.46, sbF: 0.2 },
};

const COUNT_DUR = 1.25;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F7"));
  const panel = pc("panel", "#FFFFFF");
  const sidebarBg = pc("sidebar", "#101728");
  const tileBg = pc("tile", "#F4F6FA");
  const chartBg = pc("chartBg", "#F4F6FA");
  const textColor = str(values.textColor, pc("textColor", "#101728"));
  const accent = str(values.accent, pc("accent", "#3B6EF5"));
  const good = pc("good", "#17A34A");
  const muted = pc("muted", "#8A93A6");

  const appName = str(values.appName, "Northwind");
  const showSidebar = values.showSidebar !== false;
  const showChart = values.showChart !== false;
  const stats = asList(values.stats, DEFAULT_STATS).slice(0, 3).map(parseStat);
  while (stats.length < 3) stats.push(parseStat(DEFAULT_STATS[stats.length]!));

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cfg = CFG[ctx.aspect];

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const cx = w / 2;
  const cy = h * cfg.cyF;
  const winW = w * cfg.winWF;
  const winH = h * cfg.winHF;
  const bodyR = Math.min(winW, winH) * 0.03;

  const win = new Container();
  win.position.set(cx, cy);
  win.alpha = 0;
  win.scale.set(0.94);
  root.addChild(win);
  timeline
    .to(win, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(win, { prop: "scale.x", from: 0.94, to: 1, start: 0, duration: 0.55, ease: makeOutBack(1.2) })
    .to(win, { prop: "scale.y", from: 0.94, to: 1, start: 0, duration: 0.55, ease: makeOutBack(1.2) });

  win.addChild(new Graphics().roundRect(-winW / 2, -winH / 2 + winH * 0.02, winW, winH, bodyR).fill({ color: "#000000", alpha: 0.16 }));
  win.addChild(new Graphics().roundRect(-winW / 2, -winH / 2, winW, winH, bodyR).fill(panel));

  const sbW = showSidebar ? winW * cfg.sbF : 0;
  if (showSidebar) {
    // Sidebar (rounded on the left only — mask with an overlaid rect on the right edge).
    const sb = new Container();
    win.addChild(sb);
    sb.addChild(new Graphics().roundRect(-winW / 2, -winH / 2, sbW + bodyR, winH, bodyR).fill(sidebarBg));
    sb.addChild(new Graphics().rect(-winW / 2 + sbW, -winH / 2, bodyR, winH).fill(sidebarBg));
    const sbPad = sbW * 0.16;
    const logoX = -winW / 2 + sbPad;
    const logoY = -winH / 2 + winH * 0.09;
    const logoR = sbW * 0.11;
    sb.addChild(new Graphics().roundRect(logoX, logoY - logoR, logoR * 2, logoR * 2, logoR * 0.5).fill(accent));
    const nameSize = fitSize(fonts, appName, "display", 700, Math.round(sbW * 0.15), sbW - sbPad * 2 - logoR * 2.6);
    const nameNode = makeText(fonts, { text: appName, role: "display", weight: 700, size: nameSize, color: "#FFFFFF", anchor: { x: 0, y: 0.5 } });
    nameNode.position.set(logoX + logoR * 2.4, logoY);
    sb.addChild(nameNode);
    // Nav skeleton pills, one active.
    const navX = -winW / 2 + sbPad;
    const navW = sbW - sbPad * 2;
    const navTop = logoY + winH * 0.09;
    const navGap = winH * 0.075;
    const pillH = Math.max(8, winH * 0.036);
    for (let i = 0; i < 4; i++) {
      const py = navTop + i * navGap;
      const active = i === 0;
      const pill = new Container();
      pill.position.set(0, py);
      pill.alpha = 0;
      sb.addChild(pill);
      if (active) pill.addChild(new Graphics().roundRect(navX - pillH * 0.4, -pillH * 0.8, navW + pillH * 0.8, pillH * 1.6, pillH * 0.5).fill({ color: accent, alpha: 0.9 }));
      pill.addChild(new Graphics().roundRect(navX, -pillH / 2, pillH, pillH, pillH * 0.3).fill(active ? "#FFFFFF" : { color: "#FFFFFF", alpha: 0.35 }));
      pill.addChild(new Graphics().roundRect(navX + pillH * 1.4, -pillH * 0.3, navW * 0.62, pillH * 0.6, pillH * 0.3).fill(active ? "#FFFFFF" : { color: "#FFFFFF", alpha: 0.28 }));
      timeline.to(pill, { prop: "alpha", from: 0, to: 1, start: 0.35 + i * 0.08, duration: 0.4, ease: outQuad });
    }
  }

  const contentX0 = -winW / 2 + sbW;
  const contentW = winW - sbW;
  const pad = winW * 0.028;
  const innerX0 = contentX0 + pad;
  const innerW = contentW - pad * 2;

  // Top bar: title + a search pill + avatar dot.
  const topBarH = winH * 0.14;
  const titleY = -winH / 2 + topBarH * 0.5;
  const title = makeText(fonts, { text: "Dashboard", role: "display", weight: 700, size: Math.round(minDim * 0.026), color: textColor, anchor: { x: 0, y: 0.5 } });
  title.position.set(innerX0, titleY);
  title.alpha = 0;
  win.addChild(title);
  win.addChild(new Graphics().circle(contentX0 + contentW - pad - topBarH * 0.28, titleY, topBarH * 0.28).fill({ color: accent, alpha: 0.85 }));
  const searchPillW = innerW * 0.34;
  win.addChild(new Graphics().roundRect(contentX0 + contentW - pad - topBarH * 0.7 - searchPillW, titleY - topBarH * 0.2, searchPillW, topBarH * 0.4, topBarH * 0.2).fill(tileBg));
  timeline.to(title, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outQuad });

  // KPI row: 3 tiles that count up.
  const kpiTop = -winH / 2 + topBarH + pad * 0.6;
  const kpiH = winH * 0.24;
  const tileGap = innerW * 0.03;
  const tileW = (innerW - 2 * tileGap) / 3;
  const tileR = Math.min(tileW, kpiH) * 0.1;
  const counters: { node: Text; stat: Stat; start: number }[] = [];
  stats.forEach((s, i) => {
    const tx0 = innerX0 + i * (tileW + tileGap);
    const tile = new Container();
    tile.position.set(tx0 + tileW / 2, kpiTop + kpiH / 2);
    tile.alpha = 0;
    tile.scale.set(0.85);
    win.addChild(tile);
    tile.addChild(new Graphics().roundRect(-tileW / 2, -kpiH / 2, tileW, kpiH, tileR).fill(tileBg));
    const stripeW = Math.max(4, tileW * 0.02);
    tile.addChild(new Graphics().roundRect(-tileW / 2, -kpiH / 2 + tileR * 0.5, stripeW, kpiH - tileR, stripeW / 2).fill(accent));
    const tPad = tileW * 0.12;
    const labelSize = fitSize(fonts, s.label, "body", 600, Math.round(kpiH * 0.13), tileW - tPad * 2);
    const labelNode = makeText(fonts, { text: s.label, role: "body", weight: 600, size: labelSize, color: muted, anchor: { x: 0, y: 0 } });
    labelNode.position.set(-tileW / 2 + tPad, -kpiH * 0.34);
    tile.addChild(labelNode);
    const fullStr = s.prefix + formatValue(s.target, s.decimals) + s.suffix;
    const numSize = fitSize(fonts, fullStr, "display", 700, Math.round(kpiH * 0.32), tileW - tPad * 2);
    const numNode = makeText(fonts, { text: s.prefix + "0" + s.suffix, role: "display", weight: 700, size: numSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    numNode.position.set(-tileW / 2 + tPad, kpiH * 0.06);
    tile.addChild(numNode);
    // Small up-trend chip.
    const tri = new Graphics().poly([0, -kpiH * 0.04, kpiH * 0.045, kpiH * 0.035, -kpiH * 0.045, kpiH * 0.035]).fill(good);
    tri.position.set(-tileW / 2 + tPad + kpiH * 0.045, kpiH * 0.3);
    tile.addChild(tri);
    tile.addChild(new Graphics().roundRect(-tileW / 2 + tPad + kpiH * 0.12, kpiH * 0.3 - kpiH * 0.03, tileW * 0.28, kpiH * 0.06, kpiH * 0.03).fill({ color: good, alpha: 0.3 }));

    const start = 0.5 + i * 0.14;
    timeline
      .to(tile, { prop: "alpha", from: 0, to: 1, start, duration: 0.32, ease: outQuad })
      .to(tile, { prop: "scale.x", from: 0.85, to: 1, start, duration: 0.5, ease: makeOutBack(1.5) })
      .to(tile, { prop: "scale.y", from: 0.85, to: 1, start, duration: 0.5, ease: makeOutBack(1.5) });
    counters.push({ node: numNode, stat: s, start: start + 0.2 });
  });

  // Chart widget: a card with a title and staggered growing bars.
  if (showChart) {
    const chartTop = kpiTop + kpiH + pad;
    const chartBottom = winH / 2 - pad;
    const chartH = chartBottom - chartTop;
    if (chartH > minDim * 0.06) {
      const chartCard = new Container();
      chartCard.position.set(innerX0 + innerW / 2, chartTop + chartH / 2);
      chartCard.alpha = 0;
      win.addChild(chartCard);
      const cr = Math.min(innerW, chartH) * 0.05;
      chartCard.addChild(new Graphics().roundRect(-innerW / 2, -chartH / 2, innerW, chartH, cr).fill(chartBg));
      const cPad = innerW * 0.045;
      const cTitle = makeText(fonts, { text: "Revenue this week", role: "body", weight: 600, size: Math.round(chartH * 0.1), color: textColor, anchor: { x: 0, y: 0 } });
      cTitle.position.set(-innerW / 2 + cPad, -chartH / 2 + chartH * 0.08);
      chartCard.addChild(cTitle);
      timeline.to(chartCard, { prop: "alpha", from: 0, to: 1, start: 0.7, duration: 0.4, ease: outQuad });

      const nBars = 7;
      const plotLeft = -innerW / 2 + cPad;
      const plotRight = innerW / 2 - cPad;
      const plotW = plotRight - plotLeft;
      const baseline = chartH / 2 - chartH * 0.12;
      const plotTop = -chartH / 2 + chartH * 0.32;
      const plotH = baseline - plotTop;
      // Dashed axis baseline.
      chartCard.addChild(new Graphics().rect(plotLeft, baseline, plotW, Math.max(1, chartH * 0.006)).fill({ color: muted, alpha: 0.4 }));
      const slotW = plotW / nBars;
      const barW = slotW * 0.5;
      for (let i = 0; i < nBars; i++) {
        const frac = 0.32 + rng.range(0, 0.68);
        const bh = plotH * frac;
        const bx = plotLeft + slotW * (i + 0.5);
        const barWrap = new Container();
        barWrap.position.set(bx, baseline);
        barWrap.scale.y = 0;
        chartCard.addChild(barWrap);
        const isLast = i === nBars - 1;
        barWrap.addChild(new Graphics().roundRect(-barW / 2, -bh, barW, bh, barW * 0.3).fill(isLast ? accent : { color: accent, alpha: 0.45 }));
        timeline.to(barWrap, { prop: "scale.y", from: 0, to: 1, start: 0.95 + i * 0.07, duration: 0.6, ease: outExpo });
      }
    }
  }

  const update = (t: number): void => {
    for (const c of counters) {
      const p = outExpo(clamp01((t - c.start) / COUNT_DUR));
      c.node.text = c.stat.prefix + formatValue(c.stat.target * p, c.stat.decimals) + c.stat.suffix;
    }
  };

  return { timeline, duration: 4.2, update };
}

export const dashboard: TemplateDefinition = {
  id: "dashboard",
  name: "Dashboard",
  tagline: "A SaaS dashboard mockup with a sidebar, count-up KPIs, and a bar chart.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { appName: "display", stat: "display" },
  palettes: PALETTES,
  fields: [
    { key: "appName", type: "text", label: "App name", default: "Northwind", maxLength: 18, shrinkToFit: true },
    { key: "stats", type: "textlist", label: "KPIs (label | value)", default: DEFAULT_STATS, minItems: 3, maxItems: 3, maxLength: 26 },
    { key: "showSidebar", type: "toggle", label: "Sidebar", default: true },
    { key: "showChart", type: "toggle", label: "Chart widget", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
