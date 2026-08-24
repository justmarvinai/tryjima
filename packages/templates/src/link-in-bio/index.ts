import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  spring,
  safeRect,
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
  { id: "ember", name: "Ember", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#7C5CFF" } },
  { id: "insta", name: "Insta", colors: { background: "#FDF2F8", textColor: "#3A0A28", accent: "#E1306C" } },
  { id: "mint", name: "Mint", colors: { background: "#E9F7F0", textColor: "#08221A", accent: "#17A34A" } },
];

/** A simple upward chevron ("swipe up" nudge), centered at origin. */
function makeChevron(size: number, color: string, strokeW: number): Graphics {
  const w2 = size * 0.5;
  const h2 = size * 0.32;
  return new Graphics()
    .poly([-w2, h2, 0, -h2, w2, h2], false)
    .stroke({ color, width: strokeW, cap: "round", join: "round" });
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";
  const label = str(values.label, "Link in bio");
  const sublabel = str(values.sublabel, "");
  const showPointer = values.showPointer !== false;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;
  const cy = safe.y + safe.height * 0.42;

  // --- Pill: icon + label ---
  const iconSize = minDim * 0.078;
  const padX = minDim * 0.062;
  const padY = minDim * 0.036;
  const gapIconLabel = minDim * 0.032;
  const labelBase = Math.round(minDim * 0.058);
  const familyDisplay = fonts.family("display");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });
  const labelMaxW = safe.width * 0.66;
  const labelSize = shrinkToFit(label, measure, { maxWidth: labelMaxW, baseSize: labelBase, minSize: Math.round(labelBase * 0.56) });
  const labelW = measure(label, labelSize);

  const contentW = iconSize + gapIconLabel + labelW;
  const pillH = Math.max(iconSize, labelSize * 1.05) + padY * 2;
  const pillW = contentW + padX * 2;
  const pillRadius = pillH / 2;

  const pill = new Container();
  pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillRadius).fill(accent));
  const iconHolder = new Container();
  iconHolder.addChild(makeIcon("bolt", iconSize, { color: onAccent }));
  iconHolder.position.set(-contentW / 2 + iconSize / 2, 0);
  pill.addChild(iconHolder);
  const labelText = makeText(fonts, { text: label, role: "display", weight: 700, size: labelSize, color: onAccent, anchor: { x: 0, y: 0.5 } });
  labelText.position.set(-contentW / 2 + iconSize + gapIconLabel, 0);
  pill.addChild(labelText);

  pill.position.set(cx, cy);
  pill.alpha = 0;
  pill.scale.set(0.55);
  root.addChild(pill);

  timeline
    .to(pill, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.3, ease: outQuad })
    .to(pill, { prop: "scale.x", from: 0.55, to: 1, start: 0.15, duration: 0.6, ease: spring(0.42) })
    .to(pill, { prop: "scale.y", from: 0.55, to: 1, start: 0.15, duration: 0.6, ease: spring(0.42) });

  // --- Nudging arrow (bounces up toward the pill, repeatedly) ---
  const gapPillArrow = minDim * 0.1;
  const chevronSize = minDim * 0.075;
  const chevronStroke = Math.max(3, minDim * 0.013);
  const arrowY = cy + pillH / 2 + gapPillArrow;

  if (showPointer) {
    const arrowGroup = new Container();
    const chevronBack = makeChevron(chevronSize, accent, chevronStroke);
    chevronBack.alpha = 0.4;
    chevronBack.position.set(0, chevronSize * 0.5);
    const chevronFront = makeChevron(chevronSize, accent, chevronStroke);
    arrowGroup.addChild(chevronBack, chevronFront);
    arrowGroup.position.set(cx, arrowY);
    arrowGroup.alpha = 0;
    arrowGroup.scale.set(0.8);
    root.addChild(arrowGroup);

    timeline
      .to(arrowGroup, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.35, ease: outQuad })
      .to(arrowGroup, { prop: "scale.x", from: 0.8, to: 1, start: 0.5, duration: 0.4, ease: makeOutBack(1.8) })
      .to(arrowGroup, { prop: "scale.y", from: 0.8, to: 1, start: 0.5, duration: 0.4, ease: makeOutBack(1.8) });

    const nudgeAmt = minDim * 0.028;
    const cyc = 0.8;
    const nudgeStart = 0.85;
    const nudgeEnd = 3.65;
    for (let c = 0; c < 4; c++) {
      const t0 = nudgeStart + c * cyc;
      if (t0 + cyc * 0.75 > nudgeEnd) break;
      timeline
        .to(arrowGroup, { prop: "y", from: arrowY, to: arrowY - nudgeAmt, start: t0, duration: cyc * 0.35, ease: outQuad })
        .to(arrowGroup, { prop: "y", from: arrowY - nudgeAmt, to: arrowY, start: t0 + cyc * 0.35, duration: cyc * 0.5, ease: outQuad });
    }
  }

  // --- Sublabel ---
  if (sublabel.length > 0) {
    const subBase = Math.round(minDim * 0.038);
    const subMaxW = safe.width * 0.78;
    const familyBody = fonts.family("body");
    const measureBody = (s: string, sz: number): number => fonts.measure(s, { family: familyBody, weight: 500, size: sz });
    const subSize = shrinkToFit(sublabel, measureBody, { maxWidth: subMaxW, baseSize: subBase, minSize: Math.round(subBase * 0.6) });
    const subY = arrowY + chevronSize * 0.9 + minDim * 0.06;
    const subText = makeText(fonts, { text: sublabel, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center" });
    subText.position.set(cx, subY + 14);
    subText.alpha = 0;
    root.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 1, start: 0.62, duration: 0.5, ease: outQuad })
      .to(subText, { prop: "y", from: subY + 14, to: subY, start: 0.62, duration: 0.55, ease: outExpo });
  }

  return { timeline, duration: 4.0 };
}

export const linkInBio: TemplateDefinition = {
  id: "link-in-bio",
  name: "Link in Bio",
  tagline: "A link pill pops in while an arrow nudges viewers to tap it.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "Link in bio", maxLength: 24, shrinkToFit: true },
    { key: "sublabel", type: "text", label: "Sublabel", default: "Tap to shop", maxLength: 30, optional: true },
    { key: "showPointer", type: "toggle", label: "Nudging pointer", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
  ],
  build,
};
