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
import { avatar } from "../shared/ui";

// Shoutout — a thank-you roll: handles arrive one at a time with their avatar,
// each landing with a small pop, under a heading. The community post every
// account owes its regulars.
//
// `avatar-stack` overlaps faces into a clump to say "and 200 others". This
// names people, one row at a time, which is the point of a shoutout.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "warm", name: "Warm", colors: { background: "#16120E", textColor: "#FBF4EA", accent: "#F59E0B" } },
  { id: "rose", name: "Rose", colors: { background: "#170F13", textColor: "#FBEFF3", accent: "#FB7185" } },
  { id: "mint", name: "Mint", colors: { background: "#0D1815", textColor: "#EAF7F2", accent: "#34D399" } },
  { id: "paper", name: "Paper", colors: { background: "#F7F5F0", textColor: "#16171B", accent: "#6D3BE4" } },
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
      return { headingFrac: 0.05, rowFrac: 0.03, widthFrac: 0.5, topFrac: 0.24 };
    case "9:16":
      return { headingFrac: 0.068, rowFrac: 0.042, widthFrac: 0.78, topFrac: 0.24 };
    case "4:5":
      return { headingFrac: 0.062, rowFrac: 0.039, widthFrac: 0.76, topFrac: 0.23 };
    case "1:1":
    default:
      return { headingFrac: 0.062, rowFrac: 0.038, widthFrac: 0.72, topFrac: 0.24 };
  }
}

const HEAD_AT = 0.2;
const FIRST_AT = 0.8;
const PER_ROW = 0.28;

function durationFor(count: number): number {
  return Math.min(11, FIRST_AT + Math.max(1, count) * PER_ROW + 1.5);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#16120E"));
  const textColor = str(values.textColor, pc("textColor", "#FBF4EA"));
  const accent = str(values.accent, pc("accent", "#F59E0B"));
  const heading = str(values.heading, "Thank you");
  const handles = (Array.isArray(values.handles) ? (values.handles as unknown[]) : [])
    .map((v) => String(v ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 7);
  const footer = str(values.footer, "").trim();
  const showAvatars = on(values.showAvatars);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const headingSize = Math.round(size.width * L.headingFrac);
  const rowSize = Math.round(size.width * L.rowFrac);
  const rowH = rowSize * 2.25;
  const colW = size.width * L.widthFrac;
  const top = size.height * L.topFrac;

  const timeline = new JimaTimeline();
  const duration = durationFor(handles.length);

  // --- Heading with an accent rule under it ---
  const h = makeText(fonts, {
    text: heading,
    role: "display",
    weight: 800,
    size: headingSize,
    color: textColor,
    anchor: 0.5,
  });
  if (h.width > colW) h.scale.set(colW / h.width);
  h.position.set(cx, top);
  h.alpha = 0;
  root.addChild(h);
  timeline
    .to(h, { prop: "alpha", from: 0, to: 1, start: HEAD_AT, duration: 0.45, ease: outQuad })
    .to(h, { prop: "y", from: top + headingSize * 0.35, to: top, start: HEAD_AT, duration: 0.8, ease: outExpo });

  const ruleW = headingSize * 1.8;
  const ruleH = Math.max(3, size.width * 0.004);
  const rule = new Graphics().rect(-ruleW / 2, -ruleH / 2, ruleW, ruleH).fill(accent);
  rule.position.set(cx, top + headingSize * 0.85);
  rule.scale.x = 0;
  root.addChild(rule);
  timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: HEAD_AT + 0.25, duration: 0.6, ease: outExpo });

  // --- The roll ---
  const listTop = top + headingSize * 1.5;
  handles.forEach((handle, i) => {
    const y = listTop + rowH * (i + 0.5);
    const row = new Container();
    row.position.set(cx, y);
    root.addChild(row);

    const label = handle.startsWith("@") ? handle : `@${handle}`;
    const t = makeText(fonts, {
      text: label,
      role: "display",
      weight: 700,
      size: rowSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });

    const avR = rowSize * 0.72;
    const gap = rowSize * 0.6;
    const totalW = (showAvatars ? avR * 2 + gap : 0) + t.width;
    let x = -totalW / 2;

    if (showAvatars) {
      const av = avatar(fonts, {
        radius: avR,
        bg: `hsl(${Math.round(rng.range(0, 360))}, 62%, 58%)`,
        initial: label.replace("@", "").slice(0, 1).toUpperCase(),
        textColor: bg,
        ring: { color: accent, width: Math.max(2, rowSize * 0.07) },
      });
      av.position.set(x + avR, 0);
      row.addChild(av);
      x += avR * 2 + gap;
    }
    t.position.set(x, 0);
    row.addChild(t);

    const at = FIRST_AT + i * PER_ROW;
    row.alpha = 0;
    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.32, ease: outQuad })
      .to(row, { prop: "y", from: y + rowH * 0.55, to: y, start: at, duration: 0.7, ease: outExpo })
      .to(row, { prop: "scale.x", from: 0.82, to: 1, start: at, duration: 0.6, ease: outBack })
      .to(row, { prop: "scale.y", from: 0.82, to: 1, start: at, duration: 0.6, ease: outBack });
  });

  // --- Footer ---
  if (footer.length > 0) {
    const f = makeText(fonts, {
      text: footer,
      role: "body",
      weight: 500,
      size: Math.round(rowSize * 0.78),
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    const fy = listTop + rowH * handles.length + rowSize * 1.1;
    f.alpha = 0;
    f.position.set(cx, fy);
    root.addChild(f);
    const at = FIRST_AT + handles.length * PER_ROW + 0.15;
    timeline
      .to(f, { prop: "alpha", from: 0, to: 0.7, start: at, duration: 0.5, ease: outQuad })
      .to(f, { prop: "y", from: fy + rowSize * 0.3, to: fy, start: at, duration: 0.8, ease: outQuint });
  }

  return { timeline, duration };
}

export const shoutout: TemplateDefinition = {
  id: "shoutout",
  name: "Shoutout",
  tagline: "Handles arrive one at a time with their avatars — the thank-you roll.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { heading: "display", handles: "display" },
  palettes: PALETTES,
  fields: [
    { key: "heading", type: "text", label: "Heading", default: "Thank you", maxLength: 28, shrinkToFit: true },
    {
      key: "handles",
      type: "textlist",
      label: "Handles",
      default: ["@marta.builds", "@leo_designs", "@studio.nord", "@thefikastudio"],
      minItems: 1,
      maxItems: 7,
      maxLength: 26,
    },
    { key: "footer", type: "text", label: "Footer", default: "…and everyone who shared it", maxLength: 48, optional: true },
    { key: "showAvatars", type: "toggle", label: "Avatars", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  estimateDuration: (v) => durationFor(Array.isArray(v.handles) ? (v.handles as unknown[]).length : 4),
  build,
};
