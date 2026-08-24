import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inOutCubic,
  outCubic,
  outExpo,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "violet", name: "Violet", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF" } },
];

interface L {
  fontFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
}

function layout(aspect: Aspect): L {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.098, maxWidthFrac: 0.74, centerYFrac: 0.46 };
    case "9:16":
      return { fontFrac: 0.135, maxWidthFrac: 0.84, centerYFrac: 0.44 };
    case "4:5":
      return { fontFrac: 0.12, maxWidthFrac: 0.82, centerYFrac: 0.45 };
    case "1:1":
    default:
      return { fontFrac: 0.125, maxWidthFrac: 0.8, centerYFrac: 0.46 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Make it big");
  const subline = str(values.subline, "");
  const showAccentBar = values.accentBar !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const fontSize = Math.round(size.width * L.fontFrac);
  const lineHeight = Math.round(fontSize * 1.12);
  const content = new Container();
  root.addChild(content);

  const cx = size.width / 2;
  const cy = Math.round(size.height * L.centerYFrac);

  const boxes = layoutWords(headline, fonts, {
    role: "display",
    weight: 700,
    fontSize,
    lineHeight,
    maxWidth: size.width * L.maxWidthFrac,
    align: "center",
    anchorX: cx,
    centerY: cy,
  });

  // The whole headline lives in a group pivoted on the block center so it scales
  // as one about that center, not per word.
  const group = new Container();
  group.pivot.set(cx, cy);
  group.position.set(cx, cy);
  group.scale.set(0.7);
  content.addChild(group);

  const timeline = new JimaTimeline();

  // Smooth swell from 0.7 → 1 (outExpo settle, not a slam).
  timeline
    .to(group, { prop: "scale.x", from: 0.7, to: 1, start: 0.3, duration: 0.9, ease: outExpo })
    .to(group, { prop: "scale.y", from: 0.7, to: 1, start: 0.3, duration: 0.9, ease: outExpo });

  // Words fade in with a tiny stagger for a hint of life under the swell.
  boxes.forEach((box, i) => {
    const t = makeText(fonts, { text: box.text, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
    t.position.set(box.cx, box.cy);
    t.alpha = 0;
    group.addChild(t);
    const start = 0.3 + i * 0.05;
    timeline.to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.6, ease: outCubic });
  });

  // A very subtle breathe over the hold — 1 → 1.015 → 1 — landing back exactly on
  // 1 so the final frame is fully still. inOutCubic keeps it gentle.
  const breatheUp = 1.6;
  const breatheDur = 0.8;
  timeline
    .to(group, { prop: "scale.x", from: 1, to: 1.015, start: breatheUp, duration: breatheDur, ease: inOutCubic })
    .to(group, { prop: "scale.y", from: 1, to: 1.015, start: breatheUp, duration: breatheDur, ease: inOutCubic })
    .to(group, { prop: "scale.x", from: 1.015, to: 1, start: breatheUp + breatheDur, duration: breatheDur, ease: inOutCubic })
    .to(group, { prop: "scale.y", from: 1.015, to: 1, start: breatheUp + breatheDur, duration: breatheDur, ease: inOutCubic });

  // A short accent underline + optional subline settle in beneath the block.
  // These sit outside the group so they hold still while it breathes.
  const bottom = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.7;
  const left = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const right = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const cxMid = (left + right) / 2;
  const lineW = Math.min(right - left, size.width * 0.18);
  const ulStart = Math.max(1.3, 0.3 + boxes.length * 0.05 + 0.4);
  if (showAccentBar) {
    const underline = new Graphics().roundRect(-lineW / 2, 0, lineW, Math.max(3, fontSize * 0.055), 2).fill(accent);
    underline.position.set(cxMid, bottom);
    underline.alpha = 0;
    underline.scale.set(0.35, 1);
    content.addChild(underline);
    timeline
      .to(underline, { prop: "alpha", from: 0, to: 1, start: ulStart, duration: 0.5, ease: outCubic })
      .to(underline, { prop: "scale.x", from: 0.35, to: 1, start: ulStart, duration: 0.7, ease: outExpo });
  }

  let end = ulStart + 0.7;
  if (subline.length > 0) {
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 500,
      size: Math.round(fontSize * 0.28),
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    const subY = bottom + fontSize * 0.5;
    sub.position.set(cxMid, subY);
    sub.alpha = 0;
    content.addChild(sub);
    const subStart = ulStart + 0.25;
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.85, start: subStart, duration: 0.7, ease: outCubic })
      .to(sub, { prop: "y", from: subY + fontSize * 0.22, to: subY, start: subStart, duration: 0.8, ease: outQuint });
    end = subStart + 0.8;
  }

  return { timeline, duration: Math.max(3.4, Math.max(end, breatheUp + breatheDur * 2) + 0.2) };
}

export const scaleIn: TemplateDefinition = {
  id: "scale-in",
  name: "Scale In",
  tagline: "The headline swells up smoothly, then breathes on the hold.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.2,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Make it big", maxLength: 40, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Bold and smooth", maxLength: 60, optional: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
