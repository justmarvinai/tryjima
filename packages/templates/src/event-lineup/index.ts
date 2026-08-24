import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  outQuint,
  safeZone,
  type Aspect,
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
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

// Reused wholesale from save-the-date (already-vetted event-invite role set).
const PALETTES: Palette[] = [
  { id: "ivory", name: "Invitation ivory", colors: { background: "#FBF7EF", textColor: "#2A2416", accent: "#B5892A" } },
  { id: "ink-formal", name: "Ink formal", colors: { background: "#12141C", textColor: "#F4F1E9", accent: "#C9A24B" } },
  { id: "coral-festive", name: "Coral festive", colors: { background: "#FFF2EE", textColor: "#3A1206", accent: "#FF4D1C" } },
  { id: "sage-calm", name: "Sage calm", colors: { background: "#EDF3ED", textColor: "#16281C", accent: "#2F8F5B" } },
];

const DEFAULT_ITEMS = ["10:00|Doors open", "12:00|Main act", "15:00|Afterparty"];
const ROWS_START = 1.05;
const PER_ROW = 0.5;

interface ScheduleRow {
  time: string;
  label: string;
}

function parseItem(raw: string): ScheduleRow {
  const idx = raw.indexOf("|");
  if (idx >= 0) {
    const time = raw.slice(0, idx).trim();
    const label = raw.slice(idx + 1).trim();
    return { time, label: label.length ? label : raw.trim() };
  }
  return { time: "", label: raw.trim() };
}

function resolveItems(values: Values): ScheduleRow[] {
  const raw = asItems(values.items, DEFAULT_ITEMS).slice(0, 5);
  return raw.map(parseItem);
}

/** Largest size ≤ size0 at which `text` fits maxWidth (crisp, single-line). */
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
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const aspect: Aspect = ctx.aspect;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FBF7EF"));
  const textColor = str(values.textColor, pc("textColor", "#2A2416"));
  const accent = str(values.accent, pc("accent", "#B5892A"));

  const title = str(values.title, "Summer Fest");
  const date = str(values.date, "Sat 12 July");
  const showTicks = values.showTicks !== false;
  const items = resolveItems(values);
  const n = Math.max(1, items.length);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeZone(aspect);
  const contentLeft = zone.left;
  const contentRight = w - zone.right;
  const contentW = contentRight - contentLeft;
  const horizontal = aspect === "16:9" || aspect === "1:1";

  // --- Title ---
  const titleSize0 = Math.round(minDim * (horizontal ? 0.062 : 0.07));
  const titleSize = fitSize(fonts, title, "display", 700, titleSize0, contentW * 0.9);
  const titleY = zone.top + titleSize * 0.85;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 16, to: titleY, start: 0, duration: 0.55, ease: outExpo });

  // --- Date (optional) ---
  let afterTitleY = titleY + titleSize * 0.55;
  if (date.length > 0) {
    const dateSize = Math.round(titleSize * 0.36);
    const dateY = afterTitleY + dateSize * 0.8;
    const dateText = makeText(fonts, { text: date, role: "body", weight: 600, size: dateSize, color: accent, anchor: 0.5, align: "center", letterSpacing: 1 });
    dateText.position.set(cx, dateY);
    dateText.alpha = 0;
    root.addChild(dateText);
    timeline
      .to(dateText, { prop: "alpha", from: 0, to: 0.92, start: 0.25, duration: 0.45, ease: outQuad })
      .to(dateText, { prop: "y", from: dateY + 10, to: dateY, start: 0.25, duration: 0.5, ease: outQuint });
    afterTitleY = dateY + dateSize * 0.55;
  }

  // --- Accent rule ---
  const ruleW = Math.min(contentW * 0.3, titleSize * 1.6);
  const ruleY = afterTitleY + minDim * 0.032;
  const rule = new Graphics().roundRect(-ruleW / 2, -1.5, ruleW, Math.max(3, titleSize * 0.06), 2).fill(accent);
  rule.position.set(cx, ruleY);
  rule.scale.set(0, 1);
  root.addChild(rule);
  timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.55, duration: 0.4, ease: outExpo });

  // --- Schedule rows ---
  const scheduleTop = ruleY + minDim * 0.055;
  const scheduleBottom = h - zone.bottom;
  const rowH = Math.max(minDim * 0.06, (scheduleBottom - scheduleTop) / n);

  const tickW = Math.max(4, Math.round(minDim * 0.011));
  const tickH = rowH * 0.34;
  const tickReserve = tickW * 3.4;
  const timeColW = Math.min(contentW * 0.26, minDim * 0.2);
  const timeRightX = contentLeft + tickReserve + timeColW;
  const itemX = timeRightX + minDim * 0.035;
  const itemW = Math.max(20, contentRight - itemX);

  const rowFontBase = Math.round(minDim * 0.042);
  const rowFont = Math.min(rowFontBase, Math.round(rowH * 0.4));
  const dividerH = Math.max(2, rowFont * 0.05);

  items.forEach((row, i) => {
    const rowCy = scheduleTop + i * rowH + rowH * 0.5;
    const rowC = new Container();
    rowC.position.set(0, rowCy);
    rowC.alpha = 0;
    root.addChild(rowC);
    const start = ROWS_START + i * PER_ROW;

    if (row.time.length > 0) {
      const timeSize = fitSize(fonts, row.time, "display", 700, rowFont, timeColW);
      const timeText = makeText(fonts, { text: row.time, role: "display", weight: 700, size: timeSize, color: accent, anchor: { x: 1, y: 0.5 } });
      timeText.position.set(timeRightX, 0);
      rowC.addChild(timeText);
    }

    const labelSize = fitSize(fonts, row.label, "body", 600, rowFont, itemW);
    const labelText = makeText(fonts, { text: row.label, role: "body", weight: 600, size: labelSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    labelText.position.set(itemX, 0);
    rowC.addChild(labelText);

    const divider = new Graphics().roundRect(0, 0, contentW, dividerH, dividerH / 2).fill({ color: textColor, alpha: 0.12 });
    divider.position.set(contentLeft, rowH * 0.42);
    divider.scale.set(0, 1);
    rowC.addChild(divider);

    timeline
      .to(rowC, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(rowC, { prop: "x", from: 24, to: 0, start, duration: 0.55, ease: outQuint })
      .to(divider, { prop: "scale.x", from: 0, to: 1, start: start + 0.05, duration: 0.5, ease: outExpo });

    if (showTicks) {
      const tick = new Graphics().roundRect(-tickW / 2, -tickH / 2, tickW, tickH, tickW / 2).fill(accent);
      tick.position.set(contentLeft + tickW * 1.7, 0);
      tick.scale.set(1, 0);
      rowC.addChild(tick);
      timeline.to(tick, { prop: "scale.y", from: 0, to: 1, start: start + 0.08, duration: 0.32, ease: outExpo });
    }
  });

  return { timeline, duration: 5.0 };
}

export const eventLineup: TemplateDefinition = {
  id: "event-lineup",
  name: "Event Lineup",
  tagline: "A schedule reveals line by line under the event title.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.8,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Event title", default: "Summer Fest", maxLength: 40, shrinkToFit: true },
    { key: "date", type: "text", label: "Date", default: "Sat 12 July", maxLength: 32, optional: true },
    {
      key: "items",
      type: "textlist",
      label: "Schedule",
      default: DEFAULT_ITEMS,
      minItems: 2,
      maxItems: 5,
      maxLength: 40,
      help: 'One per line as "time|item", e.g. "10:00|Doors open".',
    },
    { key: "showTicks", type: "toggle", label: "Accent ticks", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
