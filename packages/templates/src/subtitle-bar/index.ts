import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  makeOutBack,
  safeZone,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

// A caption/subtitle pill, centered at the bottom. Only the full-frame `bg`
// rect is tied to the background field (blanked by transparent export); the
// pill uses its own palette-only `pillBg` so the caption survives as overlay
// content once the canvas fill is gone.
const PALETTES: Palette[] = [
  { id: "midnight-caption", name: "Midnight caption", colors: { background: "#F5F5F5", pillBg: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "paper-caption", name: "Paper caption", colors: { background: "#101014", pillBg: "#FFFFFF", textColor: "#101014", accent: "#2E5BD6" } },
  { id: "violet-night", name: "Violet night", colors: { background: "#1B1030", pillBg: "#0F0A1C", textColor: "#F4EEFF", accent: "#B08BFF" } },
  { id: "forest-cream", name: "Forest cream", colors: { background: "#FFF6EA", pillBg: "#1B2B1F", textColor: "#EAF7ED", accent: "#2BB673" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F5F5"));
  const pillBg = pc("pillBg", "#101014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const caption = str(values.caption, "This caption reveals itself, word by word.");
  const showPill = values.showPill !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Fit caption to ≤2 lines (shrink font, then re-wrap) — German-safe. ---
  const maxCaptionW = w - zone.left - zone.right - minDim * 0.08;
  const minFontSize = Math.round(minDim * 0.024);
  let fontSize = Math.round(minDim * 0.046);
  let lineHeight = Math.round(fontSize * 1.3);
  const layout = (fs: number, lh: number, cy: number) =>
    layoutWords(caption, fonts, { role: "body", weight: 600, fontSize: fs, lineHeight: lh, maxWidth: maxCaptionW, align: "center", anchorX: w / 2, centerY: cy });

  let boxes = layout(fontSize, lineHeight, 0);
  let lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  for (let g = 0; g < 10 && lineCount > 2 && fontSize > minFontSize; g++) {
    fontSize = Math.max(minFontSize, Math.round(fontSize * 0.92));
    lineHeight = Math.round(fontSize * 1.3);
    boxes = layout(fontSize, lineHeight, 0);
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  // --- Pill geometry, bottom-anchored (grows upward for a second line). ---
  const padX = Math.round(fontSize * 0.9);
  const padY = Math.round(fontSize * 0.6);
  const blockW = boxes.length
    ? Math.max(...boxes.map((b) => b.cx + b.width / 2)) - Math.min(...boxes.map((b) => b.cx - b.width / 2))
    : 0;
  const pillW = Math.min(w - zone.left - zone.right, blockW + padX * 2);
  const pillH = Math.round(lineCount * lineHeight * 0.88) + padY * 2;

  const marginBottom = Math.round(minDim * 0.03);
  const pillBottomY = h - zone.bottom - marginBottom;
  const pillCenterY = pillBottomY - pillH / 2;
  const pillCenterX = w / 2;

  // Re-layout once more at the true vertical center now that pill height (and
  // therefore the block's resting position) is known.
  const finalBoxes = layout(fontSize, lineHeight, pillCenterY);

  if (showPill) {
    const pillGroup = new Container();
    pillGroup.position.set(pillCenterX, pillCenterY);
    pillGroup.scale.set(0);
    root.addChild(pillGroup);

    const e = Math.round(fontSize * 0.05);
    const off = Math.round(fontSize * 0.08);
    pillGroup.addChild(
      new Graphics()
        .roundRect(-pillW / 2 - e, -pillH / 2 - e + off, pillW + e * 2, pillH + e * 2, pillH / 2 + e)
        .fill({ color: "#000000", alpha: 0.18 }),
    );
    pillGroup.addChild(
      new Graphics()
        .roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2)
        .fill(pillBg)
        .stroke({ color: accent, width: Math.max(2, Math.round(fontSize * 0.045)), alpha: 0.9 }),
    );
    timeline
      .to(pillGroup, { prop: "scale.x", from: 0, to: 1, start: 0.0, duration: 0.4, ease: makeOutBack(1.3) })
      .to(pillGroup, { prop: "scale.y", from: 0, to: 1, start: 0.0, duration: 0.4, ease: makeOutBack(1.3) });
  }

  // --- Words reveal one by one (fade + rise), independent of the pill. ---
  finalBoxes.forEach((box, i) => {
    const t = makeText(fonts, { text: box.text, role: "body", weight: 600, size: fontSize, color: textColor, anchor: 0.5 });
    t.position.set(box.cx, box.cy);
    t.alpha = 0;
    root.addChild(t);
    const start = 0.22 + i * 0.05;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.32, ease: outQuad })
      .to(t, { prop: "y", from: box.cy + fontSize * 0.3, to: box.cy, start, duration: 0.36, ease: outQuint });
  });

  return { timeline, duration: 4.5 };
}

export const subtitleBar: TemplateDefinition = {
  id: "subtitle-bar",
  name: "Subtitle Bar",
  tagline: "A caption pill reveals its words, ready to drop over any footage.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { caption: "body" },
  palettes: PALETTES,
  fields: [
    { key: "caption", type: "textarea", label: "Caption", default: "This caption reveals itself, word by word.", maxLength: 120, maxLines: 2, shrinkToFit: true },
    { key: "showPill", type: "toggle", label: "Background pill", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
