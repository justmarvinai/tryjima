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
import { makeIcon, type IconName } from "../shared/icons";

// Trust Badges — the row of reassurances that goes under every checkout
// button: free returns, secure payment, made here, ships in 24h. They stamp in
// one at a time, each with a drawn tick, so the reassurance accumulates.
//
// Rows are "Label | icon"; the icon name is optional and falls back to a tick.
// Nothing in the library covered objection-handling, which is most of what a
// small shop's feed is actually doing.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#F6F5F1", textColor: "#15161A", accent: "#0F9D6E" } },
  { id: "ink", name: "Ink", colors: { background: "#111216", textColor: "#F4F5F7", accent: "#4ADE80" } },
  { id: "sand", name: "Sand", colors: { background: "#F8F2E8", textColor: "#1E1810", accent: "#B45309" } },
  { id: "sky", name: "Sky", colors: { background: "#EFF4FB", textColor: "#101A26", accent: "#2563EB" } },
];

const ICONS: Record<string, IconName> = {
  check: "check",
  star: "star",
  bolt: "bolt",
  heart: "heart",
  cart: "cart",
  plane: "plane",
  pin: "pin",
  bookmark: "bookmark",
  user: "user",
};

interface Layout {
  titleFrac: number;
  itemFrac: number;
  widthFrac: number;
  topFrac: number;
  cols: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { titleFrac: 0.05, itemFrac: 0.024, widthFrac: 0.74, topFrac: 0.26, cols: 4 };
    case "9:16":
      return { titleFrac: 0.066, itemFrac: 0.034, widthFrac: 0.84, topFrac: 0.26, cols: 2 };
    case "4:5":
      return { titleFrac: 0.06, itemFrac: 0.031, widthFrac: 0.82, topFrac: 0.25, cols: 2 };
    case "1:1":
    default:
      return { titleFrac: 0.06, itemFrac: 0.03, widthFrac: 0.8, topFrac: 0.26, cols: 2 };
  }
}

const TITLE_AT = 0.2;
const FIRST_AT = 0.7;
const PER_BADGE = 0.24;
const DURATION = 5.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F6F5F1"));
  const textColor = str(values.textColor, pc("textColor", "#15161A"));
  const accent = str(values.accent, pc("accent", "#0F9D6E"));
  const title = str(values.title, "Why people buy from us");
  const rows = (Array.isArray(values.badges) ? (values.badges as unknown[]) : [])
    .map((v) => String(v ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 6);
  const footer = str(values.footer, "").trim();
  const showDiscs = on(values.showDiscs);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const titleSize = Math.round(size.width * L.titleFrac);
  const itemSize = Math.round(size.width * L.itemFrac);
  const colW = size.width * L.widthFrac;
  const cols = L.cols;
  const gapX = colW * 0.05;
  const cellW = (colW - gapX * (cols - 1)) / cols;
  const cellH = itemSize * 5.4;
  const top = size.height * L.topFrac;

  const timeline = new JimaTimeline();

  // --- Title ---
  const t = makeText(fonts, { text: title, role: "display", weight: 800, size: titleSize, color: textColor, anchor: 0.5 });
  if (t.width > colW) t.scale.set(colW / t.width);
  t.position.set(cx, top);
  t.alpha = 0;
  root.addChild(t);
  timeline
    .to(t, { prop: "alpha", from: 0, to: 1, start: TITLE_AT, duration: 0.4, ease: outQuad })
    .to(t, { prop: "y", from: top + titleSize * 0.3, to: top, start: TITLE_AT, duration: 0.75, ease: outExpo });

  // --- Badges ---
  const listTop = top + titleSize * 1.3;
  rows.forEach((raw, i) => {
    const [labelPart, iconPart] = raw.split("|").map((s) => s.trim());
    const iconName = ICONS[(iconPart ?? "").toLowerCase()] ?? "check";
    const col = i % cols;
    const rowIdx = Math.floor(i / cols);
    const x = cx - colW / 2 + (cellW + gapX) * col + cellW / 2;
    const y = listTop + cellH * rowIdx + cellH / 2;

    const cell = new Container();
    cell.position.set(x, y);
    root.addChild(cell);

    const discR = itemSize * 1.5;
    if (showDiscs) {
      cell.addChild(new Graphics().circle(0, -itemSize * 0.9, discR).fill({ color: accent, alpha: 0.12 }));
      cell.addChild(
        new Graphics()
          .circle(0, -itemSize * 0.9, discR)
          .stroke({ color: accent, width: Math.max(2, size.width * 0.0018), alpha: 0.5 }),
      );
    }

    const icon = makeIcon(iconName, discR * 1.05, { color: accent, holeColor: bg });
    icon.position.set(0, -itemSize * 0.9);
    cell.addChild(icon);

    // Wrap the label to two lines rather than shrinking it into illegibility.
    const measure = (s: string) => fonts.measure(s, { family: fonts.family("body"), weight: 700, size: itemSize });
    const words = (labelPart ?? raw).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (measure(next) <= cellW * 0.94 || !cur) cur = next;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    lines.slice(0, 2).forEach((line, li) => {
      const lt = makeText(fonts, {
        text: line,
        role: "body",
        weight: 700,
        size: itemSize,
        color: textColor,
        anchor: 0.5,
      });
      lt.position.set(0, itemSize * (1.5 + li * 1.24));
      cell.addChild(lt);
    });

    const at = FIRST_AT + i * PER_BADGE;
    cell.alpha = 0;
    timeline
      .to(cell, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.32, ease: outQuad })
      .to(cell, { prop: "y", from: y + itemSize * 0.9, to: y, start: at, duration: 0.7, ease: outExpo });
    timeline
      .to(icon, { prop: "scale.x", from: 0.2, to: 1, start: at + 0.08, duration: 0.55, ease: outBack })
      .to(icon, { prop: "scale.y", from: 0.2, to: 1, start: at + 0.08, duration: 0.55, ease: outBack });
  });

  // --- Footer ---
  if (footer.length > 0) {
    const gridRows = Math.ceil(rows.length / cols);
    const f = makeText(fonts, {
      text: footer,
      role: "body",
      weight: 600,
      size: itemSize * 0.94,
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    const fy = listTop + cellH * gridRows + itemSize * 0.6;
    f.alpha = 0;
    f.position.set(cx, fy);
    root.addChild(f);
    const at = FIRST_AT + rows.length * PER_BADGE + 0.2;
    timeline
      .to(f, { prop: "alpha", from: 0, to: 0.62, start: at, duration: 0.5, ease: outQuad })
      .to(f, { prop: "y", from: fy + itemSize * 0.4, to: fy, start: at, duration: 0.8, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const trustBadges: TemplateDefinition = {
  id: "trust-badges",
  name: "Trust Badges",
  tagline: "Free returns, secure payment, ships fast — the reassurances stamp in one by one.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { title: "display", badges: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Heading", default: "Why people buy from us", maxLength: 40, shrinkToFit: true },
    {
      key: "badges",
      type: "textlist",
      label: "Badges — Label | icon",
      default: ["Free 30-day returns | check", "Secure payment | bookmark", "Ships in 24 hours | plane", "Made in Lisbon | pin"],
      minItems: 1,
      maxItems: 6,
      maxLength: 34,
      help: "Icons: check, star, bolt, heart, cart, plane, pin, bookmark, user.",
    },
    { key: "footer", type: "text", label: "Footer", default: "4.9 ★ from 2,100 orders", maxLength: 44, optional: true },
    { key: "showDiscs", type: "toggle", label: "Icon discs", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Icons", default: "", optional: true },
  ],
  build,
};
