import { Container, Graphics, FillGradient } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { arcPoints } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

function fitSize(fonts: FontRegistry, text: string, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family("display"), weight, size });
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}

// An iOS-style home screen: a subtle gradient wallpaper, a greeting, and a 2x2
// stack of widget tiles that pop in. The wallpaper is the full-frame bg (a flat
// `background` override wins over the palette gradient for alpha export).
const RING_COLORS = ["#FF3B5C", "#A6FF3C", "#24D1FF"];
const CAL_RED = "#FF3B30";

const PALETTES: Palette[] = [
  { id: "dawn", name: "Dawn", colors: { wallTop: "#FFE3C7", wallBot: "#FFC9DD", card: "#FFFFFF", cardDark: "#17181F", inkColor: "#14151B", accent: "#FF6B8A", textColor: "#2A1420" } },
  { id: "sky", name: "Sky", colors: { wallTop: "#CFE8FF", wallBot: "#E6D6FF", card: "#FFFFFF", cardDark: "#12151F", inkColor: "#101828", accent: "#3B6EF5", textColor: "#10233F" } },
  { id: "mint", name: "Mint", colors: { wallTop: "#CFF3E2", wallBot: "#E4F6C9", card: "#FFFFFF", cardDark: "#0C231A", inkColor: "#08301F", accent: "#12B76A", textColor: "#08301F" } },
  { id: "dusk", name: "Dusk", colors: { wallTop: "#2A2350", wallBot: "#14263F", card: "#23283A", cardDark: "#14161F", inkColor: "#EEF1F8", accent: "#7C9CFF", textColor: "#F2F4F8" } },
];

function sunGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.circle(0, 0, s * 0.36).fill(color);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.moveTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5)
      .lineTo(Math.cos(a) * s * 0.68, Math.sin(a) * s * 0.68)
      .stroke({ color, width: Math.max(2, s * 0.08), cap: "round" });
  }
  return g;
}

function ringStack(cx: number, cy: number, maxR: number, ringW: number, fracs: number[]): Container {
  const c = new Container();
  fracs.forEach((frac, i) => {
    const r = maxR - i * (ringW + maxR * 0.12);
    c.addChild(new Graphics().poly(arcPoints(cx, cy, r, 0, Math.PI * 2, 40), true).stroke({ color: RING_COLORS[i]!, width: ringW, alpha: 0.2 }));
    const a0 = -Math.PI / 2;
    c.addChild(new Graphics().poly(arcPoints(cx, cy, r, a0, a0 + frac * Math.PI * 2, 40), false).stroke({ color: RING_COLORS[i]!, width: ringW, cap: "round" }));
  });
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bgUser = str(values.background, "");
  const card = pc("card", "#FFFFFF");
  const cardDark = pc("cardDark", "#17181F");
  const inkColor = pc("inkColor", "#14151B");
  const accent = str(values.accent, pc("accent", "#FF6B8A"));
  const textColor = str(values.textColor, pc("textColor", "#2A1420"));

  const title = str(values.title, "Good morning");
  const dateLine = str(values.dateLine, "Monday, June 9");
  const showStatusBar = values.showStatusBar !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h);
  if (bgUser) {
    bgRect.fill(bgUser);
  } else {
    const grad = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: pc("wallTop", "#FFE3C7") },
        { offset: 1, color: pc("wallBot", "#FFC9DD") },
      ],
      textureSpace: "local",
    });
    bgRect.fill(grad);
  }
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);
  const cx = w / 2;

  // --- Status bar ---
  let topY = zone.y;
  if (showStatusBar) {
    const sbY = zone.y + minDim * 0.015;
    const sbSize = Math.round(minDim * 0.026);
    const clock = makeText(fonts, { text: "9:41", role: "display", weight: 700, size: sbSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    clock.position.set(zone.x + minDim * 0.01, sbY);
    root.addChild(clock);
    // Signal bars, wifi, battery on the right.
    const rx = zone.x + zone.width - minDim * 0.01;
    const batW = minDim * 0.05;
    const batH = sbSize * 0.9;
    root.addChild(new Graphics().roundRect(rx - batW, sbY - batH / 2, batW, batH, batH * 0.28).stroke({ color: textColor, width: Math.max(1.5, minDim * 0.003), alpha: 0.8 }));
    root.addChild(new Graphics().roundRect(rx - batW + batW * 0.14, sbY - batH * 0.28, batW * 0.6, batH * 0.56, batH * 0.14).fill(textColor));
    root.addChild(new Graphics().roundRect(rx + minDim * 0.004, sbY - batH * 0.18, minDim * 0.006, batH * 0.36, minDim * 0.003).fill({ color: textColor, alpha: 0.8 }));
    let bx = rx - batW - minDim * 0.055;
    for (let i = 0; i < 4; i++) {
      const bh = batH * (0.4 + i * 0.2);
      root.addChild(new Graphics().roundRect(bx, sbY + batH / 2 - bh, minDim * 0.008, bh, minDim * 0.002).fill(textColor));
      bx += minDim * 0.012;
    }
    topY = sbY + sbSize;
  }

  // --- Greeting + date ---
  const titleSize = fitSize(fonts, title, 700, Math.round(minDim * 0.058), zone.width * 0.9);
  const titleY = topY + minDim * 0.05;
  const titleNode = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0.5, y: 0 }, align: "center" });
  titleNode.position.set(cx, titleY);
  titleNode.alpha = 0;
  root.addChild(titleNode);
  const dateNode = makeText(fonts, { text: dateLine, role: "body", weight: 600, size: Math.round(minDim * 0.028), color: textColor, anchor: { x: 0.5, y: 0 } });
  dateNode.position.set(cx, titleY + titleSize * 1.05);
  dateNode.alpha = 0;
  root.addChild(dateNode);
  timeline
    .to(titleNode, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.45, ease: outQuad })
    .to(titleNode, { prop: "y", from: titleY - 12, to: titleY, start: 0, duration: 0.5, ease: outExpo })
    .to(dateNode, { prop: "alpha", from: 0, to: 0.75, start: 0.12, duration: 0.45, ease: outQuad });

  // --- 2x2 widget grid ---
  const gridTop = titleY + titleSize * 1.05 + minDim * 0.05;
  const availH = zone.y + zone.height - gridTop;
  const availW = Math.min(zone.width, w * 0.86);
  const gap = availW * 0.05;
  const tile = Math.min((availW - gap) / 2, (availH - gap) / 2);
  const gridW = tile * 2 + gap;
  const gridActualH = tile * 2 + gap;
  const gridLeft = cx - gridW / 2;
  const gridTopC = gridTop + Math.max(0, (availH - gridActualH) / 2);
  const r = tile * 0.16;

  const cells = [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 0, row: 1 },
    { col: 1, row: 1 },
  ];

  const makeTile = (kind: number): Container => {
    const c = new Container();
    const pad = tile * 0.12;
    if (kind === 0) {
      // Weather.
      c.addChild(new Graphics().roundRect(-tile / 2, -tile / 2, tile, tile, r).fill(card));
      const cityNode = makeText(fonts, { text: "Cupertino", role: "body", weight: 600, size: Math.round(tile * 0.1), color: inkColor, anchor: { x: 0, y: 0 } });
      cityNode.position.set(-tile / 2 + pad, -tile / 2 + pad);
      cityNode.alpha = 0.85;
      c.addChild(cityNode);
      const sun = sunGlyph(tile * 0.14, "#FFB020");
      sun.position.set(tile / 2 - pad - tile * 0.14, -tile / 2 + pad + tile * 0.14);
      c.addChild(sun);
      const tempNode = makeText(fonts, { text: "72°", role: "display", weight: 700, size: Math.round(tile * 0.26), color: inkColor, anchor: { x: 0, y: 0.5 } });
      tempNode.position.set(-tile / 2 + pad, tile * 0.02);
      c.addChild(tempNode);
      const hlNode = makeText(fonts, { text: "H:75  L:60", role: "body", weight: 600, size: Math.round(tile * 0.085), color: inkColor, anchor: { x: 0, y: 1 } });
      hlNode.position.set(-tile / 2 + pad, tile / 2 - pad);
      hlNode.alpha = 0.6;
      c.addChild(hlNode);
    } else if (kind === 1) {
      // Calendar.
      c.addChild(new Graphics().roundRect(-tile / 2, -tile / 2, tile, tile, r).fill(card));
      const dow = makeText(fonts, { text: "MONDAY", role: "body", weight: 700, size: Math.round(tile * 0.08), color: CAL_RED, anchor: { x: 0, y: 0 }, letterSpacing: 1 });
      dow.position.set(-tile / 2 + pad, -tile / 2 + pad);
      c.addChild(dow);
      const day = makeText(fonts, { text: "9", role: "display", weight: 700, size: Math.round(tile * 0.3), color: inkColor, anchor: { x: 0, y: 0 } });
      day.position.set(-tile / 2 + pad, -tile / 2 + pad + tile * 0.1);
      c.addChild(day);
      const evs = [
        { label: "Standup", col: accent },
        { label: "Design sync", col: "#FF9F0A" },
      ];
      evs.forEach((e, i) => {
        const ey = tile * 0.06 + i * tile * 0.17;
        c.addChild(new Graphics().roundRect(-tile / 2 + pad, ey, tile * 0.03, tile * 0.13, tile * 0.015).fill(e.col));
        const lbl = makeText(fonts, { text: e.label, role: "body", weight: 600, size: Math.round(tile * 0.078), color: inkColor, anchor: { x: 0, y: 0.5 } });
        lbl.position.set(-tile / 2 + pad + tile * 0.07, ey + tile * 0.065);
        lbl.alpha = 0.85;
        c.addChild(lbl);
      });
    } else if (kind === 2) {
      // Activity rings (dark tile).
      c.addChild(new Graphics().roundRect(-tile / 2, -tile / 2, tile, tile, r).fill(cardDark));
      const rings = ringStack(0, -tile * 0.06, tile * 0.28, tile * 0.06, [0.82, 0.6, 0.9]);
      c.addChild(rings);
      const lbl = makeText(fonts, { text: "Activity", role: "body", weight: 600, size: Math.round(tile * 0.085), color: "#F2F4F8", anchor: { x: 0.5, y: 1 } });
      lbl.position.set(0, tile / 2 - pad * 0.7);
      lbl.alpha = 0.85;
      c.addChild(lbl);
    } else {
      // Up next.
      c.addChild(new Graphics().roundRect(-tile / 2, -tile / 2, tile, tile, r).fill(card));
      const hd = makeText(fonts, { text: "Up Next", role: "display", weight: 700, size: Math.round(tile * 0.11), color: inkColor, anchor: { x: 0, y: 0 } });
      hd.position.set(-tile / 2 + pad, -tile / 2 + pad);
      c.addChild(hd);
      const timeNode = makeText(fonts, { text: "2:30 PM", role: "display", weight: 700, size: Math.round(tile * 0.16), color: accent, anchor: { x: 0, y: 0 } });
      timeNode.position.set(-tile / 2 + pad, -tile / 2 + pad + tile * 0.16);
      c.addChild(timeNode);
      const l1 = makeText(fonts, { text: "Team review", role: "body", weight: 600, size: Math.round(tile * 0.088), color: inkColor, anchor: { x: 0, y: 1 } });
      l1.position.set(-tile / 2 + pad, tile / 2 - pad - tile * 0.11);
      l1.alpha = 0.85;
      c.addChild(l1);
      const l2 = makeText(fonts, { text: "Room 4 · 30 min", role: "body", weight: 500, size: Math.round(tile * 0.074), color: inkColor, anchor: { x: 0, y: 1 } });
      l2.position.set(-tile / 2 + pad, tile / 2 - pad);
      l2.alpha = 0.55;
      c.addChild(l2);
    }
    return c;
  };

  cells.forEach((cell, i) => {
    const tx = gridLeft + cell.col * (tile + gap) + tile / 2;
    const ty = gridTopC + cell.row * (tile + gap) + tile / 2;
    const holder = new Container();
    holder.position.set(tx, ty);
    holder.alpha = 0;
    holder.scale.set(0.7);
    root.addChild(holder);
    // Soft shadow.
    holder.addChild(new Graphics().roundRect(-tile / 2, -tile / 2 + tile * 0.03, tile, tile, r).fill({ color: "#000000", alpha: 0.14 }));
    holder.addChild(makeTile(i));
    const start = 0.4 + i * 0.12;
    timeline
      .to(holder, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
      .to(holder, { prop: "scale.x", from: 0.7, to: 1, start, duration: 0.65, ease: spring(0.5) })
      .to(holder, { prop: "scale.y", from: 0.7, to: 1, start, duration: 0.65, ease: spring(0.5) });
  });

  return { timeline, duration: 4.0 };
}

export const homeWidgets: TemplateDefinition = {
  id: "home-widgets",
  name: "Home Widgets",
  tagline: "An iOS-style widget stack pops onto a soft gradient wallpaper.",
  category: "tech",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { title: "display", dateLine: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Greeting", default: "Good morning", maxLength: 24, shrinkToFit: true },
    { key: "dateLine", type: "text", label: "Date line", default: "Monday, June 9", maxLength: 28, optional: true, shrinkToFit: true },
    { key: "showStatusBar", type: "toggle", label: "Status bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true, help: "Overrides the gradient wallpaper with a flat color." },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
