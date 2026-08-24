import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inOutQuint,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Project Index — a numbered contents list where a marker travels down the
// rows, lifting each project in turn while the rest sit back. The portfolio
// post that reads like the index page of a book.
//
// `feature-tabs` switches panels; `tips-stack` piles lines up and leaves them.
// Here exactly one row is ever active, and the travelling rule is what carries
// the eye — so the list stays readable at eight entries where a stack would not.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#F4F2ED", textColor: "#141414", accent: "#B4472B" } },
  { id: "ink", name: "Ink", colors: { background: "#101114", textColor: "#F5F4F1", accent: "#D8C48A" } },
  { id: "navy", name: "Navy", colors: { background: "#0E1626", textColor: "#EDF1F9", accent: "#5AA9FF" } },
  { id: "moss", name: "Moss", colors: { background: "#101A14", textColor: "#EDF5EF", accent: "#7FC99A" } },
];

interface Layout {
  rowFrac: number;
  widthFrac: number;
  topFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { rowFrac: 0.038, widthFrac: 0.62, topFrac: 0.22 };
    case "9:16":
      return { rowFrac: 0.05, widthFrac: 0.84, topFrac: 0.22 };
    case "4:5":
      return { rowFrac: 0.046, widthFrac: 0.82, topFrac: 0.21 };
    case "1:1":
    default:
      return { rowFrac: 0.044, widthFrac: 0.8, topFrac: 0.22 };
  }
}

const HEAD_AT = 0.2;
const FIRST_AT = 0.75;
const PER_ROW = 0.7;

function durationFor(count: number): number {
  return Math.min(14, FIRST_AT + Math.max(1, count) * PER_ROW + 1.1);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2ED"));
  const textColor = str(values.textColor, pc("textColor", "#141414"));
  const accent = str(values.accent, pc("accent", "#B4472B"));
  const heading = str(values.heading, "Selected work");
  const rows = (Array.isArray(values.projects) ? (values.projects as unknown[]) : [])
    .map((v) => String(v ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 8);
  const footer = str(values.footer, "").trim();
  const showRules = on(values.showRules);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const rowSize = Math.round(size.width * L.rowFrac);
  const colW = size.width * L.widthFrac;
  const left = cx - colW / 2;
  const right = cx + colW / 2;
  const rowH = rowSize * 2.5;
  const top = size.height * L.topFrac;

  const timeline = new JimaTimeline();
  const duration = durationFor(rows.length);

  // --- Heading ---
  const headSize = Math.round(rowSize * 1.5);
  const h = makeText(fonts, {
    text: heading.toUpperCase(),
    role: "body",
    weight: 800,
    size: headSize * 0.42,
    color: accent,
    anchor: { x: 0, y: 0.5 },
    letterSpacing: headSize * 0.08,
  });
  h.position.set(left, top);
  h.alpha = 0;
  root.addChild(h);
  timeline
    .to(h, { prop: "alpha", from: 0, to: 1, start: HEAD_AT, duration: 0.4, ease: outQuad })
    .to(h, { prop: "x", from: left - rowSize * 0.4, to: left, start: HEAD_AT, duration: 0.75, ease: outExpo });

  const listTop = top + rowSize * 1.3;

  // --- Travelling marker behind the active row ---
  const marker = new Graphics()
    .roundRect(left - rowSize * 0.5, -rowH * 0.42, colW + rowSize, rowH * 0.84, rowH * 0.2)
    .fill({ color: accent, alpha: 0.12 });
  marker.alpha = 0;
  root.addChild(marker);
  rows.forEach((_, i) => {
    const y = listTop + rowH * (i + 0.5);
    const at = FIRST_AT + i * PER_ROW;
    timeline.to(marker, { prop: "y", from: i === 0 ? y : listTop + rowH * (i - 0.5), to: y, start: at, duration: 0.5, ease: inOutQuint });
    if (i === 0) timeline.to(marker, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.3, ease: outQuad });
  });

  // --- Rows ---
  rows.forEach((raw, i) => {
    const [namePart, metaPart] = raw.split("|").map((s) => s.trim());
    const y = listTop + rowH * (i + 0.5);
    const row = new Container();
    row.position.set(0, y);
    root.addChild(row);

    const numText = makeText(fonts, {
      text: String(i + 1).padStart(2, "0"),
      role: "mono",
      weight: 700,
      size: rowSize * 0.66,
      color: accent,
      anchor: { x: 0, y: 0.5 },
    });
    numText.position.set(left, 0);
    row.addChild(numText);

    const nameText = makeText(fonts, {
      text: namePart ?? raw,
      role: "display",
      weight: 700,
      size: rowSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    nameText.position.set(left + rowSize * 2, 0);
    row.addChild(nameText);

    if (metaPart) {
      const m = makeText(fonts, {
        text: metaPart,
        role: "body",
        weight: 500,
        size: rowSize * 0.62,
        color: textColor,
        anchor: { x: 1, y: 0.5 },
      });
      m.alpha = 0.5;
      m.position.set(right, 0);
      row.addChild(m);
    }

    if (showRules) {
      const ruleH = Math.max(1, size.width * 0.001);
      const rule = new Graphics().rect(left, rowH * 0.42, colW, ruleH).fill({ color: textColor, alpha: 0.14 });
      rule.scale.x = 0;
      row.addChild(rule);
      timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: FIRST_AT * 0.6 + i * 0.07, duration: 0.6, ease: outExpo });
    }

    // Rows arrive dim and lift as the marker reaches them, so exactly one is
    // ever bright — the reason this reads as an index and not a menu.
    row.alpha = 0;
    const at = FIRST_AT + i * PER_ROW;
    timeline
      .to(row, { prop: "alpha", from: 0, to: 0.42, start: FIRST_AT * 0.7 + i * 0.09, duration: 0.4, ease: outQuad })
      .to(row, { prop: "alpha", from: 0.42, to: 1, start: at, duration: 0.35, ease: outQuad })
      .to(row, { prop: "x", from: -rowSize * 0.3, to: 0, start: at, duration: 0.6, ease: outExpo });
    if (i < rows.length - 1) {
      timeline.to(row, { prop: "alpha", from: 1, to: 0.42, start: at + PER_ROW - 0.2, duration: 0.35, ease: outQuad });
    }
  });

  // --- Footer ---
  if (footer.length > 0) {
    const f = makeText(fonts, {
      text: footer,
      role: "body",
      weight: 600,
      size: rowSize * 0.6,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    const fy = listTop + rowH * rows.length + rowSize * 1.1;
    f.alpha = 0;
    f.position.set(left, fy);
    root.addChild(f);
    timeline.to(f, { prop: "alpha", from: 0, to: 0.55, start: FIRST_AT + rows.length * PER_ROW * 0.5, duration: 0.6, ease: outQuad });
  }

  return { timeline, duration };
}

export const projectIndex: TemplateDefinition = {
  id: "project-index",
  name: "Project Index",
  tagline: "A numbered contents list, with a marker travelling down and lifting each row.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { projects: "display", heading: "body" },
  palettes: PALETTES,
  fields: [
    { key: "heading", type: "text", label: "Heading", default: "Selected work", maxLength: 30 },
    {
      key: "projects",
      type: "textlist",
      label: "Projects — Name | Meta",
      default: [
        "Fika Coffee | Identity, 2025",
        "Nord Studio | Website, 2025",
        "Marea | Packaging, 2024",
        "Hallon | Campaign, 2024",
      ],
      minItems: 1,
      maxItems: 8,
      maxLength: 48,
    },
    { key: "footer", type: "text", label: "Footer", default: "Full portfolio in bio", maxLength: 40, optional: true },
    { key: "showRules", type: "toggle", label: "Row rules", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  estimateDuration: (v) => durationFor(Array.isArray(v.projects) ? (v.projects as unknown[]).length : 4),
  build,
};
