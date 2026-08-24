import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
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

interface Stop {
  day: string;
  place: string;
  activity: string;
}

function parseStop(raw: string): Stop {
  const idx1 = raw.indexOf("|");
  if (idx1 === -1) return { day: "", place: raw.trim(), activity: "" };
  const day = raw.slice(0, idx1).trim();
  const rest = raw.slice(idx1 + 1);
  const idx2 = rest.indexOf("|");
  if (idx2 === -1) return { day, place: rest.trim(), activity: "" };
  return { day, place: rest.slice(0, idx2).trim(), activity: rest.slice(idx2 + 1).trim() };
}

const DEFAULT_STOPS = [
  "Day 1|Tokyo|Arrive & explore Shibuya",
  "Day 2|Kyoto|Temples and a bamboo grove",
  "Day 3|Osaka|Street food crawl",
  "Day 4|Hakone|Hot springs & Mt. Fuji views",
];

function resolveStops(values: Values): Stop[] {
  return asList(values.stops, DEFAULT_STOPS)
    .slice(0, 4)
    .map(parseStop);
}

// onAccent is a palette-only role (day-badge text) — not user-exposed.
const PALETTES: Palette[] = [
  { id: "paper-trail", name: "Paper trail", colors: { background: "#F5F1E8", textColor: "#221A10", accent: "#B5541F", onAccent: "#FFFFFF" } },
  { id: "midnight-map", name: "Midnight map", colors: { background: "#12141C", textColor: "#F2F0EA", accent: "#4FC3F7", onAccent: "#08202B" } },
  { id: "sage-explorer", name: "Sage explorer", colors: { background: "#EEF3EA", textColor: "#16281C", accent: "#1B5C38", onAccent: "#FFFFFF" } },
  { id: "coral-wander", name: "Coral wander", colors: { background: "#FFF1EC", textColor: "#3A1500", accent: "#B8380F", onAccent: "#FFFFFF" } },
];

const LINE_START = 0.1;
const LINE_DUR = 0.6;
const ROWS_START = 0.5;
const PER_ROW = 0.42;
const DURATION = 3.6;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F1E8"));
  const textColor = str(values.textColor, pc("textColor", "#221A10"));
  const accent = str(values.accent, pc("accent", "#B5541F"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const title = str(values.title, "5 Days in Tokyo");
  const showLine = values.showLine !== false;
  const stops = resolveStops(values);
  const n = Math.max(1, stops.length);

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);
  const contentLeft = zone.x;
  const contentRight = zone.x + zone.width;
  const contentW = zone.width;

  // --- Title ---
  const titleSize0 = Math.round(minDim * 0.062);
  const titleSize = fitSize(fonts, title, "display", 700, titleSize0, contentW * 0.92);
  const titleY = zone.y + titleSize * 0.85;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 16, to: titleY, start: 0, duration: 0.5, ease: outExpo });

  // --- Vertical list geometry ---
  const listTop = titleY + titleSize * 0.62 + minDim * 0.05;
  const listBottom = zone.y + zone.height;
  const rowH = Math.max(minDim * 0.1, (listBottom - listTop) / n);

  const lineX = contentLeft + minDim * 0.028;
  const pinSize = minDim * 0.05;
  const badgeFont = Math.round(minDim * 0.024);
  const placeFont0 = Math.round(minDim * 0.042);
  const activityFont0 = Math.round(minDim * 0.027);
  const badgeGap = minDim * 0.022;
  const textGap = minDim * 0.024;

  const firstCy = listTop + rowH * 0.5;
  const lastCy = listTop + (n - 1) * rowH + rowH * 0.5;

  // --- Connecting line (optional) — draws top to bottom behind the stops ---
  if (showLine) {
    const lineW = Math.max(3, minDim * 0.006);
    const lineLen = Math.max(0, lastCy - firstCy);
    const line = new Graphics().roundRect(-lineW / 2, 0, lineW, lineLen, lineW / 2).fill({ color: textColor, alpha: 0.2 });
    line.position.set(lineX, firstCy);
    line.scale.set(1, 0);
    line.label = "line";
    root.addChild(line);
    timeline.to(line, { prop: "scale.y", from: 0, to: 1, start: LINE_START, duration: LINE_DUR, ease: outExpo });
  }

  stops.forEach((stop, i) => {
    const rowCy = listTop + i * rowH + rowH * 0.5;
    const start = ROWS_START + i * PER_ROW;

    // Pin — tip lands exactly on the line.
    const pin = new Container();
    pin.pivot.set(0, pinSize * 0.5);
    pin.addChild(makeIcon("pin", pinSize, { color: accent, holeColor: bg }));
    pin.position.set(lineX, rowCy);
    pin.scale.set(0);
    root.addChild(pin);
    timeline
      .to(pin, { prop: "scale.x", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(2.2) })
      .to(pin, { prop: "scale.y", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(2.2) });

    // Day badge (small pill), inline to the right of the pin.
    const dayLabel = (stop.day.length > 0 ? stop.day : `Day ${i + 1}`).toUpperCase();
    const badgeFontFit = fitSize(fonts, dayLabel, "body", 700, badgeFont, minDim * 0.17);
    const badgeText = makeText(fonts, { text: dayLabel, role: "body", weight: 700, size: badgeFontFit, color: onAccent, anchor: 0.5, letterSpacing: 0.5 });
    const badgeW = badgeText.width + badgeFont * 1.4;
    const badgeH = badgeFont * 2.0;
    const badgeCx = lineX + pinSize * 0.85 + badgeGap + badgeW / 2;
    const rowTextY = rowCy - rowH * 0.14;
    const badge = new Container();
    badge.addChild(new Graphics().roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, badgeH / 2).fill(accent));
    badge.addChild(badgeText);
    badge.position.set(badgeCx, rowTextY);
    badge.scale.set(0);
    root.addChild(badge);
    timeline
      .to(badge, { prop: "scale.x", from: 0, to: 1, start: start + 0.08, duration: 0.5, ease: makeOutBack(2) })
      .to(badge, { prop: "scale.y", from: 0, to: 1, start: start + 0.08, duration: 0.5, ease: makeOutBack(2) });

    // Place + activity — a two-line text block sliding in.
    const textX = badgeCx + badgeW / 2 + textGap;
    const maxTextW = Math.max(20, contentRight - textX);
    const placeSize = fitSize(fonts, stop.place, "display", 700, placeFont0, maxTextW);
    const activityY = rowTextY + rowH * 0.3;

    const block = new Container();
    block.alpha = 0;
    root.addChild(block);

    const placeText = makeText(fonts, { text: stop.place, role: "display", weight: 700, size: placeSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    placeText.position.set(textX, rowTextY);
    block.addChild(placeText);

    if (stop.activity.length > 0) {
      const activitySize = fitSize(fonts, stop.activity, "body", 500, activityFont0, maxTextW);
      const activityText = makeText(fonts, { text: stop.activity, role: "body", weight: 500, size: activitySize, color: textColor, anchor: { x: 0, y: 0.5 } });
      activityText.position.set(textX, activityY);
      activityText.alpha = 0.72;
      block.addChild(activityText);
    }

    timeline
      .to(block, { prop: "alpha", from: 0, to: 1, start: start + 0.14, duration: 0.4, ease: outQuad })
      .to(block, { prop: "x", from: 20, to: 0, start: start + 0.14, duration: 0.5, ease: outQuint });
  });

  return { timeline, duration: DURATION };
}

export const itinerary: TemplateDefinition = {
  id: "itinerary",
  name: "Itinerary",
  tagline: "A day-by-day trip timeline with pins along a connecting line.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.5,
  fontRoles: { title: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Trip title", default: "5 Days in Tokyo", maxLength: 32, shrinkToFit: true },
    {
      key: "stops",
      type: "textlist",
      label: "Stops",
      default: DEFAULT_STOPS,
      minItems: 3,
      maxItems: 4,
      maxLength: 56,
      help: 'One per line as "day|place|activity", e.g. "Day 1|Tokyo|Arrive & explore Shibuya".',
    },
    { key: "showLine", type: "toggle", label: "Connecting line", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
