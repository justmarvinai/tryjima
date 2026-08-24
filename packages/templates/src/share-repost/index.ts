import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  inQuad,
  outExpo,
  makeOutBack,
  spring,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { dashedPath } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#F4F5F7", textColor: "#101014", accent: "#2E7DF6", cardBg: "#FFFFFF", muted: "#9096A0", onAccent: "#FFFFFF" } },
  { id: "dark", name: "Dark", colors: { background: "#0E0E12", textColor: "#FFFFFF", accent: "#2E7DF6", cardBg: "#1C1C22", muted: "#565C68", onAccent: "#FFFFFF" } },
  { id: "sunset", name: "Sunset", colors: { background: "#FFF1EC", textColor: "#34120A", accent: "#FF4D1C", cardBg: "#FFFFFF", muted: "#C7A79C", onAccent: "#FFFFFF" } },
  { id: "grape-night", name: "Grape night", colors: { background: "#14101F", textColor: "#FFFFFF", accent: "#7C5CFF", cardBg: "#211A33", muted: "#564A78", onAccent: "#FFFFFF" } },
];

/** Sample a quadratic bezier (p0 -> p1, pulled toward pc) into a flat [x,y,...] polyline. */
function quadPoints(
  p0: { x: number; y: number },
  pc: { x: number; y: number },
  p1: { x: number; y: number },
  steps: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    out.push(mt * mt * p0.x + 2 * mt * t * pc.x + t * t * p1.x, mt * mt * p0.y + 2 * mt * t * pc.y + t * t * p1.y);
  }
  return out;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F5F7"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#2E7DF6"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const muted = pc("muted", "#9096A0");
  const onAccent = pc("onAccent", "#FFFFFF");
  const label = str(values.label, "Reposted");
  const handle = str(values.handle, "by @you");
  const showArc = values.showArc !== false;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const safe = safeRect(ctx.aspect);
  const cx = size.width / 2;

  // --- Sizes ---
  const cardW = Math.min(safe.width * 0.92, minDim * 0.76);
  const cardH = cardW * 0.56;
  const cardR = cardW * 0.055;
  const pillLabelSize = Math.round(minDim * 0.05);
  const pillH = Math.round(pillLabelSize * 2.35);
  const handleSize = Math.round(pillLabelSize * 0.52);

  const gapCardPill = cardH * 0.6;
  const gapPillHandle = handle.length > 0 ? pillLabelSize * 0.65 : 0;
  const handleH = handle.length > 0 ? handleSize * 1.2 : 0;
  const totalH = cardH + gapCardPill + pillH + gapPillHandle + handleH;
  const top = safe.y + safe.height / 2 - totalH / 2;
  const cardCy = top + cardH / 2;
  const pillCy = top + cardH + gapCardPill + pillH / 2;
  const handleCy = top + cardH + gapCardPill + pillH + gapPillHandle + handleH / 2;

  // --- Post card (a representative card; header + skeleton body + action row) ---
  const card = new Container();
  card.position.set(cx, cardCy);
  card.alpha = 0;
  card.scale.set(0.85);
  root.addChild(card);
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardBg));

  const padX = cardW * 0.07;
  const avR = cardH * 0.11;
  const headerY = -cardH / 2 + cardH * 0.17;
  card.addChild(new Graphics().circle(-cardW / 2 + padX + avR, headerY, avR).fill(muted));
  const bar1Y = headerY - avR * 0.4;
  const bar2Y = headerY + avR * 0.55;
  const barX = -cardW / 2 + padX + avR * 2 + padX * 0.5;
  card.addChild(new Graphics().roundRect(barX, bar1Y - 3, cardW * 0.26, 6, 3).fill(muted));
  card.addChild(new Graphics().roundRect(barX, bar2Y - 3, cardW * 0.16, 6, 3).fill({ color: muted, alpha: 0.65 }));

  const bodyTop = headerY + avR * 1.9;
  const lineH = cardH * 0.085;
  const lineGap = cardH * 0.075;
  card.addChild(new Graphics().roundRect(-cardW / 2 + padX, bodyTop, cardW - padX * 2, lineH, lineH / 2).fill({ color: muted, alpha: 0.35 }));
  card.addChild(new Graphics().roundRect(-cardW / 2 + padX, bodyTop + lineH + lineGap, cardW * 0.58, lineH, lineH / 2).fill({ color: muted, alpha: 0.35 }));

  const footerY = cardH / 2 - cardH * 0.17;
  const iconSize = cardH * 0.15;
  const iconGap = cardW * 0.12;
  const shareLocalX = cardW / 2 - padX - iconSize * 0.5;
  const commentLocalX = shareLocalX - iconGap;
  const heartLocalX = commentLocalX - iconGap;
  const heartIcon = makeIcon("heart", iconSize, { color: muted });
  heartIcon.position.set(heartLocalX, footerY);
  card.addChild(heartIcon);
  const commentIcon = makeIcon("comment", iconSize, { color: muted, holeColor: cardBg });
  commentIcon.position.set(commentLocalX, footerY);
  card.addChild(commentIcon);
  const shareIconStatic = makeIcon("share", iconSize, { color: muted });
  shareIconStatic.position.set(shareLocalX, footerY);
  card.addChild(shareIconStatic);

  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.4, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.85, to: 1, start: 0.05, duration: 0.55, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0.85, to: 1, start: 0.05, duration: 0.55, ease: spring(0.5) });

  // --- Traveling share icon: a little hop from the card's action row up to the pill ---
  const shareStart = { x: cx + shareLocalX, y: cardCy + footerY };
  const shareEnd = { x: cx, y: pillCy - pillH * 0.92 };
  const sharePeak = { x: (shareStart.x + shareEnd.x) / 2, y: Math.min(shareStart.y, shareEnd.y) - cardH * 0.34 };

  if (showArc) {
    const ctrl = { x: 2 * sharePeak.x - (shareStart.x + shareEnd.x) / 2, y: 2 * sharePeak.y - (shareStart.y + shareEnd.y) / 2 };
    const trailPts = quadPoints(shareStart, ctrl, shareEnd, 28);
    const trail = new Graphics();
    dashedPath(trail, trailPts, { dash: iconSize * 0.22, gap: iconSize * 0.18, width: Math.max(2, iconSize * 0.1), color: accent, cap: "round" });
    trail.alpha = 0;
    root.addChild(trail);
    timeline
      .to(trail, { prop: "alpha", from: 0, to: 0.8, start: 1.0, duration: 0.4, ease: outQuad })
      .to(trail, { prop: "alpha", from: 0.8, to: 0, start: 1.66, duration: 0.4, ease: outQuad });
  }

  const flyIcon = makeIcon("share", iconSize * 1.7, { color: accent });
  flyIcon.position.set(shareStart.x, shareStart.y);
  flyIcon.alpha = 0;
  flyIcon.scale.set(0.6);
  root.addChild(flyIcon);

  const ARC_START = 1.0;
  const HOP1 = 0.32;
  const HOP2 = 0.34;
  const ARC_END = ARC_START + HOP1 + HOP2;
  timeline
    .to(flyIcon, { prop: "alpha", from: 0, to: 1, start: ARC_START, duration: 0.12, ease: outQuad })
    .to(flyIcon, { prop: "scale.x", from: 0.6, to: 1, start: ARC_START, duration: 0.22, ease: makeOutBack(2) })
    .to(flyIcon, { prop: "scale.y", from: 0.6, to: 1, start: ARC_START, duration: 0.22, ease: makeOutBack(2) })
    .to(flyIcon, { prop: "x", from: shareStart.x, to: sharePeak.x, start: ARC_START, duration: HOP1, ease: outQuad })
    .to(flyIcon, { prop: "y", from: shareStart.y, to: sharePeak.y, start: ARC_START, duration: HOP1, ease: outQuad })
    .to(flyIcon, { prop: "x", from: sharePeak.x, to: shareEnd.x, start: ARC_START + HOP1, duration: HOP2, ease: inQuad })
    .to(flyIcon, { prop: "y", from: sharePeak.y, to: shareEnd.y, start: ARC_START + HOP1, duration: HOP2, ease: inQuad })
    .to(flyIcon, { prop: "rotation", from: 0, to: 0.55, start: ARC_START, duration: HOP1 + HOP2, ease: outQuad })
    .to(flyIcon, { prop: "alpha", from: 1, to: 0, start: ARC_END + 0.02, duration: 0.22, ease: outQuad })
    .to(flyIcon, { prop: "scale.x", from: 1, to: 1.3, start: ARC_END, duration: 0.22, ease: outQuad })
    .to(flyIcon, { prop: "scale.y", from: 1, to: 1.3, start: ARC_END, duration: 0.22, ease: outQuad });

  // --- Confirmation pill: check + label ---
  const pillLabelText = makeText(fonts, { text: label, role: "display", weight: 700, size: pillLabelSize, color: onAccent, anchor: 0.5 });
  const checkSize = pillLabelSize * 0.9;
  const checkGap = pillLabelSize * 0.35;
  const pillPadX = pillLabelSize * 0.85;
  const pillW = checkSize + checkGap + pillLabelText.width + pillPadX * 2;

  const pill = new Container();
  pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(accent));
  const checkIcon = makeIcon("check", checkSize, { color: onAccent });
  checkIcon.position.set(-pillW / 2 + pillPadX + checkSize / 2, 0);
  pill.addChild(checkIcon);
  pillLabelText.position.set(-pillW / 2 + pillPadX + checkSize + checkGap + pillLabelText.width / 2, 0);
  pill.addChild(pillLabelText);
  pill.position.set(cx, pillCy);
  pill.scale.set(0);
  root.addChild(pill);

  const POP_AT = ARC_END + 0.05;
  timeline
    .to(pill, { prop: "scale.x", from: 0, to: 1, start: POP_AT, duration: 0.5, ease: makeOutBack(1.8) })
    .to(pill, { prop: "scale.y", from: 0, to: 1, start: POP_AT, duration: 0.5, ease: makeOutBack(1.8) })
    .to(pill, { prop: "scale.x", from: 1, to: 1.05, start: POP_AT + 0.5, duration: 0.14, ease: outQuad })
    .to(pill, { prop: "scale.y", from: 1, to: 1.05, start: POP_AT + 0.5, duration: 0.14, ease: outQuad })
    .to(pill, { prop: "scale.x", from: 1.05, to: 1, start: POP_AT + 0.64, duration: 0.24, ease: outQuad })
    .to(pill, { prop: "scale.y", from: 1.05, to: 1, start: POP_AT + 0.64, duration: 0.24, ease: outQuad });

  // --- Handle caption ---
  if (handle.length > 0) {
    const handleText = makeText(fonts, { text: handle, role: "body", weight: 500, size: handleSize, color: textColor, anchor: 0.5, align: "center" });
    handleText.position.set(cx, handleCy + 10);
    handleText.alpha = 0;
    root.addChild(handleText);
    timeline
      .to(handleText, { prop: "alpha", from: 0, to: 0.75, start: POP_AT + 0.25, duration: 0.4, ease: outQuad })
      .to(handleText, { prop: "y", from: handleCy + 10, to: handleCy, start: POP_AT + 0.25, duration: 0.5, ease: outExpo });
  }

  return { timeline, duration: 4.0 };
}

export const shareRepost: TemplateDefinition = {
  id: "share-repost",
  name: "Share / Repost",
  tagline: "A post's share icon hops along an arc into a repost confirmation.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { label: "display" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Confirmation", default: "Reposted", maxLength: 20, shrinkToFit: true },
    { key: "handle", type: "text", label: "Handle", default: "by @you", maxLength: 24, optional: true },
    { key: "showArc", type: "toggle", label: "Motion arc trail", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
