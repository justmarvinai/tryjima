import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  outQuint,
  spring,
  safeZone,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number): Text {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

// `boxColor`/`badgeColor` are fixed, pre-verified palette-only roles (see
// growth-arrow / pyramid-levels comments) — only background/textColor/accent
// are user-editable. Arrows/rings never carry text, so raw accent hues are safe
// there; the "chosen" checkmark badge uses the darkened badgeColor instead.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#151016", accent: "#FF4D1C", boxColor: "#F7F3EF", badgeColor: "#C2380F", onBadge: "#FFFFFF" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", boxColor: "#FFFFFF", badgeColor: "#2A5AD6", onBadge: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FAF5EA", accent: "#D8F34D", boxColor: "#1C1C22", badgeColor: "#3A4A0E", onBadge: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF", boxColor: "#FFFFFF", badgeColor: "#5B3FE0", onBadge: "#FFFFFF" } },
];

const START_POP = 0.0;
const ARROW1_START = 0.55;
const ARROW1_DUR = 0.42;
const DIAMOND_POP = 0.85;
const ARROW2_START = 1.45;
const ARROW3_START = 1.65;
const ARROW_DUR = 0.45;
const YESBOX_POP = ARROW2_START + ARROW_DUR * 0.8;
const NOBOX_POP = ARROW3_START + ARROW_DUR * 0.8;
const BOX_POP_DUR = 0.45;
const HIGHLIGHT_START = Math.max(YESBOX_POP, NOBOX_POP) + BOX_POP_DUR + 0.35;
const HIGHLIGHT_DUR = 0.4;
const HOLD = 1.1;
const DURATION = HIGHLIGHT_START + HIGHLIGHT_DUR + 0.35 + HOLD;

interface Pt {
  x: number;
  y: number;
}

interface ArrowRefs {
  accentShaft: Graphics;
  accentHead: Graphics;
}

function addArrow(
  root: Container,
  timeline: JimaTimeline,
  from: Pt,
  to: Pt,
  start: number,
  dur: number,
  thick: number,
  neutralColor: string,
  accentColor: string,
): ArrowRefs {
  const ddx = to.x - from.x;
  const ddy = to.y - from.y;
  const len = Math.hypot(ddx, ddy);
  const angle = Math.atan2(ddy, ddx);
  const headLen = thick * 2.4;
  const headWidth = thick * 2.1;
  const lineLen = Math.max(thick, len - headLen * 0.6);

  const shaftC = new Container();
  shaftC.position.set(from.x, from.y);
  shaftC.rotation = angle;
  shaftC.scale.set(0, 1);
  const neutralShaft = new Graphics().roundRect(0, -thick / 2, lineLen, thick, thick / 2).fill({ color: neutralColor, alpha: 0.3 });
  const accentShaft = new Graphics().roundRect(0, -thick / 2, lineLen, thick, thick / 2).fill(accentColor);
  accentShaft.alpha = 0;
  shaftC.addChild(neutralShaft, accentShaft);
  root.addChild(shaftC);
  timeline.to(shaftC, { prop: "scale.x", from: 0, to: 1, start, duration: dur, ease: outExpo });

  const headC = new Container();
  headC.position.set(to.x, to.y);
  headC.rotation = angle;
  headC.scale.set(0);
  const neutralHead = new Graphics().poly([-headLen, -headWidth / 2, 0, 0, -headLen, headWidth / 2]).fill({ color: neutralColor, alpha: 0.3 });
  const accentHead = new Graphics().poly([-headLen, -headWidth / 2, 0, 0, -headLen, headWidth / 2]).fill(accentColor);
  accentHead.alpha = 0;
  headC.addChild(neutralHead, accentHead);
  root.addChild(headC);
  const headStart = start + dur * 0.82;
  timeline
    .to(headC, { prop: "scale.x", from: 0, to: 1, start: headStart, duration: 0.3, ease: makeOutBack(2) })
    .to(headC, { prop: "scale.y", from: 0, to: 1, start: headStart, duration: 0.3, ease: makeOutBack(2) });

  return { accentShaft, accentHead };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#151016"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const boxColor = pc("boxColor", "#F7F3EF");
  const badgeColor = pc("badgeColor", "#C2380F");
  const onBadge = pc("onBadge", "#FFFFFF");

  const startLabel = str(values.startLabel, "Start");
  const decisionLabel = str(values.decisionLabel, "Ready to launch?");
  const yesLabel = str(values.yesLabel, "Ship it");
  const noLabel = str(values.noLabel, "Keep testing");
  const chosenPath = str(values.chosenPath, "yes") === "no" ? "no" : "yes";
  const showLabels = values.showLabels !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const insets = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  // --- Geometry ---
  const startBoxW = minDim * 0.34;
  const startBoxH = minDim * 0.105;
  const diamondW = minDim * 0.4;
  const diamondH = minDim * 0.225;
  const branchBoxW = minDim * 0.3;
  const branchBoxH = minDim * 0.11;

  const startY = insets.top + minDim * 0.1;
  const branchY = h - insets.bottom - minDim * 0.12;
  const levelSpan = branchY - startY;
  const diamondY = startY + levelSpan * 0.4;

  const maxSpread = w / 2 - insets.left - branchBoxW / 2 - minDim * 0.02;
  const spreadX = Math.max(minDim * 0.14, Math.min(w * 0.24, maxSpread));

  const startPt: Pt = { x: w / 2, y: startY };
  const diamondPt: Pt = { x: w / 2, y: diamondY };
  const yesPt: Pt = { x: w / 2 - spreadX, y: branchY };
  const noPt: Pt = { x: w / 2 + spreadX, y: branchY };

  const shaftThick = Math.max(6, minDim * 0.014);

  // --- Start box (rounded rect, pops in first) ---
  const startBox = new Container();
  startBox.position.set(startPt.x, startPt.y);
  startBox.addChild(new Graphics().roundRect(-startBoxW / 2, -startBoxH / 2 + startBoxH * 0.05, startBoxW, startBoxH, startBoxH * 0.3).fill({ color: "#000000", alpha: 0.07 }));
  startBox.addChild(new Graphics().roundRect(-startBoxW / 2, -startBoxH / 2, startBoxW, startBoxH, startBoxH * 0.3).fill(boxColor));
  const startText = fitText(fonts, { text: startLabel, role: "display", weight: 700, size: Math.round(startBoxH * 0.32), color: textColor, anchor: 0.5, align: "center" }, startBoxW * 0.82);
  startBox.addChild(startText);
  startBox.scale.set(0);
  root.addChild(startBox);
  timeline
    .to(startBox, { prop: "scale.x", from: 0, to: 1, start: START_POP, duration: 0.55, ease: spring(0.5) })
    .to(startBox, { prop: "scale.y", from: 0, to: 1, start: START_POP, duration: 0.55, ease: spring(0.5) });

  // --- Arrow 1: start → diamond ---
  const arrow1 = addArrow(
    root,
    timeline,
    { x: startPt.x, y: startPt.y + startBoxH / 2 },
    { x: diamondPt.x, y: diamondPt.y - diamondH / 2 },
    ARROW1_START,
    ARROW1_DUR,
    shaftThick,
    textColor,
    accent,
  );

  // --- Decision diamond ---
  const diamond = new Container();
  diamond.position.set(diamondPt.x, diamondPt.y);
  diamond.addChild(new Graphics().poly([0, -diamondH / 2 + diamondH * 0.05, diamondW / 2, diamondH * 0.05, 0, diamondH / 2 + diamondH * 0.05, -diamondW / 2, diamondH * 0.05]).fill({ color: "#000000", alpha: 0.06 }));
  diamond.addChild(
    new Graphics()
      .poly([0, -diamondH / 2, diamondW / 2, 0, 0, diamondH / 2, -diamondW / 2, 0])
      .fill(boxColor)
      .poly([0, -diamondH / 2, diamondW / 2, 0, 0, diamondH / 2, -diamondW / 2, 0])
      .stroke({ color: textColor, width: Math.max(1.5, minDim * 0.003), alpha: 0.14 }),
  );
  const decisionSize = fitSize(fonts, decisionLabel, "display", 700, Math.round(diamondH * 0.16), diamondW * 0.62);
  const decisionText = fitText(fonts, { text: decisionLabel, role: "display", weight: 700, size: decisionSize, color: textColor, anchor: 0.5, align: "center" }, diamondW * 0.62);
  diamond.addChild(decisionText);
  diamond.scale.set(0);
  root.addChild(diamond);
  timeline
    .to(diamond, { prop: "scale.x", from: 0, to: 1, start: DIAMOND_POP, duration: 0.5, ease: spring(0.5) })
    .to(diamond, { prop: "scale.y", from: 0, to: 1, start: DIAMOND_POP, duration: 0.5, ease: spring(0.5) });

  // --- Arrows: diamond → yes / no branches (staggered, "in sequence") ---
  const arrowYes = addArrow(root, timeline, { x: diamondPt.x, y: diamondPt.y + diamondH / 2 }, { x: yesPt.x, y: yesPt.y - branchBoxH / 2 }, ARROW2_START, ARROW_DUR, shaftThick, textColor, accent);
  const arrowNo = addArrow(root, timeline, { x: diamondPt.x, y: diamondPt.y + diamondH / 2 }, { x: noPt.x, y: noPt.y - branchBoxH / 2 }, ARROW3_START, ARROW_DUR, shaftThick, textColor, accent);

  // --- Yes/No chip labels near each arrow's midpoint ---
  if (showLabels) {
    const chipFont = Math.max(9, Math.round(minDim * 0.026));
    const mkChip = (text: string, from: Pt, to: Pt, start: number): void => {
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const dxSign = to.x - from.x < 0 ? -1 : 1;
      const chipX = midX + dxSign * minDim * 0.05;
      const chipY = midY - minDim * 0.026;
      const label = makeText(fonts, { text, role: "body", weight: 700, size: chipFont, color: textColor, anchor: 0.5 });
      const padX = chipFont * 0.8;
      const padY = chipFont * 0.45;
      const chip = new Container();
      chip.addChild(new Graphics().roundRect(-label.width / 2 - padX, -label.height / 2 - padY, label.width + padX * 2, label.height + padY * 2, (label.height + padY * 2) / 2).fill(bg).stroke({ color: textColor, width: 1, alpha: 0.14 }));
      chip.addChild(label);
      chip.position.set(chipX, chipY);
      chip.alpha = 0;
      chip.scale.set(0.7);
      root.addChild(chip);
      timeline
        .to(chip, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
        .to(chip, { prop: "scale.x", from: 0.7, to: 1, start, duration: 0.35, ease: outQuint })
        .to(chip, { prop: "scale.y", from: 0.7, to: 1, start, duration: 0.35, ease: outQuint });
    };
    mkChip("Yes", diamondPt, yesPt, ARROW2_START + 0.22);
    mkChip("No", diamondPt, noPt, ARROW3_START + 0.22);
  }

  // --- Branch boxes ---
  const mkBranchBox = (text: string, pt: Pt, start: number): Container => {
    const box = new Container();
    box.position.set(pt.x, pt.y);
    box.addChild(new Graphics().roundRect(-branchBoxW / 2, -branchBoxH / 2 + branchBoxH * 0.05, branchBoxW, branchBoxH, branchBoxH * 0.3).fill({ color: "#000000", alpha: 0.07 }));
    box.addChild(new Graphics().roundRect(-branchBoxW / 2, -branchBoxH / 2, branchBoxW, branchBoxH, branchBoxH * 0.3).fill(boxColor));
    const t = fitText(fonts, { text, role: "display", weight: 700, size: Math.round(branchBoxH * 0.3), color: textColor, anchor: 0.5, align: "center" }, branchBoxW * 0.82);
    box.addChild(t);
    box.scale.set(0);
    root.addChild(box);
    timeline
      .to(box, { prop: "scale.x", from: 0, to: 1, start, duration: BOX_POP_DUR, ease: spring(0.5) })
      .to(box, { prop: "scale.y", from: 0, to: 1, start, duration: BOX_POP_DUR, ease: spring(0.5) });
    return box;
  };
  const yesBox = mkBranchBox(yesLabel, yesPt, YESBOX_POP);
  const noBox = mkBranchBox(noLabel, noPt, NOBOX_POP);

  // --- Chosen-path highlight: crossfade the accent overlays on the winning
  // path's arrows, plus a ring + check badge on its branch box. Non-chosen
  // elements simply keep their neutral (structural) color — nothing dims, so
  // contrast never regresses. ---
  const chosenArrow = chosenPath === "yes" ? arrowYes : arrowNo;
  const chosenBox = chosenPath === "yes" ? yesBox : noBox;
  const chosenW = branchBoxW;
  const chosenH = branchBoxH;

  for (const seg of [arrow1, chosenArrow]) {
    timeline
      .to(seg.accentShaft, { prop: "alpha", from: 0, to: 1, start: HIGHLIGHT_START, duration: HIGHLIGHT_DUR, ease: outQuad })
      .to(seg.accentHead, { prop: "alpha", from: 0, to: 1, start: HIGHLIGHT_START, duration: HIGHLIGHT_DUR, ease: outQuad });
  }

  const ringPad = chosenH * 0.16;
  const ring = new Graphics()
    .roundRect(-chosenW / 2 - ringPad, -chosenH / 2 - ringPad, chosenW + ringPad * 2, chosenH + ringPad * 2, chosenH * 0.34)
    .stroke({ color: accent, width: Math.max(2.5, minDim * 0.008) });
  ring.position.set(chosenBox.position.x, chosenBox.position.y);
  ring.alpha = 0;
  root.addChild(ring);
  timeline.to(ring, { prop: "alpha", from: 0, to: 1, start: HIGHLIGHT_START, duration: HIGHLIGHT_DUR, ease: outQuad });

  const badgeR = Math.max(10, minDim * 0.022);
  const badge = new Container();
  badge.position.set(chosenBox.position.x + chosenW / 2, chosenBox.position.y - chosenH / 2);
  badge.addChild(new Graphics().circle(0, 0, badgeR).fill(badgeColor));
  badge.addChild(makeIcon("check", badgeR * 1.15, { color: onBadge }));
  badge.scale.set(0);
  root.addChild(badge);
  const badgeStart = HIGHLIGHT_START + 0.1;
  timeline
    .to(badge, { prop: "scale.x", from: 0, to: 1, start: badgeStart, duration: 0.45, ease: makeOutBack(2.2) })
    .to(badge, { prop: "scale.y", from: 0, to: 1, start: badgeStart, duration: 0.45, ease: makeOutBack(2.2) });

  // Landing pulse on the chosen box once the highlight settles.
  const pulseStart = HIGHLIGHT_START + HIGHLIGHT_DUR + 0.15;
  timeline
    .to(chosenBox, { prop: "scale.x", from: 1, to: 1.06, start: pulseStart, duration: 0.14, ease: outQuad })
    .to(chosenBox, { prop: "scale.x", from: 1.06, to: 1, start: pulseStart + 0.14, duration: 0.22, ease: outQuad })
    .to(chosenBox, { prop: "scale.y", from: 1, to: 1.06, start: pulseStart, duration: 0.14, ease: outQuad })
    .to(chosenBox, { prop: "scale.y", from: 1.06, to: 1, start: pulseStart + 0.14, duration: 0.22, ease: outQuad });

  return { timeline, duration: DURATION };
}

export const flowchart: TemplateDefinition = {
  id: "flowchart",
  name: "Flowchart",
  tagline: "A decision flowchart draws its path and highlights the outcome.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.9,
  fontRoles: { startLabel: "display", decisionLabel: "display", branchLabel: "display" },
  palettes: PALETTES,
  fields: [
    { key: "startLabel", type: "text", label: "Start label", default: "Start", maxLength: 20 },
    { key: "decisionLabel", type: "text", label: "Decision", default: "Ready to launch?", maxLength: 28, shrinkToFit: true },
    { key: "yesLabel", type: "text", label: "Yes outcome", default: "Ship it", maxLength: 20 },
    { key: "noLabel", type: "text", label: "No outcome", default: "Keep testing", maxLength: 20 },
    {
      key: "chosenPath",
      type: "select",
      label: "Highlighted path",
      default: "yes",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
    },
    { key: "showLabels", type: "toggle", label: "Yes/No labels", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
