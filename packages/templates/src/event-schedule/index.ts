import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  makeOutBack,
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
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
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

const PALETTES: Palette[] = [
  { id: "paper-conference", name: "Paper conference", colors: { background: "#F5F3EC", textColor: "#201C12", accent: "#C2410C", onAccent: "#FFFFFF" } },
  { id: "ink-summit", name: "Ink summit", colors: { background: "#121317", textColor: "#F2F0E8", accent: "#6FE7DC", onAccent: "#121317" } },
  { id: "violet-forum", name: "Violet forum", colors: { background: "#F3EEFF", textColor: "#241452", accent: "#6D3BEA", onAccent: "#FFFFFF" } },
  { id: "slate-keynote", name: "Slate keynote", colors: { background: "#EAF0F1", textColor: "#14211F", accent: "#0C7A50", onAccent: "#FFFFFF" } },
];

const DEFAULT_ITEMS = [
  "09:00|Doors Open|—",
  "10:00|Opening Keynote|Alex Rivera",
  "11:30|Building at Scale|Priya Nair",
  "14:00|Closing Panel|Full Team",
];
const ROWS_START = 1.0;
const PER_ROW = 0.42;

interface ScheduleRow {
  time: string;
  session: string;
  speaker: string;
}

function parseRow(raw: string): ScheduleRow {
  const parts = raw.split("|");
  const time = (parts[0] ?? "").trim();
  const session = (parts[1] ?? raw).trim() || raw.trim();
  const speaker = (parts[2] ?? "").trim();
  return { time, session, speaker };
}

function resolveItems(values: Values): ScheduleRow[] {
  return asItems(values.items, DEFAULT_ITEMS)
    .slice(0, 5)
    .map(parseRow);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const aspect: Aspect = ctx.aspect;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F3EC"));
  const textColor = str(values.textColor, pc("textColor", "#201C12"));
  const accent = str(values.accent, pc("accent", "#C2410C"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const showRail = values.showRail !== false;

  const title = str(values.title, "Conference Day One");
  const subtitle = str(values.subtitle, "Hall B · Sept 12");
  const items = resolveItems(values);
  const n = Math.max(1, items.length);
  const highlightIdx = Math.max(0, Math.min(n - 1, Math.round(num(values.highlightIndex, 1))));

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
  const titleSize0 = Math.round(minDim * (horizontal ? 0.058 : 0.066));
  const titleSize = fitSize(fonts, title, "display", 700, titleSize0, contentW * 0.9);
  const titleY = zone.top + titleSize * 0.85;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 16, to: titleY, start: 0, duration: 0.55, ease: outExpo });

  let afterTitleY = titleY + titleSize * 0.55;
  if (subtitle.length > 0) {
    const subSize = Math.round(titleSize * 0.34);
    const subY = afterTitleY + subSize * 0.8;
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 600, size: subSize, color: accent, anchor: 0.5, align: "center", letterSpacing: 1 });
    subText.position.set(cx, subY);
    subText.alpha = 0;
    root.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.92, start: 0.25, duration: 0.45, ease: outQuad })
      .to(subText, { prop: "y", from: subY + 10, to: subY, start: 0.25, duration: 0.5, ease: outQuint });
    afterTitleY = subY + subSize * 0.55;
  }

  // --- Schedule geometry ---
  const scheduleTop = afterTitleY + minDim * 0.05;
  const scheduleBottom = h - zone.bottom;
  const rowH = Math.max(minDim * 0.11, (scheduleBottom - scheduleTop) / n);

  const railX = contentLeft + minDim * 0.012;
  const timeLeft = railX + minDim * 0.055;
  const timeColW = Math.min(contentW * 0.16, minDim * 0.12);
  const sessionX = timeLeft + timeColW + minDim * 0.045;

  const chipSize = Math.round(minDim * 0.024);
  const chipPadX = chipSize * 0.85;
  const chipH = Math.round(chipSize * 2.0);
  const chipLabelW = fonts.measure("NOW", { family: fonts.family("body"), weight: 700, size: chipSize });
  const chipReserve = chipLabelW + chipPadX * 2 + minDim * 0.025;
  const sessionColW = Math.max(40, contentRight - sessionX - chipReserve);

  const sessionFont = Math.min(Math.round(minDim * 0.036), Math.round(rowH * 0.26));
  const speakerFont = Math.round(sessionFont * 0.62);
  const timeFont = Math.min(Math.round(minDim * 0.034), Math.round(rowH * 0.24));

  // Rail line (grows top -> bottom), drawn before the rows so dots sit on top.
  if (showRail && n > 1) {
    const railTopY = scheduleTop + rowH * 0.5;
    const railBottomY = scheduleTop + (n - 1) * rowH + rowH * 0.5;
    const railLine = new Graphics().moveTo(0, 0).lineTo(0, railBottomY - railTopY).stroke({ color: accent, width: Math.max(2, minDim * 0.0032), alpha: 0.35 });
    railLine.position.set(railX, railTopY);
    railLine.scale.set(1, 0);
    root.addChild(railLine);
    timeline.to(railLine, { prop: "scale.y", from: 0, to: 1, start: ROWS_START - 0.15, duration: 0.6, ease: outQuad });
  }

  items.forEach((row, i) => {
    const rowCy = scheduleTop + i * rowH + rowH * 0.5;
    const isNow = i === highlightIdx;
    const start = ROWS_START + i * PER_ROW;

    if (isNow) {
      const hlH = rowH * 0.8;
      const hl = new Graphics()
        .roundRect(contentLeft - minDim * 0.012, -hlH / 2, contentW + minDim * 0.024, hlH, minDim * 0.013)
        .fill({ color: accent, alpha: 0.12 });
      hl.position.set(0, rowCy);
      hl.scale.set(0, 1);
      root.addChild(hl);
      timeline.to(hl, { prop: "scale.x", from: 0, to: 1, start: start - 0.05, duration: 0.45, ease: outExpo });
    }

    const rowC = new Container();
    rowC.position.set(0, rowCy);
    rowC.alpha = 0;
    root.addChild(rowC);

    if (showRail) {
      const dotR = isNow ? minDim * 0.013 : minDim * 0.008;
      const dot = new Graphics().circle(0, 0, dotR).fill(isNow ? accent : { color: accent, alpha: 0.5 });
      dot.position.set(railX, 0);
      dot.scale.set(0);
      rowC.addChild(dot);
      timeline
        .to(dot, { prop: "scale.x", from: 0, to: 1, start, duration: 0.35, ease: makeOutBack(2.2) })
        .to(dot, { prop: "scale.y", from: 0, to: 1, start, duration: 0.35, ease: makeOutBack(2.2) });
    }

    if (row.time.length > 0) {
      const timeSize = fitSize(fonts, row.time, "display", 700, timeFont, timeColW);
      const timeText = makeText(fonts, { text: row.time, role: "display", weight: 700, size: timeSize, color: accent, anchor: { x: 1, y: 0.5 } });
      timeText.position.set(timeLeft + timeColW, 0);
      rowC.addChild(timeText);
    }

    const hasSpeaker = row.speaker.length > 0;
    const sessionSize = fitSize(fonts, row.session, "body", 700, sessionFont, sessionColW);
    const sessionText = makeText(fonts, { text: row.session, role: "body", weight: 700, size: sessionSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    sessionText.position.set(sessionX, hasSpeaker ? -rowH * 0.14 : 0);
    rowC.addChild(sessionText);

    if (hasSpeaker) {
      const speakerSize = fitSize(fonts, row.speaker, "body", 500, speakerFont, sessionColW);
      const speakerText = makeText(fonts, { text: row.speaker, role: "body", weight: 500, size: speakerSize, color: textColor, anchor: { x: 0, y: 0.5 } });
      speakerText.alpha = 0.75;
      speakerText.position.set(sessionX, rowH * 0.16);
      rowC.addChild(speakerText);
    }

    if (isNow) {
      const chipText = makeText(fonts, { text: "NOW", role: "body", weight: 700, size: chipSize, color: onAccent, anchor: 0.5, letterSpacing: 1 });
      const chipW = chipText.width + chipPadX * 2;
      const chipC = new Container();
      chipC.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill(accent));
      chipC.addChild(chipText);
      chipC.position.set(contentRight - chipW / 2, 0);
      chipC.scale.set(0);
      rowC.addChild(chipC);
      timeline
        .to(chipC, { prop: "scale.x", from: 0, to: 1, start: start + 0.16, duration: 0.4, ease: makeOutBack(1.8) })
        .to(chipC, { prop: "scale.y", from: 0, to: 1, start: start + 0.16, duration: 0.4, ease: makeOutBack(1.8) });
    }

    timeline
      .to(rowC, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(rowC, { prop: "x", from: 24, to: 0, start, duration: 0.5, ease: outQuint });
  });

  return { timeline, duration: 4.8 };
}

export const eventSchedule: TemplateDefinition = {
  id: "event-schedule",
  name: "Event Schedule",
  tagline: "An agenda staggers in row by row along a time rail.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { title: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Event title", default: "Conference Day One", maxLength: 40, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "Hall B · Sept 12", maxLength: 40, optional: true },
    {
      key: "items",
      type: "textlist",
      label: "Schedule",
      default: DEFAULT_ITEMS,
      minItems: 3,
      maxItems: 5,
      maxLength: 60,
      help: 'One per line as "time|session|speaker", e.g. "10:00|Opening Keynote|Alex Rivera".',
    },
    { key: "highlightIndex", type: "slider", label: "Emphasized row", default: 1, min: 0, max: 4, step: 1, help: "Which row (from the top, starting at 0) gets the now/keynote highlight." },
    { key: "showRail", type: "toggle", label: "Time rail", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
