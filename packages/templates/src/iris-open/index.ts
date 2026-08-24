import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF2E9E" } },
  { id: "midnight-glow", name: "Midnight glow", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#38E1FF" } },
  { id: "cobalt-frost", name: "Cobalt frost", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6" } },
  { id: "grape-night", name: "Grape night", colors: { background: "#1B1030", textColor: "#FFFFFF", accent: "#FFB020" } },
];

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.088 : aspect === "9:16" ? 0.112 : 0.102;
}

const REVEAL_START = 0.25;
const REVEAL_DUR = 0.8;
const DUR = 4.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#FFFFFF"));
  const textColor = str(values.textColor, pcol("textColor", "#101014"));
  const accent = str(values.accent, pcol("accent", "#FF2E9E"));
  const title = str(values.title, "Your Brand");
  const tagline = str(values.tagline, "an opening act");
  const showRing = on(values.showRing);

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const cy = h * 0.46;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Content (title + optional tagline), revealed through the iris ---
  const titleSize0 = Math.round(w * titleFrac(ctx.aspect));
  const maxWidth = w * (ctx.aspect === "16:9" ? 0.58 : 0.8);
  const titleSize = fitSize(fonts, title, "display", 700, titleSize0, maxWidth);
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(0, 0);

  const content = new Container();
  content.label = "content";
  content.position.set(cx, cy);
  content.addChild(titleText);

  const hasTagline = tagline.length > 0;
  let tagText: Text | null = null;
  let tagY = 0;
  if (hasTagline) {
    const tagSize = Math.round(titleSize * 0.28);
    tagY = titleSize * 0.62 + tagSize * 0.9;
    const t2 = makeText(fonts, {
      text: tagline,
      role: "body",
      weight: 500,
      size: tagSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: 1,
    });
    t2.position.set(0, tagY + 10);
    t2.alpha = 0;
    content.addChild(t2);
    tagText = t2;
  }

  // --- Iris mask: a circle centered on the content, sized to clear every
  // corner of the frame, growing from a point. Ring rides its exact edge. ---
  const cornerDist = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(w - cx, cy),
    Math.hypot(cx, h - cy),
    Math.hypot(w - cx, h - cy),
  );
  const R = cornerDist * 1.04;

  const mask = new Graphics().circle(0, 0, R).fill("#FFFFFF");
  mask.position.set(cx, cy);
  mask.scale.set(0);
  root.addChild(mask);
  content.mask = mask;
  root.addChild(content);

  timeline
    .to(mask, { prop: "scale.x", from: 0, to: 1, start: REVEAL_START, duration: REVEAL_DUR, ease: outExpo })
    .to(mask, { prop: "scale.y", from: 0, to: 1, start: REVEAL_START, duration: REVEAL_DUR, ease: outExpo });

  if (showRing) {
    const ringWidth = Math.max(3, R * 0.012);
    const ring = new Graphics().circle(0, 0, R).stroke({ color: accent, width: ringWidth });
    ring.position.set(cx, cy);
    ring.scale.set(0);
    root.addChild(ring);
    timeline
      .to(ring, { prop: "scale.x", from: 0, to: 1, start: REVEAL_START, duration: REVEAL_DUR, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 0, to: 1, start: REVEAL_START, duration: REVEAL_DUR, ease: outExpo })
      .to(ring, { prop: "alpha", from: 1, to: 0, start: REVEAL_START + REVEAL_DUR * 0.82, duration: REVEAL_DUR * 0.22, ease: outQuad });
  }

  // Settle pop once the iris clears — a touch of life on the reveal's arrival.
  const settleStart = REVEAL_START + REVEAL_DUR - 0.08;
  timeline
    .to(content, { prop: "scale.x", from: 1, to: 1.045, start: settleStart, duration: 0.14, ease: outQuad })
    .to(content, { prop: "scale.x", from: 1.045, to: 1, start: settleStart + 0.14, duration: 0.22, ease: outQuad })
    .to(content, { prop: "scale.y", from: 1, to: 1.045, start: settleStart, duration: 0.14, ease: outQuad })
    .to(content, { prop: "scale.y", from: 1.045, to: 1, start: settleStart + 0.14, duration: 0.22, ease: outQuad });

  if (tagText) {
    const t2 = tagText;
    const tagStart = REVEAL_START + REVEAL_DUR + 0.1;
    timeline
      .to(t2, { prop: "alpha", from: 0, to: 0.92, start: tagStart, duration: 0.45, ease: outQuad })
      .to(t2, { prop: "y", from: tagY + 10, to: tagY, start: tagStart, duration: 0.5, ease: outQuint });
  }

  return { timeline, duration: DUR };
}

export const irisOpen: TemplateDefinition = {
  id: "iris-open",
  name: "Iris Open",
  tagline: "A camera-iris wipe opens from a point to reveal your title.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { title: "display", tagline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Your Brand", maxLength: 28, shrinkToFit: true },
    { key: "tagline", type: "text", label: "Tagline", default: "an opening act", maxLength: 48, optional: true },
    { key: "showRing", type: "toggle", label: "Accent ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
