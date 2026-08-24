import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  makeOutBack,
  shrinkToFit,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Rough perceived luminance of a #rrggbb color (0..1). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const PALETTES: Palette[] = [
  { id: "coral-cobalt", name: "Coral vs cobalt", colors: { background: "#0B0B10", panelA: "#FF4D1C", panelB: "#2E5BD6", accent: "#FFFFFF", textColor: "#FFFFFF", chipBg: "#101014" } },
  { id: "lime-ink", name: "Lime vs ink", colors: { background: "#F5F5F0", panelA: "#D8F34D", panelB: "#101014", accent: "#101014", textColor: "#101014", chipBg: "#FFFFFF" } },
  { id: "grape-mint", name: "Grape vs mint", colors: { background: "#150F24", panelA: "#7C5CFF", panelB: "#12B886", accent: "#FFFFFF", textColor: "#FFFFFF", chipBg: "#150F24" } },
  { id: "sunset-sky", name: "Sunset vs sky", colors: { background: "#101014", panelA: "#FF6A3D", panelB: "#2E9BD6", accent: "#FFFFFF", textColor: "#101014", chipBg: "#FFFFFF" } },
];

/** A half-panel's visual: an image (cover-fit, scrimmed) or a flat color with a
 * soft placeholder silhouette, clipped to (0,0)-(w,h) so it stays crisp while
 * its container is squashed during the edge-anchored scale reveal. */
function buildPanelVisual(w: number, h: number, color: string, tex: Texture | null): Container {
  const c = new Container();
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(w / tex.width, h / tex.height);
    s.scale.set(cover);
    s.position.set(w / 2, h / 2);
    c.addChild(s);
    c.addChild(new Graphics().rect(0, 0, w, h).fill({ color: "#000000", alpha: 0.2 }));
  } else {
    c.addChild(new Graphics().rect(0, 0, w, h).fill(color));
    const iconColor = luminance(color) < 0.5 ? "#FFFFFF" : "#101014";
    const icon = makeIcon("user", Math.min(w, h) * 0.42, { color: iconColor });
    icon.alpha = 0.3;
    icon.position.set(w / 2, h / 2);
    c.addChild(icon);
  }
  const mask = new Graphics().rect(0, 0, w, h).fill(0xffffff);
  c.addChild(mask);
  c.mask = mask;
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0B0B10"));
  const colorA = str(values.panelA, pc("panelA", "#FF4D1C"));
  const colorB = str(values.panelB, pc("panelB", "#2E5BD6"));
  const accent = str(values.accent, pc("accent", "#FFFFFF"));
  const textColor = pc("textColor", "#FFFFFF");
  const chipBg = pc("chipBg", "#101014");
  const labelA = str(values.labelA, "You");
  const labelB = str(values.labelB, "@creator");
  const showDivider = values.showDivider !== false;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const stacked = ctx.aspect === "9:16";
  const timeline = new JimaTimeline();

  const halfW = stacked ? W : W / 2;
  const halfH = stacked ? H / 2 : H;

  const visA = buildPanelVisual(halfW, halfH, colorA, images.imageA ?? null);
  const visB = buildPanelVisual(halfW, halfH, colorB, images.imageB ?? null);
  root.addChild(visA, visB);

  // Each panel's container pivots at (and is positioned on) the frame's OUTER
  // edge, so scaling it from 0 to 1 makes it grow from that outer edge inward
  // toward the seam — "scale in from their outer edges".
  const PANEL_A_START = 0.08;
  const PANEL_B_START = 0.2;
  const PANEL_DUR = 0.62;
  if (stacked) {
    visA.pivot.set(0, 0);
    visA.position.set(0, 0);
    visA.scale.set(1, 0);
    visB.pivot.set(0, halfH);
    visB.position.set(0, H);
    visB.scale.set(1, 0);
    timeline
      .to(visA, { prop: "scale.y", from: 0, to: 1, start: PANEL_A_START, duration: PANEL_DUR, ease: outExpo })
      .to(visB, { prop: "scale.y", from: 0, to: 1, start: PANEL_B_START, duration: PANEL_DUR, ease: outExpo });
  } else {
    visA.pivot.set(0, 0);
    visA.position.set(0, 0);
    visA.scale.set(0, 1);
    visB.pivot.set(halfW, 0);
    visB.position.set(W, 0);
    visB.scale.set(0, 1);
    timeline
      .to(visA, { prop: "scale.x", from: 0, to: 1, start: PANEL_A_START, duration: PANEL_DUR, ease: outExpo })
      .to(visB, { prop: "scale.x", from: 0, to: 1, start: PANEL_B_START, duration: PANEL_DUR, ease: outExpo });
  }

  // --- Divider: sweeps in from the seam's center, then settles with a
  // tiny breathe (kinetic-headline's underline idiom) ---
  if (showDivider) {
    const thick = Math.max(4, minDim * 0.007);
    const DIVIDER_START = 0.58;
    const DIVIDER_DUR = 0.45;
    if (stacked) {
      const divider = new Graphics().rect(-W / 2, -thick / 2, W, thick).fill(accent);
      divider.position.set(W / 2, H / 2);
      divider.scale.set(0, 1);
      root.addChild(divider);
      timeline
        .to(divider, { prop: "scale.x", from: 0, to: 1, start: DIVIDER_START, duration: DIVIDER_DUR, ease: outExpo })
        .to(divider, { prop: "scale.x", from: 1, to: 1.03, start: DIVIDER_START + DIVIDER_DUR, duration: 0.35, ease: outQuad })
        .to(divider, { prop: "scale.x", from: 1.03, to: 1, start: DIVIDER_START + DIVIDER_DUR + 0.35, duration: 0.4, ease: outQuad });
    } else {
      const divider = new Graphics().rect(-thick / 2, -H / 2, thick, H).fill(accent);
      divider.position.set(W / 2, H / 2);
      divider.scale.set(1, 0);
      root.addChild(divider);
      timeline
        .to(divider, { prop: "scale.y", from: 0, to: 1, start: DIVIDER_START, duration: DIVIDER_DUR, ease: outExpo })
        .to(divider, { prop: "scale.y", from: 1, to: 1.03, start: DIVIDER_START + DIVIDER_DUR, duration: 0.35, ease: outQuad })
        .to(divider, { prop: "scale.y", from: 1.03, to: 1, start: DIVIDER_START + DIVIDER_DUR + 0.35, duration: 0.4, ease: outQuad });
    }
  }

  // --- Labels: siblings of the panels (not their children), so they pop in
  // crisply without inheriting the panels' squash-reveal transform ---
  const centerA = stacked ? { x: W / 2, y: H * 0.25 } : { x: W * 0.25, y: H / 2 };
  const centerB = stacked ? { x: W / 2, y: H * 0.75 } : { x: W * 0.75, y: H / 2 };
  const familyDisplay = fonts.family("display");
  const measureLabel = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });
  const labelMaxW = (stacked ? W : halfW) * 0.7;

  function addLabel(text: string, center: { x: number; y: number }, start: number): void {
    const base = Math.round(minDim * 0.048);
    const fontSize = shrinkToFit(text, measureLabel, { maxWidth: labelMaxW, baseSize: base, minSize: Math.round(base * 0.55) });
    const label = makeText(fonts, { text, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
    const padX = fontSize * 0.68;
    const padY = fontSize * 0.4;
    const chipW = label.width + padX * 2;
    const chipH = label.height + padY * 2;
    const chip = new Container();
    chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill(chipBg));
    chip.addChild(label);
    chip.position.set(center.x, center.y);
    chip.alpha = 0;
    chip.scale.set(0.5);
    root.addChild(chip);
    timeline
      .to(chip, { prop: "alpha", from: 0, to: 1, start, duration: 0.25, ease: outQuad })
      .to(chip, { prop: "scale.x", from: 0.5, to: 1, start, duration: 0.5, ease: makeOutBack(1.8) })
      .to(chip, { prop: "scale.y", from: 0.5, to: 1, start, duration: 0.5, ease: makeOutBack(1.8) });
  }
  addLabel(labelA, centerA, 0.75);
  addLabel(labelB, centerB, 0.88);

  return { timeline, duration: 2.7 };
}

export const duetSplit: TemplateDefinition = {
  id: "duet-split",
  name: "Duet Split",
  tagline: "A split-screen duet frame — panels grow in from their outer edges.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 1.9,
  fontRoles: { labelA: "display", labelB: "display" },
  palettes: PALETTES,
  fields: [
    { key: "labelA", type: "text", label: "Label A", default: "You", maxLength: 20, shrinkToFit: true },
    { key: "labelB", type: "text", label: "Label B", default: "@creator", maxLength: 20, shrinkToFit: true },
    { key: "imageA", type: "image", label: "Panel A image", default: "", optional: true, help: "Fills panel A; cover-fit." },
    { key: "imageB", type: "image", label: "Panel B image", default: "", optional: true, help: "Fills panel B; cover-fit." },
    { key: "showDivider", type: "toggle", label: "Divider line", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "panelA", type: "color", label: "Panel A", default: "", optional: true },
    { key: "panelB", type: "color", label: "Panel B", default: "", optional: true },
    { key: "accent", type: "color", label: "Divider accent", default: "", optional: true },
  ],
  build,
};
