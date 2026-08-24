import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  outExpo,
  spring,
  makeOutBack,
  linear,
  shrinkToFit,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { pointerCursor } from "../shared/ui";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "noir-cyan", name: "Noir cyan", colors: { background: "#070B14", barColor: "#121A2C", textColor: "#F3F6FF", accent: "#38E1FF" } },
  { id: "ember-night", name: "Ember night", colors: { background: "#0B0B0F", barColor: "#1C1C22", textColor: "#FFFFFF", accent: "#FF6A3D" } },
  { id: "violet-dusk", name: "Violet dusk", colors: { background: "#0E0A1A", barColor: "#1E1730", textColor: "#FFFFFF", accent: "#B084F5" } },
  { id: "daylight", name: "Daylight", colors: { background: "#EEF1F6", barColor: "#FFFFFF", textColor: "#101014", accent: "#2E7DF6" } },
];

/** A magnifying-glass glyph: a ring + a short handle, centered at (0,0). */
function magnifierGlyph(size: number, color: string, strokeWidth: number): Graphics {
  const s = size;
  const g = new Graphics();
  g.circle(-0.06 * s, -0.06 * s, 0.36 * s).stroke({ color, width: strokeWidth, cap: "round" });
  g.moveTo(0.2 * s, 0.2 * s).lineTo(0.46 * s, 0.46 * s).stroke({ color, width: strokeWidth * 1.2, cap: "round" });
  return g;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#070B14"));
  const barColor = str(values.barColor, pc("barColor", "#121A2C"));
  const textColor = str(values.textColor, pc("textColor", "#F3F6FF"));
  const accent = str(values.accent, pc("accent", "#38E1FF"));
  const query = str(values.query, "What's trending right now?");
  const showCursor = values.showCursor !== false;

  const DUR = 4.6;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const k = minDim / 1080;
  const safe = safeRect(ctx.aspect);
  const cx = size.width / 2;
  const cy = safe.y + safe.height * 0.5;

  // --- Ambient scanlines: faint, slow, continuous drift ---
  for (let i = 0; i < 2; i++) {
    const lineH = 3 * k;
    const line = new Graphics().rect(0, 0, size.width, lineH).fill(accent);
    line.alpha = 0.05;
    const startY = -120 * k - i * size.height * 0.5;
    const endY = size.height + 120 * k;
    line.position.set(0, startY);
    root.addChild(line);
    timeline.to(line, { prop: "y", from: startY, to: endY, start: 0, duration: DUR + 0.6, ease: linear });
  }

  // --- One-shot bright scanline sweep (a "boot up" flourish) ---
  const sweep = new Graphics().rect(0, 0, size.width, 5 * k).fill(accent);
  sweep.alpha = 0;
  sweep.position.set(0, -20 * k);
  root.addChild(sweep);
  timeline
    .to(sweep, { prop: "alpha", from: 0, to: 0.55, start: 0, duration: 0.12, ease: outQuad })
    .to(sweep, { prop: "alpha", from: 0.55, to: 0, start: 0.4, duration: 0.35, ease: outQuad })
    .to(sweep, { prop: "y", from: -20 * k, to: size.height + 20 * k, start: 0, duration: 0.65, ease: outCubic });

  // --- Soft glow behind the bar ---
  const glow = new Sprite(radialGlowTexture());
  glow.anchor.set(0.5);
  glow.tint = accent;
  const glowSize = minDim * 0.9;
  glow.width = glowSize;
  glow.height = glowSize;
  glow.alpha = 0;
  glow.position.set(cx, cy);
  root.addChild(glow);
  timeline.to(glow, { prop: "alpha", from: 0, to: 0.22, start: 0.2, duration: 0.6, ease: outQuad });

  // --- Search bar sizing ---
  const barW = Math.min(safe.width, minDim * 1.3);
  const barH = Math.round(minDim * 0.11);
  const barRadius = barH / 2;
  const padX = Math.round(barH * 0.36);
  const iconSize = Math.round(barH * 0.4);
  const gapIconText = Math.round(barH * 0.32);

  const qSize0 = Math.round(barH * 0.34);
  const textMaxW = barW - padX * 2 - iconSize - gapIconText - barH * 0.6;
  const familyBody = fonts.family("body");
  const measureQ = (s: string, sz: number): number => fonts.measure(s, { family: familyBody, weight: 600, size: sz });
  const qSize = shrinkToFit(query, measureQ, { maxWidth: textMaxW, baseSize: qSize0, minSize: Math.round(qSize0 * 0.6) });

  const bar = new Container();
  bar.addChild(new Graphics().roundRect(-barW / 2, -barH / 2, barW, barH, barRadius).fill(barColor));

  const iconCX = -barW / 2 + padX + iconSize / 2;
  const magnifier = magnifierGlyph(iconSize, accent, Math.max(2, barH * 0.045));
  magnifier.position.set(iconCX, 0);
  bar.addChild(magnifier);

  const textX = -barW / 2 + padX + iconSize + gapIconText;
  const qNode = makeText(fonts, { text: "", role: "body", weight: 600, size: qSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  qNode.position.set(textX, 0);
  bar.addChild(qNode);

  bar.position.set(cx, cy + 46 * k);
  bar.alpha = 0;
  bar.scale.set(0.82);
  root.addChild(bar);

  const BAR_START = 0.3;
  timeline
    .to(bar, { prop: "alpha", from: 0, to: 1, start: BAR_START, duration: 0.32, ease: outQuad })
    .to(bar, { prop: "y", from: cy + 46 * k, to: cy, start: BAR_START, duration: 0.6, ease: outExpo })
    .to(bar, { prop: "scale.x", from: 0.82, to: 1, start: BAR_START, duration: 0.6, ease: spring(0.45) })
    .to(bar, { prop: "scale.y", from: 0.82, to: 1, start: BAR_START, duration: 0.6, ease: spring(0.45) });

  // --- Typewriter query + blinking caret ---
  const TYPE_START = BAR_START + 0.5;
  const TYPE_BUDGET = 2.0;
  const speed = TYPE_BUDGET / Math.max(1, query.length);

  // --- Mouse cursor: sits just past the text end, then nudges ---
  if (showCursor) {
    const queryFullW = measureQ(query, qSize);
    const cursorSize = Math.round(barH * 0.5);
    const cursor = pointerCursor(cursorSize, "#FFFFFF", "#101014");
    const cursorX = textX + queryFullW + cursorSize * 0.35;
    const cursorY = barH * 0.18;
    cursor.position.set(cursorX, cursorY);
    cursor.alpha = 0;
    cursor.scale.set(0.6);
    bar.addChild(cursor);

    const CURSOR_START = TYPE_START + TYPE_BUDGET - 0.15;
    timeline
      .to(cursor, { prop: "alpha", from: 0, to: 1, start: CURSOR_START, duration: 0.3, ease: outQuad })
      .to(cursor, { prop: "scale.x", from: 0.6, to: 1, start: CURSOR_START, duration: 0.4, ease: makeOutBack(2) })
      .to(cursor, { prop: "scale.y", from: 0.6, to: 1, start: CURSOR_START, duration: 0.4, ease: makeOutBack(2) });

    for (let c = 0; c < 3; c++) {
      const t0 = CURSOR_START + 0.55 + c * 0.55;
      if (t0 + 0.45 > DUR) break;
      timeline
        .to(cursor, { prop: "x", from: cursorX, to: cursorX + 10 * k, start: t0, duration: 0.2, ease: outQuad })
        .to(cursor, { prop: "x", from: cursorX + 10 * k, to: cursorX, start: t0 + 0.2, duration: 0.25, ease: outQuad });
    }
  }

  const update = (t: number): void => {
    const elapsed = t - TYPE_START;
    const shown = elapsed <= 0 ? 0 : Math.min(query.length, Math.floor(elapsed / speed));
    const blinkOn = t >= TYPE_START - 0.1 && t % 0.9 < 0.5;
    qNode.text = query.slice(0, shown) + (blinkOn ? "|" : "");
  };

  return { timeline, duration: DUR, update };
}

export const searchType: TemplateDefinition = {
  id: "search-type",
  name: "Search Type",
  tagline: "A search bar types out a live query with a nudging cursor.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.4,
  palettes: PALETTES,
  fields: [
    { key: "query", type: "text", label: "Search query", default: "What's trending right now?", maxLength: 46, shrinkToFit: true },
    { key: "showCursor", type: "toggle", label: "Mouse cursor", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "barColor", type: "color", label: "Bar", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
