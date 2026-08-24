import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  makeOutBack,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(10, Math.floor((size0 * maxWidth) / w)) : size0;
}

const PALETTES: Palette[] = [
  { id: "daybreak", name: "Daybreak", colors: { background: "#EEF3F8", cardBg: "#FFFFFF", textColor: "#0E1B2A", accent: "#2E7DF6" } },
  { id: "night", name: "Night", colors: { background: "#0C1220", cardBg: "#161F33", textColor: "#EAF0FA", accent: "#5B8DEF" } },
  { id: "sunrise", name: "Sunrise", colors: { background: "#FFF2E8", cardBg: "#FFFFFF", textColor: "#2A1608", accent: "#FF7A3D" } },
  { id: "mint", name: "Mint", colors: { background: "#E9F6F0", cardBg: "#FFFFFF", textColor: "#0B241A", accent: "#12946A" } },
];

const DEFAULT_ZONES = ["New York|09:41", "London|14:41", "Tokyo|22:41", "Sydney|23:41"];
const DURATION = 4.2;

interface Zone {
  city: string;
  timeLabel: string;
  hourAngle: number;
  minuteAngle: number;
}

function parseZone(raw: string): Zone {
  const [cityRaw, timeRaw] = raw.split("|").map((s) => s.trim());
  const city = cityRaw && cityRaw.length > 0 ? cityRaw : "—";
  const m = (timeRaw ?? "").match(/^(\d{1,2}):(\d{2})$/);
  let hh = 10;
  let mm = 10;
  if (m) {
    hh = Math.max(0, Math.min(23, parseInt(m[1]!, 10)));
    mm = Math.max(0, Math.min(59, parseInt(m[2]!, 10)));
  }
  const timeLabel = timeRaw && /^\d{1,2}:\d{2}$/.test(timeRaw) ? timeRaw : "10:10";
  const hourFrac = (hh % 12) + mm / 60;
  return {
    city,
    timeLabel,
    hourAngle: (hourFrac / 12) * Math.PI * 2,
    minuteAngle: (mm / 60) * Math.PI * 2,
  };
}

function columnsFor(n: number, aspect: Aspect): number {
  if (aspect === "16:9") return n;
  return n === 4 ? 2 : n;
}

/** A hand pointing straight up (rotation 0 = 12 o'clock), pivoting at (0,0). */
function makeHand(len: number, width: number, color: string): Graphics {
  const stub = width * 1.4;
  return new Graphics().roundRect(-width / 2, -len, width, len + stub, width / 2).fill(color);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF3F8"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#0E1B2A"));
  const accent = str(values.accent, pc("accent", "#2E7DF6"));

  const title = str(values.title, "Meanwhile…");
  const zones = asList(values.zones, DEFAULT_ZONES).slice(0, 4).map(parseZone);
  const showTicks = on(values.showTicks);
  const showRing = on(values.showRing);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Title ---
  const titleFont = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.05), zone.width * 0.9);
  const titleH = titleFont * 1.3;
  const titleY = zone.y + titleFont * 0.7;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleFont, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.06, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 12, to: titleY, start: 0.06, duration: 0.5, ease: outCubic });

  // --- Clock grid ---
  const n = Math.max(1, zones.length);
  const cols = columnsFor(n, ctx.aspect);
  const rows = Math.ceil(n / cols);
  const colGap = minDim * 0.03;
  const rowGap = minDim * 0.04;
  const clocksTop = zone.y + titleH + minDim * 0.03;
  const clocksAreaH = zone.y + zone.height - clocksTop;
  const cellW = (zone.width - (cols - 1) * colGap) / cols;
  const cellH = (clocksAreaH - (rows - 1) * rowGap) / rows;

  const cityFont0 = Math.round(minDim * 0.026);
  const timeFont0 = Math.round(minDim * 0.03);
  const faceR = Math.max(
    minDim * 0.06,
    Math.min(cellW * 0.42, (cellH - (cityFont0 + timeFont0) * 1.4) * 0.42, minDim * 0.16),
  );

  zones.forEach((z, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Center the last (possibly short) row.
    const itemsInRow = Math.min(cols, n - row * cols);
    const rowW = itemsInRow * cellW + (itemsInRow - 1) * colGap;
    const rowLeft = cx - rowW / 2;
    const cellCx = rowLeft + col * (cellW + colGap) + cellW / 2;
    const cellCy = clocksTop + row * (cellH + rowGap) + cellH / 2;

    const cityFont = fitSize(fonts, z.city, "body", 600, cityFont0, cellW * 0.94);
    const timeFont = fitSize(fonts, z.timeLabel, "display", 700, timeFont0, cellW * 0.7);
    const labelGap = minDim * 0.018;
    const contentH = faceR * 2 + labelGap + cityFont * 1.15 + timeFont * 1.1;
    const faceCy = cellCy - contentH / 2 + faceR;

    // Clock face (pops in).
    const clock = new Container();
    clock.position.set(cellCx, faceCy);
    clock.scale.set(0);
    root.addChild(clock);
    // Soft shadow so a white face reads on a light background.
    clock.addChild(new Graphics().circle(0, faceR * 0.06, faceR).fill({ color: "#000000", alpha: 0.1 }));
    clock.addChild(new Graphics().circle(0, 0, faceR).fill(cardBg));
    if (showRing) {
      clock.addChild(new Graphics().circle(0, 0, faceR).stroke({ color: accent, width: Math.max(2, faceR * 0.045) }));
    }
    if (showTicks) {
      const tg = new Graphics();
      for (let t = 0; t < 12; t++) {
        const a = (t / 12) * Math.PI * 2;
        const rr = t % 3 === 0 ? faceR * 0.12 : faceR * 0.07;
        const r1 = faceR * 0.86;
        const r0 = r1 - rr;
        tg.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0).lineTo(Math.sin(a) * r1, -Math.cos(a) * r1);
      }
      tg.stroke({ color: textColor, width: Math.max(1.5, faceR * 0.03), cap: "round" });
      tg.alpha = 0.45;
      clock.addChild(tg);
    }

    // Hands (sweep in with a full extra turn so every clock "winds" to its time).
    const hour = makeHand(faceR * 0.52, Math.max(3, faceR * 0.09), textColor);
    const minute = makeHand(faceR * 0.76, Math.max(2.5, faceR * 0.06), textColor);
    clock.addChild(hour);
    clock.addChild(minute);
    clock.addChild(new Graphics().circle(0, 0, Math.max(3, faceR * 0.07)).fill(accent));

    const popStart = 0.28 + i * 0.1;
    timeline
      .to(clock, { prop: "scale.x", from: 0, to: 1, start: popStart, duration: 0.55, ease: makeOutBack(1.8) })
      .to(clock, { prop: "scale.y", from: 0, to: 1, start: popStart, duration: 0.55, ease: makeOutBack(1.8) });

    const sweepStart = popStart + 0.2;
    const turn = Math.PI * 2;
    hour.rotation = 0;
    minute.rotation = 0;
    timeline
      .to(hour, { prop: "rotation", from: 0, to: z.hourAngle + turn, start: sweepStart, duration: 0.9, ease: outCubic })
      .to(minute, { prop: "rotation", from: 0, to: z.minuteAngle + turn, start: sweepStart, duration: 0.9, ease: outCubic });

    // Labels.
    const cityY = faceCy + faceR + labelGap + cityFont * 0.5;
    const timeY = cityY + cityFont * 0.6 + timeFont * 0.55;
    const cityText = makeText(fonts, { text: z.city, role: "body", weight: 600, size: cityFont, color: textColor, anchor: 0.5, letterSpacing: 1 });
    cityText.position.set(cellCx, cityY);
    cityText.alpha = 0;
    root.addChild(cityText);
    const timeText = makeText(fonts, { text: z.timeLabel, role: "display", weight: 700, size: timeFont, color: textColor, anchor: 0.5 });
    timeText.position.set(cellCx, timeY);
    timeText.alpha = 0;
    root.addChild(timeText);
    timeline
      .to(cityText, { prop: "alpha", from: 0, to: 0.9, start: sweepStart + 0.1, duration: 0.4, ease: outQuad })
      .to(timeText, { prop: "alpha", from: 0, to: 1, start: sweepStart + 0.18, duration: 0.4, ease: outQuad });
  });

  return { timeline, duration: DURATION };
}

export const timeZones: TemplateDefinition = {
  id: "time-zones",
  name: "Time Zones",
  tagline: "Mini analog clocks pop in and sweep to each city's time.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { title: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Meanwhile…", maxLength: 26, shrinkToFit: true },
    {
      key: "zones",
      type: "textlist",
      label: "Zones",
      default: DEFAULT_ZONES,
      minItems: 2,
      maxItems: 4,
      maxLength: 22,
      help: 'One per line as "City|HH:MM", e.g. "Tokyo|22:41".',
    },
    { key: "showTicks", type: "toggle", label: "Clock ticks", default: true },
    { key: "showRing", type: "toggle", label: "Face ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
