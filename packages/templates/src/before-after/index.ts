import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outBack,
  spring,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makePill } from "../shared/ui";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF6F1", textColor: "#241009", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "ocean", name: "Ocean", colors: { background: "#EEF4FF", textColor: "#0B1F4D", accent: "#2E7DF6", onAccent: "#FFFFFF" } },
  { id: "lime", name: "Lime", colors: { background: "#F2FBE8", textColor: "#1B2A08", accent: "#5F9E12", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FAF5EA", accent: "#D8F34D", onAccent: "#101014" } },
];

/** A simple framed-landscape glyph for empty panels, centered at origin. */
function photoGlyph(s: number, color: string): Container {
  const g = new Container();
  const fw = s;
  const fh = s * 0.82;
  g.addChild(new Graphics().roundRect(-fw / 2, -fh / 2, fw, fh, s * 0.1).stroke({ color, width: Math.max(3, s * 0.05) }));
  g.addChild(new Graphics().circle(fw * 0.2, -fh * 0.18, s * 0.1).fill(color));
  g.addChild(new Graphics().poly([-fw * 0.42, fh * 0.4, -fw * 0.1, -fh * 0.04, fw * 0.16, fh * 0.4]).fill(color));
  g.addChild(new Graphics().poly([-fw * 0.02, fh * 0.4, fw * 0.2, fh * 0.06, fw * 0.46, fh * 0.4]).fill(color));
  return g;
}

/** A rounded panel: cover-fit image (masked) or a designed placeholder. */
function makePanel(
  x: number,
  y: number,
  pw: number,
  ph: number,
  r: number,
  tex: Texture | null,
  panelBg: string,
  glyphColor: string,
): Container {
  const c = new Container();
  c.addChild(new Graphics().roundRect(x, y, pw, ph, r).fill(panelBg));
  if (tex) {
    const holder = new Container();
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(pw / tex.width, ph / tex.height);
    s.scale.set(cover);
    s.position.set(x + pw / 2, y + ph / 2);
    const mask = new Graphics().roundRect(x, y, pw, ph, r).fill(0xffffff);
    holder.addChild(s, mask);
    s.mask = mask;
    c.addChild(holder);
  } else {
    const g = photoGlyph(Math.min(pw, ph) * 0.32, glyphColor);
    g.position.set(x + pw / 2, y + ph / 2);
    c.addChild(g);
  }
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const aspect = ctx.aspect;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF6F1"));
  const textColor = str(values.textColor, pc("textColor", "#241009"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const beforeLabel = str(values.beforeLabel, "Before");
  const afterLabel = str(values.afterLabel, "After");

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  const sideBySide = aspect === "16:9" || aspect === "1:1";
  const r = minDim * 0.035;
  const beforeBase = "#E7E5E1";
  const beforeGlyph = "#AEA89F";
  const beforeTex = images.beforeImage ?? null;
  const afterTex = images.afterImage ?? null;

  const chipFont = Math.round(minDim * 0.032);
  const chipInset = minDim * 0.055;

  // A BEFORE/AFTER tag chip.
  const makeChip = (text: string, cx: number, cy: number, bgc: string, fgc: string): Container => {
    const t = makeText(fonts, { text, role: "display", weight: 700, size: chipFont, color: fgc, anchor: 0.5, letterSpacing: 2 });
    const cw = t.width + chipFont * 1.2;
    const c = new Container();
    c.addChild(makePill(cw, chipFont * 1.7, bgc));
    c.addChild(t);
    c.position.set(cx, cy);
    c.scale.set(0);
    return c;
  };

  // Geometry per orientation.
  let beforeX: number;
  let beforeY: number;
  let afterX: number;
  let afterY: number;
  let pw: number;
  let ph: number;
  let arrowX: number;
  let arrowY: number;
  let arrowFromX: number;
  let arrowFromY: number;
  let arrowChar: string;
  let revealAxis: "x" | "y";

  if (sideBySide) {
    const margin = minDim * 0.075;
    const gap = minDim * 0.05;
    ph = h * (aspect === "16:9" ? 0.66 : 0.6);
    const panelCY = h * 0.53;
    pw = w / 2 - gap / 2 - margin;
    beforeX = margin;
    afterX = w / 2 + gap / 2;
    beforeY = panelCY - ph / 2;
    afterY = beforeY;
    arrowX = w / 2;
    arrowY = panelCY;
    arrowFromX = w / 2 - gap * 0.9;
    arrowFromY = panelCY;
    arrowChar = "→";
    revealAxis = "x";
  } else {
    const margin = minDim * 0.07;
    const gap = minDim * 0.05;
    pw = w - 2 * margin;
    const topY = aspect === "9:16" ? 255 : h * 0.08;
    const botY = aspect === "9:16" ? h - 410 : h * 0.92;
    ph = (botY - topY - gap) / 2;
    beforeX = margin;
    afterX = margin;
    beforeY = topY;
    afterY = topY + ph + gap;
    arrowX = w / 2;
    arrowY = topY + ph + gap / 2;
    arrowFromX = w / 2;
    arrowFromY = arrowY - gap * 0.9;
    arrowChar = "↓";
    revealAxis = "y";
  }

  // Center divider (side-by-side only) sits in the gap.
  const showDivider = values.divider !== false;
  if (sideBySide && showDivider) {
    const divTh = Math.max(2, minDim * 0.004);
    const div = new Graphics().roundRect(-divTh / 2, beforeY, divTh, ph, divTh / 2).fill({ color: textColor, alpha: 0.14 });
    div.position.set(w / 2, 0);
    div.alpha = 0;
    root.addChild(div);
    timeline.to(div, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.5, ease: outQuad });
  }

  // BEFORE panel — enters first.
  const beforePanel = makePanel(beforeX, beforeY, pw, ph, r, beforeTex, beforeBase, beforeGlyph);
  beforePanel.pivot.set(beforeX + pw / 2, beforeY + ph / 2);
  beforePanel.position.set(beforeX + pw / 2, beforeY + ph / 2);
  beforePanel.alpha = 0;
  beforePanel.scale.set(0.94);
  root.addChild(beforePanel);
  timeline
    .to(beforePanel, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outQuad })
    .to(beforePanel, { prop: "scale.x", from: 0.94, to: 1, start: 0.3, duration: 0.6, ease: outExpo })
    .to(beforePanel, { prop: "scale.y", from: 0.94, to: 1, start: 0.3, duration: 0.6, ease: outExpo });

  // AFTER panel — revealed second via a wipe mask.
  const afterPanel = makePanel(afterX, afterY, pw, ph, r, afterTex, accent, onAccent);
  root.addChild(afterPanel);
  const revealMask = new Graphics().rect(0, 0, pw, ph).fill(0xffffff);
  revealMask.position.set(afterX, afterY);
  revealMask.pivot.set(0, 0);
  revealMask.scale.set(revealAxis === "x" ? 0 : 1, revealAxis === "y" ? 0 : 1);
  root.addChild(revealMask);
  afterPanel.mask = revealMask;
  timeline.to(revealMask, { prop: revealAxis === "x" ? "scale.x" : "scale.y", from: 0, to: 1, start: 1.5, duration: 0.8, ease: outExpo });

  // Chips.
  const beforeChip = makeChip(beforeLabel, beforeX + pw / 2, beforeY + chipInset, "#5E5A54", "#FFFFFF");
  root.addChild(beforeChip);
  timeline
    .to(beforeChip, { prop: "scale.x", from: 0, to: 1, start: 0.6, duration: 0.5, ease: spring(0.5) })
    .to(beforeChip, { prop: "scale.y", from: 0, to: 1, start: 0.6, duration: 0.5, ease: spring(0.5) });

  const afterChip = makeChip(afterLabel, afterX + pw / 2, afterY + chipInset, accent, onAccent);
  root.addChild(afterChip);
  timeline
    .to(afterChip, { prop: "scale.x", from: 0, to: 1, start: 2.15, duration: 0.5, ease: spring(0.5) })
    .to(afterChip, { prop: "scale.y", from: 0, to: 1, start: 2.15, duration: 0.5, ease: spring(0.5) });

  // Arrow badge crossing the divider (before → after).
  const Rbadge = minDim * 0.075;
  const badge = new Container();
  badge.addChild(new Graphics().circle(0, 0, Rbadge).fill(accent).stroke({ color: bg, width: Math.max(2, Rbadge * 0.08) }));
  badge.addChild(makeText(fonts, { text: arrowChar, role: "display", weight: 700, size: Math.round(Rbadge * 1.05), color: onAccent, anchor: 0.5 }));
  badge.position.set(arrowFromX, arrowFromY);
  badge.scale.set(0);
  root.addChild(badge);
  timeline
    .to(badge, { prop: "scale.x", from: 0, to: 1, start: 1.0, duration: 0.55, ease: spring(0.5) })
    .to(badge, { prop: "scale.y", from: 0, to: 1, start: 1.0, duration: 0.55, ease: spring(0.5) })
    .to(badge, { prop: "x", from: arrowFromX, to: arrowX, start: 1.0, duration: 0.55, ease: outBack })
    .to(badge, { prop: "y", from: arrowFromY, to: arrowY, start: 1.0, duration: 0.55, ease: outBack });

  return { timeline, duration: 4.0 };
}

export const beforeAfter: TemplateDefinition = {
  id: "before-after",
  name: "Before / After",
  tagline: "A muted before wipes into a vivid after.",
  category: "comparison",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.8,
  palettes: PALETTES,
  fields: [
    { key: "beforeLabel", type: "text", label: "Before label", default: "Before", maxLength: 20 },
    { key: "afterLabel", type: "text", label: "After label", default: "After", maxLength: 20 },
    { key: "beforeImage", type: "image", label: "Before image", default: "", optional: true },
    { key: "afterImage", type: "image", label: "After image", default: "", optional: true },
    { key: "divider", type: "toggle", label: "Divider line", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
