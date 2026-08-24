import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { dashedPath } from "../shared/ui";

// Menu Board — a café list: item on the left, price on the right, joined by a
// leader of dots, with a section heading and a "today only" flag on one line.
// The oldest and best-solved typographic problem in hospitality.
//
// Rows are "Item | 4.50" and a leading `*` stars a row. `event-menu` is a
// three-course dinner card for an event; this is a price list you post weekly.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "chalk", name: "Chalk", colors: { background: "#171A18", textColor: "#F3F1E9", accent: "#E4B33C" } },
  { id: "kraft", name: "Kraft", colors: { background: "#EFE3D0", textColor: "#241B10", accent: "#9A4A22" } },
  { id: "olive", name: "Olive", colors: { background: "#EFF1E6", textColor: "#1B2013", accent: "#5C6B2F" } },
  { id: "espresso", name: "Espresso", colors: { background: "#1B1310", textColor: "#F6ECE1", accent: "#D98E4A" } },
];

interface Layout {
  headingFrac: number;
  rowFrac: number;
  widthFrac: number;
  topFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { headingFrac: 0.05, rowFrac: 0.03, widthFrac: 0.56, topFrac: 0.2 };
    case "9:16":
      return { headingFrac: 0.068, rowFrac: 0.04, widthFrac: 0.8, topFrac: 0.2 };
    case "4:5":
      return { headingFrac: 0.062, rowFrac: 0.037, widthFrac: 0.78, topFrac: 0.19 };
    case "1:1":
    default:
      return { headingFrac: 0.062, rowFrac: 0.036, widthFrac: 0.76, topFrac: 0.2 };
  }
}

const HEAD_AT = 0.2;
const FIRST_AT = 0.75;
const PER_ROW = 0.18;

function durationFor(count: number): number {
  return Math.min(12, FIRST_AT + Math.max(1, count) * PER_ROW + 1.8);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#171A18"));
  const textColor = str(values.textColor, pc("textColor", "#F3F1E9"));
  const accent = str(values.accent, pc("accent", "#E4B33C"));
  const heading = str(values.heading, "Coffee");
  const place = str(values.place, "").trim();
  const rows = (Array.isArray(values.items) ? (values.items as unknown[]) : [])
    .map((v) => String(v ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 8);
  const footer = str(values.footer, "").trim();
  const showRule = on(values.showRule);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const headingSize = Math.round(size.width * L.headingFrac);
  const rowSize = Math.round(size.width * L.rowFrac);
  const colW = size.width * L.widthFrac;
  const left = cx - colW / 2;
  const right = cx + colW / 2;
  const rowH = rowSize * 2.35;
  const top = size.height * L.topFrac;

  const timeline = new JimaTimeline();
  const duration = durationFor(rows.length);

  // --- Heading ---
  if (place.length > 0) {
    const pSize = Math.round(headingSize * 0.26);
    const p = makeText(fonts, {
      text: place.toUpperCase(),
      role: "body",
      weight: 800,
      size: pSize,
      color: accent,
      anchor: 0.5,
      letterSpacing: pSize * 0.22,
    });
    const py = top - headingSize * 0.7;
    p.alpha = 0;
    p.position.set(cx, py);
    root.addChild(p);
    timeline
      .to(p, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.4, ease: outQuad })
      .to(p, { prop: "y", from: py + pSize, to: py, start: 0.1, duration: 0.7, ease: outExpo });
  }

  const h = makeText(fonts, { text: heading, role: "serif", weight: 600, size: headingSize, color: textColor, anchor: 0.5 });
  if (h.width > colW) h.scale.set(colW / h.width);
  h.position.set(cx, top);
  h.alpha = 0;
  root.addChild(h);
  timeline
    .to(h, { prop: "alpha", from: 0, to: 1, start: HEAD_AT, duration: 0.45, ease: outQuad })
    .to(h, { prop: "y", from: top + headingSize * 0.28, to: top, start: HEAD_AT, duration: 0.8, ease: outExpo });

  if (showRule) {
    const ruleH = Math.max(2, size.width * 0.0018);
    const rule = new Graphics().rect(-colW / 2, -ruleH / 2, colW, ruleH).fill(accent);
    rule.position.set(cx, top + headingSize * 0.72);
    rule.scale.x = 0;
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: HEAD_AT + 0.25, duration: 0.7, ease: outExpo });
  }

  // --- Rows ---
  const listTop = top + headingSize * 1.15;
  rows.forEach((raw, i) => {
    const starred = raw.startsWith("*");
    const clean = starred ? raw.slice(1).trim() : raw;
    const [namePart, pricePart] = clean.split("|").map((s) => s.trim());
    const y = listTop + rowH * (i + 0.5);

    const row = new Container();
    row.position.set(0, y);
    root.addChild(row);

    const nameText = makeText(fonts, {
      text: namePart ?? clean,
      role: "body",
      weight: starred ? 700 : 500,
      size: rowSize,
      color: starred ? accent : textColor,
      anchor: { x: 0, y: 0.5 },
    });
    nameText.position.set(left, 0);
    row.addChild(nameText);

    const priceText = makeText(fonts, {
      text: pricePart ?? "",
      role: "body",
      weight: 700,
      size: rowSize,
      color: starred ? accent : textColor,
      anchor: { x: 1, y: 0.5 },
    });
    priceText.position.set(right, 0);
    row.addChild(priceText);

    // Dot leader between the two — the thing that makes a price list a menu.
    const dotFrom = left + nameText.width + rowSize * 0.5;
    const dotTo = right - priceText.width - rowSize * 0.5;
    if (dotTo > dotFrom) {
      const g = new Graphics();
      dashedPath(g, [dotFrom, 0, dotTo, 0], {
        dash: Math.max(2, rowSize * 0.07),
        gap: rowSize * 0.28,
        width: Math.max(2, rowSize * 0.07),
        color: textColor,
        cap: "round",
      });
      g.alpha = 0.32;
      row.addChild(g);
    }

    if (starred) {
      const flag = makeText(fonts, {
        text: "today",
        role: "body",
        weight: 800,
        size: rowSize * 0.5,
        color: bg,
        anchor: 0.5,
      });
      const w = flag.width + rowSize * 0.8;
      const hh = rowSize * 1.1;
      const chip = new Container();
      chip.addChild(new Graphics().roundRect(-w / 2, -hh / 2, w, hh, hh / 2).fill(accent), flag);
      chip.position.set(left - w * 0.62, 0);
      row.addChild(chip);
    }

    const at = FIRST_AT + i * PER_ROW;
    row.alpha = 0;
    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.35, ease: outQuad })
      .to(row, { prop: "y", from: y + rowH * 0.4, to: y, start: at, duration: 0.7, ease: outExpo });
  });

  // --- Footer ---
  if (footer.length > 0) {
    const f = makeText(fonts, {
      text: footer,
      role: "body",
      weight: 500,
      size: Math.round(rowSize * 0.72),
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    const fy = listTop + rowH * rows.length + rowSize * 1.2;
    f.alpha = 0;
    f.position.set(cx, fy);
    root.addChild(f);
    const at = FIRST_AT + rows.length * PER_ROW + 0.2;
    timeline
      .to(f, { prop: "alpha", from: 0, to: 0.6, start: at, duration: 0.5, ease: outQuad })
      .to(f, { prop: "y", from: fy + rowSize * 0.3, to: fy, start: at, duration: 0.8, ease: outQuint });
  }

  return { timeline, duration };
}

export const menuBoard: TemplateDefinition = {
  id: "menu-board",
  name: "Menu Board",
  tagline: "Item, dot leader, price — a café list that sets itself line by line.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { heading: "serif", items: "body" },
  palettes: PALETTES,
  fields: [
    { key: "place", type: "text", label: "Kicker", default: "Studio Nord", maxLength: 26, optional: true },
    { key: "heading", type: "text", label: "Section", default: "Coffee", maxLength: 26, shrinkToFit: true },
    {
      key: "items",
      type: "textlist",
      label: "Items — Name | Price (* to star)",
      default: ["Filter | 3.20", "Flat white | 4.10", "* Cardamom bun | 4.50", "Cortado | 3.60", "Iced latte | 4.40"],
      minItems: 1,
      maxItems: 8,
      maxLength: 40,
    },
    { key: "footer", type: "text", label: "Footer", default: "Oat milk, no charge", maxLength: 48, optional: true },
    { key: "showRule", type: "toggle", label: "Rule under heading", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  estimateDuration: (v) => durationFor(Array.isArray(v.items) ? (v.items as unknown[]).length : 5),
  build,
};
