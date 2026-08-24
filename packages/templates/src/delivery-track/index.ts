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

// Delivery Tracker — the order's progress along its stages, with the line
// filling to the stage it has reached and the current one pulsing. The
// post-purchase message that stops "where is my order" DMs.
//
// `order-confirmed` is the receipt at the moment of purchase; this is the days
// afterwards, and the difference is that the state is *partial* — the whole
// point is that some stages are done and one is happening now.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "parcel", name: "Parcel", colors: { background: "#F5F3EE", textColor: "#17150F", accent: "#B45309" } },
  { id: "ink", name: "Ink", colors: { background: "#111216", textColor: "#F4F5F7", accent: "#4ADE80" } },
  { id: "sky", name: "Sky", colors: { background: "#EFF4FB", textColor: "#111A26", accent: "#2563EB" } },
  { id: "mint", name: "Mint", colors: { background: "#F0F7F3", textColor: "#0F1E17", accent: "#0F9D6E" } },
];

const STAGE_ICONS: IconName[] = ["check", "cart", "plane", "pin"];

interface Layout {
  titleFrac: number;
  rowFrac: number;
  widthFrac: number;
  topFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { titleFrac: 0.046, rowFrac: 0.028, widthFrac: 0.56, topFrac: 0.2 };
    case "9:16":
      return { titleFrac: 0.062, rowFrac: 0.038, widthFrac: 0.8, topFrac: 0.22 };
    case "4:5":
      return { titleFrac: 0.058, rowFrac: 0.035, widthFrac: 0.78, topFrac: 0.21 };
    case "1:1":
    default:
      return { titleFrac: 0.056, rowFrac: 0.034, widthFrac: 0.76, topFrac: 0.21 };
  }
}

const TITLE_AT = 0.2;
const FIRST_AT = 0.75;
const PER_STAGE = 0.32;
const DURATION = 5.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F3EE"));
  const textColor = str(values.textColor, pc("textColor", "#17150F"));
  const accent = str(values.accent, pc("accent", "#B45309"));
  const title = str(values.title, "Your order is on the way");
  const orderNo = str(values.orderNo, "").trim();
  const stages = (Array.isArray(values.stages) ? (values.stages as unknown[]) : [])
    .map((v) => String(v ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 5);
  const current = Math.round(Math.max(1, Math.min(stages.length, num(values.current, 3))));
  const eta = str(values.eta, "").trim();
  const showIcons = on(values.showIcons);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const titleSize = Math.round(size.width * L.titleFrac);
  const rowSize = Math.round(size.width * L.rowFrac);
  const colW = size.width * L.widthFrac;
  const left = cx - colW / 2;
  const rowH = rowSize * 3.2;
  const top = size.height * L.topFrac;
  const dotR = rowSize * 0.85;

  const timeline = new JimaTimeline();

  // --- Title ---
  const t = makeText(fonts, { text: title, role: "display", weight: 800, size: titleSize, color: textColor, anchor: 0.5 });
  if (t.width > colW * 1.05) t.scale.set((colW * 1.05) / t.width);
  t.position.set(cx, top);
  t.alpha = 0;
  root.addChild(t);
  timeline
    .to(t, { prop: "alpha", from: 0, to: 1, start: TITLE_AT, duration: 0.4, ease: outQuad })
    .to(t, { prop: "y", from: top + titleSize * 0.3, to: top, start: TITLE_AT, duration: 0.75, ease: outExpo });

  if (orderNo.length > 0) {
    const o = makeText(fonts, {
      text: orderNo,
      role: "mono",
      weight: 700,
      size: Math.round(titleSize * 0.4),
      color: textColor,
      anchor: 0.5,
    });
    o.alpha = 0;
    const oy = top + titleSize * 0.8;
    o.position.set(cx, oy);
    root.addChild(o);
    timeline.to(o, { prop: "alpha", from: 0, to: 0.55, start: TITLE_AT + 0.2, duration: 0.45, ease: outQuad });
  }

  // --- The rail ---
  const listTop = top + titleSize * 1.7;
  const railX = left + dotR;
  const railTop = listTop + rowH * 0.5;
  const railBottom = listTop + rowH * (stages.length - 0.5);
  const railW = Math.max(3, rowSize * 0.13);

  root.addChild(
    new Graphics()
      .rect(railX - railW / 2, railTop, railW, railBottom - railTop)
      .fill({ color: textColor, alpha: 0.14 }),
  );

  // The filled portion stops exactly at the current stage, which is the whole
  // information in the graphic.
  const reached = (railBottom - railTop) * ((current - 1) / Math.max(1, stages.length - 1));
  const fill = new Graphics().rect(railX - railW / 2, railTop, railW, Math.max(1, reached)).fill(accent);
  fill.pivot.set(0, railTop);
  fill.position.set(0, railTop);
  fill.scale.y = 0;
  root.addChild(fill);
  timeline.to(fill, {
    prop: "scale.y",
    from: 0,
    to: 1,
    start: FIRST_AT,
    duration: PER_STAGE * Math.max(1, current - 1) + 0.35,
    ease: outQuint,
  });

  // --- Stages ---
  const pulseDots: Graphics[] = [];
  stages.forEach((label, i) => {
    const y = listTop + rowH * (i + 0.5);
    const done = i < current - 1;
    const now = i === current - 1;
    const row = new Container();
    row.position.set(0, y);
    root.addChild(row);

    const dot = new Graphics().circle(railX, 0, dotR).fill(done || now ? accent : bg);
    if (!done && !now) dot.stroke({ color: textColor, width: Math.max(2, rowSize * 0.1), alpha: 0.2 });
    row.addChild(dot);

    if (showIcons && (done || now)) {
      const ic = makeIcon(STAGE_ICONS[Math.min(i, STAGE_ICONS.length - 1)] ?? "check", dotR * 1.05, { color: bg });
      ic.position.set(railX, 0);
      row.addChild(ic);
    }

    if (now) {
      const halo = new Graphics().circle(railX, 0, dotR * 1.6).fill({ color: accent, alpha: 0.22 });
      row.addChildAt(halo, 0);
      pulseDots.push(halo);
    }

    const text = makeText(fonts, {
      text: label,
      role: "display",
      weight: now ? 800 : 600,
      size: rowSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    text.alpha = done ? 0.55 : now ? 1 : 0.35;
    text.position.set(railX + dotR * 2.2, 0);
    row.addChild(text);

    if (now && eta.length > 0) {
      const e = makeText(fonts, {
        text: eta,
        role: "body",
        weight: 700,
        size: rowSize * 0.68,
        color: accent,
        anchor: { x: 0, y: 0.5 },
      });
      e.position.set(railX + dotR * 2.2, rowSize * 1.05);
      row.addChild(e);
    }

    const at = FIRST_AT + i * PER_STAGE;
    row.alpha = 0;
    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.3, ease: outQuad })
      .to(row, { prop: "x", from: -rowSize * 0.6, to: 0, start: at, duration: 0.65, ease: outExpo });
    if (done || now) {
      timeline
        .to(dot, { prop: "scale.x", from: 0.5, to: 1, start: at + 0.05, duration: 0.5, ease: outBack })
        .to(dot, { prop: "scale.y", from: 0.5, to: 1, start: at + 0.05, duration: 0.5, ease: outBack });
    }
  });

  // The current stage breathes for as long as the clip runs — a tracker frozen
  // on one frame is a screenshot, not a status.
  const update = (time: number): void => {
    const startedAt = FIRST_AT + (current - 1) * PER_STAGE;
    const u = Math.max(0, time - startedAt);
    for (const halo of pulseDots) {
      const p = 0.5 + 0.5 * Math.sin(u * 3.4);
      halo.scale.set(1 + p * 0.22);
      halo.alpha = time < startedAt ? 0 : 0.3 - p * 0.14;
    }
  };
  update(0);

  return { timeline, duration: DURATION, update };
}

export const deliveryTrack: TemplateDefinition = {
  id: "delivery-track",
  name: "Delivery Tracker",
  tagline: "The order's stages fill down a rail, with the current one still breathing.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: true,
  posterTime: 3.6,
  fontRoles: { title: "display", stages: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Heading", default: "Your order is on the way", maxLength: 44, shrinkToFit: true },
    { key: "orderNo", type: "text", label: "Order number", default: "#JM-40218", maxLength: 20, optional: true },
    {
      key: "stages",
      type: "textlist",
      label: "Stages",
      default: ["Order placed", "Packed", "Out for delivery", "Delivered"],
      minItems: 2,
      maxItems: 5,
      maxLength: 28,
    },
    { key: "current", type: "slider", label: "Current stage", default: 3, min: 1, max: 5, step: 1 },
    { key: "eta", type: "text", label: "ETA note", default: "Arriving today, 14:00–18:00", maxLength: 40, optional: true },
    { key: "showIcons", type: "toggle", label: "Stage icons", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Progress", default: "", optional: true },
  ],
  build,
};
