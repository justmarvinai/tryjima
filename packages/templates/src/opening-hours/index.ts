import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outBack,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Opening Hours — the week as a two-column list, with today's row lifted and an
// "open now" pill breathing above it. The single most-asked question a local
// business gets, answered in one post.
//
// Rows are "Mon | 8–17"; prefix with `*` to mark today. Closed days set
// themselves quieter automatically when the hours read "closed".

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "sign", name: "Sign", colors: { background: "#14161A", textColor: "#F4F5F7", accent: "#4ADE80" } },
  { id: "kraft", name: "Kraft", colors: { background: "#F0E5D2", textColor: "#231A0F", accent: "#9A4A22" } },
  { id: "sea", name: "Sea", colors: { background: "#EDF4F5", textColor: "#0F2023", accent: "#0E7490" } },
  { id: "blush", name: "Blush", colors: { background: "#FCF1F2", textColor: "#221114", accent: "#DB2777" } },
];

interface Layout {
  titleFrac: number;
  rowFrac: number;
  widthFrac: number;
  topFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { titleFrac: 0.05, rowFrac: 0.03, widthFrac: 0.5, topFrac: 0.2 };
    case "9:16":
      return { titleFrac: 0.066, rowFrac: 0.04, widthFrac: 0.78, topFrac: 0.2 };
    case "4:5":
      return { titleFrac: 0.06, rowFrac: 0.037, widthFrac: 0.76, topFrac: 0.19 };
    case "1:1":
    default:
      return { titleFrac: 0.06, rowFrac: 0.036, widthFrac: 0.74, topFrac: 0.2 };
  }
}

const TITLE_AT = 0.2;
const FIRST_AT = 0.7;
const PER_ROW = 0.13;
const DURATION = 5.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#14161A"));
  const textColor = str(values.textColor, pc("textColor", "#F4F5F7"));
  const accent = str(values.accent, pc("accent", "#4ADE80"));
  const place = str(values.place, "Studio Nord");
  const rows = (Array.isArray(values.days) ? (values.days as unknown[]) : [])
    .map((v) => String(v ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 7);
  const status = str(values.status, "Open now").trim();
  const note = str(values.note, "").trim();
  const showStatus = on(values.showStatus);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const titleSize = Math.round(size.width * L.titleFrac);
  const rowSize = Math.round(size.width * L.rowFrac);
  const colW = size.width * L.widthFrac;
  const left = cx - colW / 2;
  const right = cx + colW / 2;
  const rowH = rowSize * 2.3;
  const top = size.height * L.topFrac;

  const timeline = new JimaTimeline();

  // --- Status pill above the title ---
  let pulse: Container | null = null;
  if (showStatus && status.length > 0) {
    const sSize = Math.round(titleSize * 0.32);
    const label = makeText(fonts, { text: status, role: "body", weight: 800, size: sSize, color: bg, anchor: 0.5 });
    const w = label.width + sSize * 3.2;
    const h = sSize * 2.2;
    const holder = new Container();
    holder.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill(accent));
    const dot = new Graphics().circle(0, 0, sSize * 0.32).fill(bg);
    dot.x = -w / 2 + sSize * 1.1;
    holder.addChild(dot, label);
    label.x = sSize * 0.5;
    const sy = top - titleSize * 0.95;
    holder.position.set(cx, sy);
    holder.scale.set(0);
    root.addChild(holder);
    timeline
      .to(holder, { prop: "scale.x", from: 0, to: 1, start: 0.15, duration: 0.5, ease: outBack })
      .to(holder, { prop: "scale.y", from: 0, to: 1, start: 0.15, duration: 0.5, ease: outBack });
    pulse = holder;
  }

  // --- Place ---
  const t = makeText(fonts, { text: place, role: "display", weight: 800, size: titleSize, color: textColor, anchor: 0.5 });
  if (t.width > colW * 1.05) t.scale.set((colW * 1.05) / t.width);
  t.position.set(cx, top);
  t.alpha = 0;
  root.addChild(t);
  timeline
    .to(t, { prop: "alpha", from: 0, to: 1, start: TITLE_AT, duration: 0.4, ease: outQuad })
    .to(t, { prop: "y", from: top + titleSize * 0.28, to: top, start: TITLE_AT, duration: 0.75, ease: outExpo });

  // --- Days ---
  const listTop = top + titleSize * 1.1;
  rows.forEach((raw, i) => {
    const today = raw.startsWith("*");
    const clean = today ? raw.slice(1).trim() : raw;
    const [dayPart, hoursPart] = clean.split("|").map((s) => s.trim());
    const hours = hoursPart ?? "";
    const closed = /closed|geschlossen|zu/i.test(hours);
    const y = listTop + rowH * (i + 0.5);

    const row = new Container();
    row.position.set(0, y);
    root.addChild(row);

    // Today's row gets a lozenge behind it, which is the fastest way to answer
    // "are you open" without reading a single word.
    if (today) {
      row.addChild(
        new Graphics()
          .roundRect(left - rowSize * 0.6, -rowH * 0.42, colW + rowSize * 1.2, rowH * 0.84, rowH * 0.28)
          .fill({ color: accent, alpha: 0.14 }),
      );
    }

    const dayText = makeText(fonts, {
      text: dayPart ?? clean,
      role: "display",
      weight: today ? 800 : 600,
      size: rowSize,
      color: today ? accent : textColor,
      anchor: { x: 0, y: 0.5 },
    });
    dayText.alpha = closed && !today ? 0.42 : 1;
    dayText.position.set(left, 0);
    row.addChild(dayText);

    const hoursText = makeText(fonts, {
      text: hours,
      role: "body",
      weight: today ? 800 : 600,
      size: rowSize,
      color: today ? accent : textColor,
      anchor: { x: 1, y: 0.5 },
    });
    hoursText.alpha = closed ? (today ? 0.85 : 0.38) : today ? 1 : 0.8;
    hoursText.position.set(right, 0);
    row.addChild(hoursText);

    const at = FIRST_AT + i * PER_ROW;
    row.alpha = 0;
    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.3, ease: outQuad })
      .to(row, { prop: "x", from: -rowSize * 0.5, to: 0, start: at, duration: 0.65, ease: outExpo });
  });

  // --- Note ---
  if (note.length > 0) {
    const n = makeText(fonts, {
      text: note,
      role: "body",
      weight: 500,
      size: Math.round(rowSize * 0.74),
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    const ny = listTop + rowH * rows.length + rowSize * 1.15;
    n.alpha = 0;
    n.position.set(cx, ny);
    root.addChild(n);
    const at = FIRST_AT + rows.length * PER_ROW + 0.2;
    timeline
      .to(n, { prop: "alpha", from: 0, to: 0.6, start: at, duration: 0.5, ease: outQuad })
      .to(n, { prop: "y", from: ny + rowSize * 0.3, to: ny, start: at, duration: 0.8, ease: outQuint });
  }

  const update = (time: number): void => {
    if (!pulse) return;
    const p = 0.5 + 0.5 * Math.sin(time * 3.1);
    pulse.alpha = time < 0.15 ? 0 : 0.86 + p * 0.14;
  };
  update(0);

  return { timeline, duration: DURATION, update };
}

export const openingHours: TemplateDefinition = {
  id: "opening-hours",
  name: "Opening Hours",
  tagline: "The week as a list, today's row lifted, and an open-now pill that breathes.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: true,
  posterTime: 3.4,
  fontRoles: { place: "display", days: "display" },
  palettes: PALETTES,
  fields: [
    { key: "place", type: "text", label: "Place", default: "Studio Nord", maxLength: 30, shrinkToFit: true },
    {
      key: "days",
      type: "textlist",
      label: "Days — Day | Hours (* for today)",
      default: [
        "Mon | 8–17",
        "Tue | 8–17",
        "* Wed | 8–20",
        "Thu | 8–17",
        "Fri | 8–17",
        "Sat | 10–16",
        "Sun | Closed",
      ],
      minItems: 1,
      maxItems: 7,
      maxLength: 28,
    },
    { key: "status", type: "text", label: "Status pill", default: "Open now", maxLength: 20 },
    { key: "showStatus", type: "toggle", label: "Show status", default: true },
    { key: "note", type: "text", label: "Note", default: "Kitchen closes 30 min earlier", maxLength: 50, optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Today & status", default: "", optional: true },
  ],
  build,
};
