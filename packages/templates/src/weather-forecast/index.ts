import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  makeOutBack,
  safeRect,
  type Aspect,
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

type Cond = "sun" | "partly" | "cloud" | "rain" | "storm";

function normalizeCond(v: string): Cond {
  if (v.startsWith("sun")) return "sun";
  if (v.startsWith("part")) return "partly";
  if (v.startsWith("rain")) return "rain";
  if (v.startsWith("storm") || v.startsWith("thunder")) return "storm";
  return "cloud";
}

const COND_LABELS: Record<Cond, string> = {
  sun: "Sunny",
  partly: "Partly cloudy",
  cloud: "Cloudy",
  rain: "Rainy",
  storm: "Stormy",
};

// Weather glyph colors are fixed (semantic — sun is always warm, rain always
// blue) regardless of the chosen brand palette; purely decorative graphics.
const SUN_COLOR = "#FFB020";
const CLOUD_COLOR = "#98A5B3";
const RAIN_COLOR = "#4C8DFF";
const BOLT_COLOR = "#FFCC33";

function drawCloud(g: Graphics, cx: number, cy: number, s: number, color: string): void {
  g.circle(cx - s * 0.32, cy + s * 0.06, s * 0.32).fill(color);
  g.circle(cx + s * 0.06, cy - s * 0.14, s * 0.4).fill(color);
  g.circle(cx + s * 0.42, cy + s * 0.08, s * 0.28).fill(color);
  g.roundRect(cx - s * 0.5, cy + s * 0.02, s * 1.0, s * 0.34, s * 0.17).fill(color);
}

function drawSun(g: Graphics, cx: number, cy: number, s: number, color: string, rays: boolean): void {
  g.circle(cx, cy, s * 0.34).fill(color);
  if (!rays) return;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r0 = s * 0.46;
    const r1 = s * 0.63;
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
      .lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
      .stroke({ color, width: Math.max(1.5, s * 0.045), cap: "round" });
  }
}

function drawRainDrops(g: Graphics, cx: number, cy: number, s: number, color: string): void {
  for (const ox of [-0.28, 0, 0.28]) {
    const x = cx + ox * s;
    g.moveTo(x, cy)
      .lineTo(x - s * 0.07, cy + s * 0.24)
      .stroke({ color, width: Math.max(1.5, s * 0.05), cap: "round" });
  }
}

function weatherGlyph(cond: Cond, s: number): Container {
  const c = new Container();
  const g = new Graphics();
  c.addChild(g);
  switch (cond) {
    case "sun":
      drawSun(g, 0, 0, s, SUN_COLOR, true);
      break;
    case "partly":
      drawSun(g, s * 0.16, -s * 0.16, s * 0.7, SUN_COLOR, false);
      drawCloud(g, -s * 0.05, s * 0.12, s * 0.86, CLOUD_COLOR);
      break;
    case "cloud":
      drawCloud(g, 0, 0, s, CLOUD_COLOR);
      break;
    case "rain":
      drawCloud(g, 0, -s * 0.16, s * 0.86, CLOUD_COLOR);
      drawRainDrops(g, 0, s * 0.28, s * 0.62, RAIN_COLOR);
      break;
    case "storm": {
      drawCloud(g, 0, -s * 0.18, s * 0.86, CLOUD_COLOR);
      const bolt = makeIcon("bolt", s * 0.4, { color: BOLT_COLOR });
      bolt.position.set(0, s * 0.2);
      c.addChild(bolt);
      break;
    }
  }
  return c;
}

interface DayForecast {
  day: string;
  cond: Cond;
  hi: string;
  lo: string;
}

function parseDay(raw: string): DayForecast {
  const parts = raw.split("|").map((s) => s.trim());
  const day = parts[0];
  const hi = parts[2];
  const lo = parts[3];
  return {
    day: day && day.length > 0 ? day : "—",
    cond: normalizeCond((parts[1] ?? "cloud").toLowerCase()),
    hi: hi && hi.length > 0 ? hi.replace("°", "") : "--",
    lo: lo && lo.length > 0 ? lo.replace("°", "") : "--",
  };
}

const DEFAULT_DAYS = ["Mon|sun|24|16", "Tue|partly|22|15", "Wed|cloud|19|13", "Thu|rain|17|12", "Fri|sun|23|15"];

function resolveDays(values: Values): DayForecast[] {
  return asList(values.days, DEFAULT_DAYS)
    .slice(0, 5)
    .map(parseDay);
}

const PALETTES: Palette[] = [
  { id: "clear-sky", name: "Clear sky", colors: { background: "#EAF4FF", cardColor: "#FFFFFF", textColor: "#0B2447", accent: "#2E7DF6" } },
  { id: "sunset-warm", name: "Sunset warm", colors: { background: "#FFF1E6", cardColor: "#FFFFFF", textColor: "#3A1500", accent: "#FF7A32" } },
  { id: "overcast-slate", name: "Overcast slate", colors: { background: "#EDEFF2", cardColor: "#FFFFFF", textColor: "#20242B", accent: "#5B6B7C" } },
  { id: "night-travel", name: "Night travel", colors: { background: "#10151F", cardColor: "#1B2230", textColor: "#F2F4F8", accent: "#4FC3F7" } },
];

function topFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.05;
    case "1:1":
      return 0.09;
    case "4:5":
      return 0.08;
    case "9:16":
      return 0.14;
  }
}

const DAYS_START = 0.75;
const DAY_STAGGER = 0.13;
const DURATION = 3.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EAF4FF"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#0B2447"));
  const accent = str(values.accent, pc("accent", "#2E7DF6"));

  const city = str(values.city, "Paris");
  const currentTemp = str(values.currentTemp, "22°");
  const currentCond = normalizeCond(str(values.condition, "sun"));
  const showDays = values.showDays !== false;
  const days = resolveDays(values);

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);
  const contentTop = zone.y + zone.height * topFrac(ctx.aspect);

  // --- City name ---
  const citySize0 = Math.round(minDim * 0.052);
  const citySize = fitSize(fonts, city, "display", 700, citySize0, zone.width * 0.86);
  const cityY = contentTop + citySize * 0.85;
  const cityText = makeText(fonts, { text: city, role: "display", weight: 700, size: citySize, color: textColor, anchor: 0.5, align: "center" });
  cityText.position.set(cx, cityY);
  cityText.alpha = 0;
  root.addChild(cityText);
  timeline
    .to(cityText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(cityText, { prop: "y", from: cityY - 14, to: cityY, start: 0, duration: 0.5, ease: outExpo });

  // --- Hero: big current temp + condition icon ---
  const heroY = cityY + citySize * 0.95;
  const tempSize0 = Math.round(minDim * 0.155);
  const tempSize = fitSize(fonts, currentTemp, "display", 700, tempSize0, zone.width * 0.62);
  const iconSize = minDim * 0.155;
  const tempText = makeText(fonts, { text: currentTemp, role: "display", weight: 700, size: tempSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  const pairGap = minDim * 0.028;
  const pairW = iconSize + pairGap + tempText.width;
  const pairLeft = cx - pairW / 2;
  const iconCx = pairLeft + iconSize / 2;
  const tempX = pairLeft + iconSize + pairGap;
  tempText.position.set(tempX, heroY);
  tempText.alpha = 0;
  tempText.scale.set(0.85);
  root.addChild(tempText);

  // Soft accent-tinted halo behind the hero icon (brand color, non-text).
  const halo = new Graphics().circle(0, 0, iconSize * 0.64).fill({ color: accent, alpha: 0.16 });
  halo.position.set(iconCx, heroY);
  halo.alpha = 0;
  halo.scale.set(0.6);
  root.addChild(halo);

  const iconNode = weatherGlyph(currentCond, iconSize);
  iconNode.position.set(iconCx, heroY);
  iconNode.alpha = 0;
  iconNode.scale.set(0.7);
  root.addChild(iconNode);

  timeline
    .to(tempText, { prop: "alpha", from: 0, to: 1, start: 0.22, duration: 0.4, ease: outQuad })
    .to(tempText, { prop: "scale.x", from: 0.85, to: 1, start: 0.22, duration: 0.5, ease: makeOutBack(1.6) })
    .to(tempText, { prop: "scale.y", from: 0.85, to: 1, start: 0.22, duration: 0.5, ease: makeOutBack(1.6) })
    .to(halo, { prop: "alpha", from: 0, to: 1, start: 0.24, duration: 0.4, ease: outQuad })
    .to(halo, { prop: "scale.x", from: 0.6, to: 1, start: 0.24, duration: 0.6, ease: outExpo })
    .to(halo, { prop: "scale.y", from: 0.6, to: 1, start: 0.24, duration: 0.6, ease: outExpo })
    .to(iconNode, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outQuad })
    .to(iconNode, { prop: "scale.x", from: 0.7, to: 1, start: 0.3, duration: 0.55, ease: makeOutBack(2) })
    .to(iconNode, { prop: "scale.y", from: 0.7, to: 1, start: 0.3, duration: 0.55, ease: makeOutBack(2) });

  // --- Condition word ---
  const condSize = Math.round(minDim * 0.03);
  const condY = heroY + tempSize * 0.62;
  const condText = makeText(fonts, { text: COND_LABELS[currentCond], role: "body", weight: 600, size: condSize, color: textColor, anchor: 0.5, letterSpacing: 1 });
  condText.position.set(cx, condY);
  condText.alpha = 0;
  root.addChild(condText);
  timeline
    .to(condText, { prop: "alpha", from: 0, to: 0.82, start: 0.5, duration: 0.4, ease: outQuad })
    .to(condText, { prop: "y", from: condY + 8, to: condY, start: 0.5, duration: 0.4, ease: outQuint });

  // --- Day cards row (optional) ---
  if (showDays) {
    const n = Math.max(1, days.length);
    const rowTop = condY + condSize * 0.9 + minDim * 0.06;
    const cardGap = minDim * 0.02;
    const cardWmax = minDim * 0.175;
    const cardW = Math.min(cardWmax, (zone.width - (n - 1) * cardGap) / n);
    const cardH = cardW * 1.4;
    const totalRowW = n * cardW + (n - 1) * cardGap;
    const rowLeft = cx - totalRowW / 2;

    const dayFont = Math.round(cardW * 0.15);
    const glyphSize = cardW * 0.46;
    const tempFont = Math.round(cardW * 0.135);

    days.forEach((d, i) => {
      const ccx = rowLeft + i * (cardW + cardGap) + cardW / 2;
      const ccy = rowTop + cardH / 2;

      const card = new Container();
      card.position.set(ccx, ccy);
      card.scale.set(0);
      root.addChild(card);

      card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardW * 0.14).fill(cardColor));

      const dayLabel = makeText(fonts, { text: d.day.slice(0, 3).toUpperCase(), role: "body", weight: 700, size: dayFont, color: textColor, anchor: 0.5, letterSpacing: 1 });
      dayLabel.position.set(0, -cardH * 0.32);
      card.addChild(dayLabel);

      const glyph = weatherGlyph(d.cond, glyphSize);
      glyph.position.set(0, -cardH * 0.02);
      card.addChild(glyph);

      const hiLoLabel = `${d.hi}°/${d.lo}°`;
      const hiLoFont = fitSize(fonts, hiLoLabel, "body", 600, tempFont, cardW * 0.92);
      const hiLoText = makeText(fonts, { text: hiLoLabel, role: "body", weight: 600, size: hiLoFont, color: textColor, anchor: 0.5 });
      hiLoText.position.set(0, cardH * 0.34);
      card.addChild(hiLoText);

      const start = DAYS_START + i * DAY_STAGGER;
      timeline
        .to(card, { prop: "scale.x", from: 0, to: 1, start, duration: 0.55, ease: makeOutBack(1.9) })
        .to(card, { prop: "scale.y", from: 0, to: 1, start, duration: 0.55, ease: makeOutBack(1.9) });
    });
  }

  return { timeline, duration: DURATION };
}

export const weatherForecast: TemplateDefinition = {
  id: "weather-forecast",
  name: "Weather Forecast",
  tagline: "A trip weather card with a big current temp and a day-by-day row.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { city: "display" },
  palettes: PALETTES,
  fields: [
    { key: "city", type: "text", label: "City", default: "Paris", maxLength: 24, shrinkToFit: true },
    { key: "currentTemp", type: "text", label: "Current temp", default: "22°", maxLength: 6 },
    {
      key: "condition",
      type: "select",
      label: "Current condition",
      default: "sun",
      options: [
        { value: "sun", label: "Sunny" },
        { value: "partly", label: "Partly cloudy" },
        { value: "cloud", label: "Cloudy" },
        { value: "rain", label: "Rainy" },
        { value: "storm", label: "Stormy" },
      ],
    },
    {
      key: "days",
      type: "textlist",
      label: "Forecast days",
      default: DEFAULT_DAYS,
      minItems: 4,
      maxItems: 5,
      maxLength: 20,
      help: 'One per line as "day|condition|hi|lo", e.g. "Mon|sun|24|16".',
    },
    { key: "showDays", type: "toggle", label: "Day-by-day row", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
