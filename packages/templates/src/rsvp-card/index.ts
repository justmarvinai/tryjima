import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  inOutQuint,
  makeOutBack,
  spring,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
  letterSpacing = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size,
    ...(letterSpacing ? { letterSpacing } : {}),
  });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "champagne-ivory", name: "Champagne ivory", colors: { background: "#FBF6EC", textColor: "#2E2712", accent: "#7A5A26", onAccent: "#FFFFFF" } },
  { id: "midnight-formal", name: "Midnight formal", colors: { background: "#14141C", textColor: "#F5F1E6", accent: "#D6AF56", onAccent: "#14141C" } },
  { id: "rosewood", name: "Rosewood", colors: { background: "#FFF1F0", textColor: "#3A1418", accent: "#B5384A", onAccent: "#FFFFFF" } },
  { id: "sage-garden", name: "Sage garden", colors: { background: "#EEF3EA", textColor: "#1B2A1C", accent: "#3E7A47", onAccent: "#FFFFFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FBF6EC"));
  const textColor = str(values.textColor, pc("textColor", "#2E2712"));
  const accent = str(values.accent, pc("accent", "#7A5A26"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const showFrame = values.showFrame !== false;

  const eyebrow = str(values.eyebrow, "YOU'RE INVITED");
  const eventName = str(values.eventName, "Summer Gala");
  const date = str(values.date, "Sat, Sep 12 · 6 PM");
  const venue = str(values.venue, "The Grand Hall");
  const acceptLabel = str(values.acceptLabel, "Accept");
  const declineLabel = str(values.declineLabel, "Decline");

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h); // 1080 for every aspect
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const rect = safeRect(ctx.aspect);

  const framePad = minDim * 0.018;
  const fx0 = rect.x + framePad;
  const fy0 = rect.y + framePad;
  const fx1 = rect.x + rect.width - framePad;
  const fy1 = rect.y + rect.height - framePad;
  const frameW = fx1 - fx0;
  const frameH = fy1 - fy0;

  // --- Decorative border frame (toggle) ---
  if (showFrame) {
    const th = Math.max(2, minDim * 0.006);
    const top = new Graphics().rect(0, 0, frameW, th).fill(accent);
    top.position.set(fx0, fy0);
    top.scale.set(0, 1);
    const right = new Graphics().rect(0, 0, th, frameH).fill(accent);
    right.position.set(fx1 - th, fy0);
    right.scale.set(1, 0);
    const bottom = new Graphics().rect(0, 0, frameW, th).fill(accent);
    bottom.pivot.set(frameW, 0);
    bottom.position.set(fx1, fy1 - th);
    bottom.scale.set(0, 1);
    const left = new Graphics().rect(0, 0, th, frameH).fill(accent);
    left.pivot.set(0, frameH);
    left.position.set(fx0, fy1);
    left.scale.set(1, 0);
    root.addChild(top, right, bottom, left);
    timeline
      .to(top, { prop: "scale.x", from: 0, to: 1, start: 0.0, duration: 0.3, ease: inOutQuint })
      .to(right, { prop: "scale.y", from: 0, to: 1, start: 0.26, duration: 0.3, ease: inOutQuint })
      .to(bottom, { prop: "scale.x", from: 0, to: 1, start: 0.52, duration: 0.3, ease: inOutQuint })
      .to(left, { prop: "scale.y", from: 0, to: 1, start: 0.78, duration: 0.3, ease: inOutQuint });
  }

  // --- Vertical rhythm ---
  const innerPad = minDim * 0.06;
  const contentW = frameW - innerPad * 2;

  const eyebrowSize = Math.round(minDim * 0.03);
  const nameSize = fitSize(fonts, eventName, "display", 700, Math.round(minDim * 0.09), contentW);
  const dateSize = Math.round(minDim * 0.032);
  const venueSize = Math.round(minDim * 0.03);
  const btnLabelSize = Math.round(minDim * 0.034);
  const btnH = Math.round(btnLabelSize * 2.5);

  const gapA = minDim * 0.045;
  const gapB = minDim * 0.05;
  const gapC = minDim * 0.018;
  const gapD = minDim * 0.07;

  const totalH = eyebrowSize * 1.15 + gapA + nameSize * 1.05 + gapB + dateSize * 1.2 + gapC + venueSize * 1.2 + gapD + btnH;
  let cursor = (fy0 + fy1) / 2 - totalH / 2;

  // Eyebrow (letter-spacing settles in).
  const eyebrowText = makeText(fonts, { text: eyebrow.toUpperCase(), role: "body", weight: 600, size: eyebrowSize, color: accent, anchor: { x: 0.5, y: 0 }, align: "center", letterSpacing: 5 });
  eyebrowText.position.set(cx, cursor);
  eyebrowText.alpha = 0;
  root.addChild(eyebrowText);
  timeline
    .to(eyebrowText, { prop: "alpha", from: 0, to: 1, start: 0.32, duration: 0.5, ease: outQuad })
    .to(eyebrowText, { prop: "style.letterSpacing", from: eyebrowSize * 0.4, to: 5, start: 0.32, duration: 0.5, ease: outQuint });
  cursor += eyebrowSize * 1.15 + gapA;

  // Event name — rises under a clip mask (the invitation's hero line).
  const nameCenterY = cursor + nameSize * 0.55;
  const nameHolder = new Container();
  nameHolder.position.set(cx, nameCenterY);
  root.addChild(nameHolder);
  const nameMask = new Graphics().rect(-frameW / 2, -nameSize * 0.8, frameW, nameSize * 1.6).fill(0xffffff);
  nameHolder.addChild(nameMask);
  const nameText = makeText(fonts, { text: eventName, role: "display", weight: 700, size: nameSize, color: textColor, anchor: 0.5, align: "center" });
  nameText.mask = nameMask;
  nameHolder.addChild(nameText);
  timeline.to(nameText, { prop: "y", from: nameSize * 1.2, to: 0, start: 0.62, duration: 0.6, ease: outQuint });
  cursor += nameSize * 1.05 + gapB;

  // Date.
  const dateFit = fitSize(fonts, date, "body", 500, dateSize, contentW);
  const dateText = makeText(fonts, { text: date, role: "body", weight: 500, size: dateFit, color: textColor, anchor: { x: 0.5, y: 0 }, align: "center" });
  dateText.position.set(cx, cursor);
  dateText.alpha = 0;
  root.addChild(dateText);
  timeline
    .to(dateText, { prop: "alpha", from: 0, to: 1, start: 1.3, duration: 0.45, ease: outQuad })
    .to(dateText, { prop: "y", from: cursor + 12, to: cursor, start: 1.3, duration: 0.5, ease: outQuint });
  cursor += dateSize * 1.2 + gapC;

  // Venue.
  const venueFit = fitSize(fonts, venue, "body", 500, venueSize, contentW);
  const venueText = makeText(fonts, { text: venue, role: "body", weight: 500, size: venueFit, color: textColor, anchor: { x: 0.5, y: 0 }, align: "center" });
  venueText.position.set(cx, cursor);
  venueText.alpha = 0;
  root.addChild(venueText);
  timeline
    .to(venueText, { prop: "alpha", from: 0, to: 0.85, start: 1.48, duration: 0.45, ease: outQuad })
    .to(venueText, { prop: "y", from: cursor + 12, to: cursor, start: 1.48, duration: 0.5, ease: outQuint });
  cursor += venueSize * 1.2 + gapD;

  // --- Accept / Decline row ---
  const buttonsY = cursor + btnH / 2;
  const btnPadX = minDim * 0.036;
  const btnGap = minDim * 0.045;
  const strokeW = Math.max(2, minDim * 0.0028);

  // Decline: a plain outline (ghost) button — the "unselected" state throughout.
  const declineLabelNode = makeText(fonts, { text: declineLabel, role: "display", weight: 700, size: btnLabelSize, color: textColor, anchor: 0.5 });
  const declineNaturalW = declineLabelNode.width + btnPadX * 2;

  // Accept: reserves room for a checkmark that appears once "selected", so the
  // pill never resizes mid-animation.
  const checkSize = btnLabelSize * 0.85;
  const innerGap = btnLabelSize * 0.32;
  const acceptLabelNode = makeText(fonts, { text: acceptLabel, role: "display", weight: 700, size: btnLabelSize, color: accent, anchor: 0.5 });
  const acceptGroupW = checkSize + innerGap + acceptLabelNode.width;
  const acceptNaturalW = acceptGroupW + btnPadX * 2;

  const pillW = Math.max(declineNaturalW, acceptNaturalW);
  const declineCx = cx - btnGap / 2 - pillW / 2;
  const acceptCx = cx + btnGap / 2 + pillW / 2;

  // Decline pill.
  const declineC = new Container();
  declineC.addChild(new Graphics().roundRect(-pillW / 2, -btnH / 2, pillW, btnH, btnH / 2).stroke({ color: textColor, width: strokeW, alpha: 0.55 }));
  declineLabelNode.position.set(0, 0);
  declineC.addChild(declineLabelNode);
  declineC.position.set(declineCx, buttonsY);
  declineC.scale.set(0);
  root.addChild(declineC);

  // Accept pill (outline + reserved checkmark from the start; fill + ring pop
  // in later as the "selected" highlight).
  const acceptC = new Container();
  const acceptOutline = new Graphics().roundRect(-pillW / 2, -btnH / 2, pillW, btnH, btnH / 2).stroke({ color: accent, width: strokeW });
  acceptC.addChild(acceptOutline);
  const acceptFill = new Graphics().roundRect(-pillW / 2, -btnH / 2, pillW, btnH, btnH / 2).fill(accent);
  acceptFill.scale.set(0);
  acceptC.addChild(acceptFill);
  const ringPad = Math.max(3, btnH * 0.1);
  const acceptRing = new Graphics()
    .roundRect(-pillW / 2 - ringPad, -btnH / 2 - ringPad, pillW + ringPad * 2, btnH + ringPad * 2, btnH / 2 + ringPad)
    .stroke({ color: accent, width: Math.max(2, minDim * 0.0022) });
  acceptRing.alpha = 0;
  acceptC.addChild(acceptRing);
  const groupLeft = -acceptGroupW / 2;
  const checkIcon = makeIcon("check", checkSize, { color: onAccent });
  checkIcon.position.set(groupLeft + checkSize / 2, 0);
  checkIcon.scale.set(0);
  acceptC.addChild(checkIcon);
  acceptLabelNode.position.set(groupLeft + checkSize + innerGap + acceptLabelNode.width / 2, 0);
  acceptC.addChild(acceptLabelNode);
  acceptC.position.set(acceptCx, buttonsY);
  acceptC.scale.set(0);
  root.addChild(acceptC);

  const btnPopStart = 1.9;
  timeline
    .to(declineC, { prop: "scale.x", from: 0, to: 1, start: btnPopStart, duration: 0.5, ease: spring(0.45) })
    .to(declineC, { prop: "scale.y", from: 0, to: 1, start: btnPopStart, duration: 0.5, ease: spring(0.45) })
    .to(acceptC, { prop: "scale.x", from: 0, to: 1, start: btnPopStart + 0.14, duration: 0.5, ease: spring(0.45) })
    .to(acceptC, { prop: "scale.y", from: 0, to: 1, start: btnPopStart + 0.14, duration: 0.5, ease: spring(0.45) });

  // The satisfying "selected" moment: fill sweeps in, a ring pulses once, the
  // checkmark pops, and the label swaps to the on-accent color mid-fill.
  const selectStart = 2.75;
  timeline
    .to(acceptFill, { prop: "scale.x", from: 0, to: 1, start: selectStart, duration: 0.42, ease: makeOutBack(1.5) })
    .to(acceptFill, { prop: "scale.y", from: 0, to: 1, start: selectStart, duration: 0.42, ease: makeOutBack(1.5) })
    .to(acceptRing, { prop: "alpha", from: 0, to: 1, start: selectStart, duration: 0.22, ease: outQuad })
    .to(acceptRing, { prop: "alpha", from: 1, to: 0, start: selectStart + 0.22, duration: 0.4, ease: outQuad })
    .to(acceptRing, { prop: "scale.x", from: 1, to: 1.08, start: selectStart, duration: 0.5, ease: outQuad })
    .to(acceptRing, { prop: "scale.y", from: 1, to: 1.08, start: selectStart, duration: 0.5, ease: outQuad })
    .to(checkIcon, { prop: "scale.x", from: 0, to: 1, start: selectStart + 0.1, duration: 0.4, ease: makeOutBack(2.2) })
    .to(checkIcon, { prop: "scale.y", from: 0, to: 1, start: selectStart + 0.1, duration: 0.4, ease: makeOutBack(2.2) })
    .set(acceptLabelNode, "style.fill", onAccent, selectStart + 0.16)
    // A quick confirmation pulse on the whole button once it lands.
    .to(acceptC, { prop: "scale.x", from: 1, to: 1.045, start: selectStart + 0.42, duration: 0.14, ease: outQuad })
    .to(acceptC, { prop: "scale.y", from: 1, to: 1.045, start: selectStart + 0.42, duration: 0.14, ease: outQuad })
    .to(acceptC, { prop: "scale.x", from: 1.045, to: 1, start: selectStart + 0.56, duration: 0.26, ease: outQuad })
    .to(acceptC, { prop: "scale.y", from: 1.045, to: 1, start: selectStart + 0.56, duration: 0.26, ease: outQuad });

  return { timeline, duration: 4.4 };
}

export const rsvpCard: TemplateDefinition = {
  id: "rsvp-card",
  name: "RSVP Card",
  tagline: "An invitation settles in, then Accept lands as the chosen reply.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { eventName: "display" },
  palettes: PALETTES,
  fields: [
    { key: "eyebrow", type: "text", label: "Eyebrow", default: "YOU'RE INVITED", maxLength: 24 },
    { key: "eventName", type: "text", label: "Event name", default: "Summer Gala", maxLength: 40, shrinkToFit: true },
    { key: "date", type: "text", label: "Date", default: "Sat, Sep 12 · 6 PM", maxLength: 32 },
    { key: "venue", type: "text", label: "Venue", default: "The Grand Hall", maxLength: 40, shrinkToFit: true },
    { key: "acceptLabel", type: "text", label: "Accept button", default: "Accept", maxLength: 16 },
    { key: "declineLabel", type: "text", label: "Decline button", default: "Decline", maxLength: 16 },
    { key: "showFrame", type: "toggle", label: "Decorative frame", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
