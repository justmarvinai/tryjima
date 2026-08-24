import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  safeRect,
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

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// Two vibrant curtain panels (a color block) part over a light stage to reveal
// the title, which lands on the off-white background (always >= 4.5:1). The
// only per-panel accent is a bright inner-edge trim (drawn white-over-color).
const PALETTES: Palette[] = [
  { id: "rouge", name: "Rouge", colors: { background: "#F7F4F2", textColor: "#1A1115", accent: "#E23A57", curtain: "#E23A57" } },
  { id: "royal", name: "Royal", colors: { background: "#F1F2FA", textColor: "#141633", accent: "#4B4DE0", curtain: "#4B4DE0" } },
  { id: "emerald", name: "Emerald", colors: { background: "#EFFAF4", textColor: "#0C2A1E", accent: "#12A06B", curtain: "#12A06B" } },
  { id: "amber", name: "Amber", colors: { background: "#FFF7EC", textColor: "#2A1A08", accent: "#E8820E", curtain: "#E8820E" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.078 : aspect === "9:16" ? 0.108 : 0.096;
}

const OPEN_START = 0.35;
const OPEN_DUR = 1.05;
const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F7F4F2"));
  const textColor = str(values.textColor, pc("textColor", "#1A1115"));
  const accent = str(values.accent, pc("accent", "#E23A57"));
  const curtain = str(values.accent, pc("curtain", accent));
  const title = str(values.title, "Now Showing");
  const subtitle = str(values.subtitle, "a grand opening");
  const showTrim = on(values.showTrim);

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const centerY = zone.y + zone.height * 0.46;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Content (revealed as the curtains part) ---
  const maxW = zone.width * (ctx.aspect === "16:9" ? 0.58 : 0.82);
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), maxW);
  const hasSub = subtitle.length > 0;
  const subSize = Math.round(titleSize * 0.3);
  const lineGap = subSize * 0.95;
  const totalH = titleSize + (hasSub ? lineGap + subSize : 0);

  const content = new Container();
  content.position.set(cx, centerY);
  root.addChild(content);

  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(0, -totalH / 2 + titleSize / 2);
  content.addChild(titleText);

  if (hasSub) {
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 2 });
    subText.position.set(0, totalH / 2 - subSize / 2);
    subText.alpha = 0;
    content.addChild(subText);
    const subStart = OPEN_START + OPEN_DUR * 0.72;
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.82, start: subStart, duration: 0.5, ease: outQuad })
      .to(subText, { prop: "y", from: totalH / 2 - subSize / 2 + 14, to: totalH / 2 - subSize / 2, start: subStart, duration: 0.55, ease: outQuint });
  }

  // Settle pop once the stage is clear.
  const settle = OPEN_START + OPEN_DUR - 0.12;
  timeline
    .to(content, { prop: "scale.x", from: 1, to: 1.035, start: settle, duration: 0.16, ease: outQuad })
    .to(content, { prop: "scale.x", from: 1.035, to: 1, start: settle + 0.16, duration: 0.24, ease: outQuad })
    .to(content, { prop: "scale.y", from: 1, to: 1.035, start: settle, duration: 0.16, ease: outQuad })
    .to(content, { prop: "scale.y", from: 1.035, to: 1, start: settle + 0.16, duration: 0.24, ease: outQuad });

  // --- Two curtain panels ---
  const halfW = w / 2;
  const pleats = 7;
  const trimW = Math.max(6, w * 0.008);
  const panelDefs: { home: number; off: number; innerRight: boolean }[] = [
    { home: 0, off: -halfW, innerRight: true }, // left panel, inner edge on its right
    { home: halfW, off: w, innerRight: false }, // right panel, inner edge on its left
  ];

  for (const def of panelDefs) {
    const panel = new Container();
    panel.position.set(def.home, 0);
    root.addChild(panel);

    panel.addChild(new Graphics().rect(0, 0, halfW, h).fill(curtain));
    // Soft vertical folds for fabric depth.
    const bandW = halfW / pleats;
    for (let i = 0; i < pleats; i++) {
      const shade = i % 2 === 0 ? { color: "#000000", alpha: 0.06 } : { color: "#FFFFFF", alpha: 0.07 };
      panel.addChild(new Graphics().rect(i * bandW, 0, bandW, h).fill(shade));
    }
    // Bright inner-edge trim.
    if (showTrim) {
      const tx = def.innerRight ? halfW - trimW : 0;
      panel.addChild(new Graphics().rect(tx, 0, trimW, h).fill({ color: "#FFFFFF", alpha: 0.85 }));
      panel.addChild(new Graphics().rect(def.innerRight ? tx - trimW : trimW, 0, trimW, h).fill({ color: "#FFFFFF", alpha: 0.28 }));
    }

    timeline.to(panel, { prop: "position.x", from: def.home, to: def.off, start: OPEN_START, duration: OPEN_DUR, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const curtainIntro: TemplateDefinition = {
  id: "curtain-intro",
  name: "Curtain Intro",
  tagline: "Two theater curtains part from the center to reveal your title.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Now Showing", maxLength: 28, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "a grand opening", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showTrim", type: "toggle", label: "Curtain trim", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Curtain", default: "", optional: true },
  ],
  build,
};
