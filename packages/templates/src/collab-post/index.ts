import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  inOutCubic,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { avatar, makePill } from "../shared/ui";

// Collab Post — two accounts announce a partnership. Both avatars glide in from
// opposite edges on a long expo curve, settle slightly overlapped, and a small
// "×" badge crossfades in on the seam. The joint handle line and caption follow
// as one flowing, staggered gesture. Calm and considered — no pops, no bounces.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

/** Rough perceived luminance of a #rrggbb color (0..1). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
const inkOn = (hex: string): string => (luminance(hex) < 0.56 ? "#FFFFFF" : "#14161B");

/** Largest size <= size0 at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

/** Normalize to exactly one leading "@". */
function handleOf(raw: string): string {
  const t = raw.trim().replace(/^@+/, "");
  return t.length > 0 ? `@${t}` : "@";
}

/** First letter of a handle, for the avatar chip. */
function initialOf(raw: string): string {
  const t = raw.trim().replace(/^@+/, "");
  const c = t.charAt(0);
  return c.length > 0 ? c.toUpperCase() : "?";
}

const PALETTES: Palette[] = [
  { id: "porcelain", name: "Porcelain", colors: { background: "#FBFAF9", cardColor: "#FFFFFF", textColor: "#16181D", accent: "#1F6F5C", avatarB: "#2B3038" } },
  { id: "mist", name: "Mist", colors: { background: "#EEF1F6", cardColor: "#FFFFFF", textColor: "#101722", accent: "#2A55A5", avatarB: "#1E2A3D" } },
  { id: "sand", name: "Sand", colors: { background: "#F7F2EA", cardColor: "#FFFFFF", textColor: "#241D15", accent: "#9C4D1C", avatarB: "#3A2E23" } },
  { id: "ink", name: "Ink", colors: { background: "#101318", cardColor: "#1A1E26", textColor: "#F3F5F8", accent: "#86D3B6", avatarB: "#39414E" } },
];

// Vertical rhythm, expressed as fractions of the design unit S so the whole
// stack scales as one block in every aspect.
const F_EYEBROW = 0.062;
const F_GAP1 = 0.062;
const F_PAIR = 0.25;
const F_GAP2 = 0.085;
const F_HANDLE = 0.092;
const F_GAP3 = 0.038;
const F_RULE = 0.003;
const F_GAP4 = 0.048;
const F_CAPTION = 0.058;

const EYEBROW_AT = 0.05;
const AV_A_AT = 0.18;
const AV_B_AT = 0.26;
const AV_TRAVEL = 1.15;
const JOIN_AT = 1.05;
const HANDLE_AT = 1.35;
const HANDLE_STAGGER = 0.09;
const RULE_AT = 1.62;
const CAPTION_AT = 1.92;
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FBFAF9"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#16181D"));
  const accent = str(values.accent, pc("accent", "#1F6F5C"));
  const avatarB = pc("avatarB", "#2B3038");

  const eyebrow = str(values.eyebrow, "Collab");
  const rawA = str(values.handleOne, "@northlight");
  const rawB = str(values.handleTwo, "@studioverse");
  const handleA = handleOf(rawA);
  const handleB = handleOf(rawB);
  const caption = str(values.caption, "Something new, together.");
  const cross = str(values.joiner, "cross") !== "plus";
  const joinChar = cross ? "×" : "+";

  const showEyebrow = on(values.showEyebrow) && eyebrow.length > 0;
  const showBadge = on(values.showBadge);
  const showRule = on(values.showRule);
  const hasCaption = caption.length > 0;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Block metrics ---
  let frac = F_PAIR + F_GAP2 + F_HANDLE;
  if (showEyebrow) frac += F_EYEBROW + F_GAP1;
  if (showRule) frac += F_GAP3 + F_RULE;
  if (hasCaption) frac += F_GAP4 + F_CAPTION;

  const S = Math.min(Math.min(minDim, safe.width) * 1.15, (safe.height * 0.92) / frac);
  const avatarR = S * 0.125;
  let y = safe.y + (safe.height - frac * S) / 2;

  // --- Eyebrow chip ---
  if (showEyebrow) {
    const chipH = F_EYEBROW * S;
    const ebSize = fitSize(fonts, eyebrow.toUpperCase(), "body", 700, Math.round(chipH * 0.42), safe.width * 0.6);
    const ebText = makeText(fonts, {
      text: eyebrow.toUpperCase(),
      role: "body",
      weight: 700,
      size: ebSize,
      color: accent,
      anchor: 0.5,
      letterSpacing: ebSize * 0.1,
    });
    const chip = new Container();
    const chipBg = makePill(ebText.width + chipH * 1.15, chipH, accent);
    chipBg.alpha = 0.13;
    chip.addChild(chipBg);
    chip.addChild(ebText);
    const chipCy = y + chipH / 2;
    chip.position.set(cx, chipCy);
    chip.alpha = 0;
    root.addChild(chip);
    timeline
      .to(chip, { prop: "alpha", from: 0, to: 1, start: EYEBROW_AT, duration: 0.55, ease: outQuad })
      .to(chip, { prop: "y", from: chipCy + S * 0.018, to: chipCy, start: EYEBROW_AT, duration: 0.85, ease: outExpo });
    y += chipH + F_GAP1 * S;
  }

  // --- The pair: glide in from opposite sides, settle overlapping ---
  const pairCy = y + avatarR;
  const restA = cx - avatarR * 0.9;
  const restB = cx + avatarR * 0.9;
  const travel = Math.max(avatarR * 3.2, safe.width * 0.36);
  const ringW = Math.max(3, avatarR * 0.1);

  const avB = avatar(fonts, {
    radius: avatarR,
    bg: avatarB,
    initial: initialOf(rawB),
    textColor: inkOn(avatarB),
    ring: { color: bg, width: ringW },
  });
  avB.position.set(restB + travel, pairCy);
  avB.alpha = 0;
  avB.scale.set(0.93);
  root.addChild(avB);

  const avA = avatar(fonts, {
    radius: avatarR,
    bg: accent,
    initial: initialOf(rawA),
    textColor: inkOn(accent),
    ring: { color: bg, width: ringW },
  });
  avA.position.set(restA - travel, pairCy);
  avA.alpha = 0;
  avA.scale.set(0.93);
  root.addChild(avA);

  timeline
    .to(avA, { prop: "x", from: restA - travel, to: restA, start: AV_A_AT, duration: AV_TRAVEL, ease: outExpo })
    .to(avA, { prop: "alpha", from: 0, to: 1, start: AV_A_AT, duration: 0.5, ease: outQuad })
    .to(avA, { prop: "scale.x", from: 0.93, to: 1, start: AV_A_AT, duration: AV_TRAVEL, ease: outQuint })
    .to(avA, { prop: "scale.y", from: 0.93, to: 1, start: AV_A_AT, duration: AV_TRAVEL, ease: outQuint })
    .to(avB, { prop: "x", from: restB + travel, to: restB, start: AV_B_AT, duration: AV_TRAVEL, ease: outExpo })
    .to(avB, { prop: "alpha", from: 0, to: 1, start: AV_B_AT, duration: 0.5, ease: outQuad })
    .to(avB, { prop: "scale.x", from: 0.93, to: 1, start: AV_B_AT, duration: AV_TRAVEL, ease: outQuint })
    .to(avB, { prop: "scale.y", from: 0.93, to: 1, start: AV_B_AT, duration: AV_TRAVEL, ease: outQuint });

  // --- Joiner badge, crossfading on the seam ---
  if (showBadge) {
    const badgeR = avatarR * 0.38;
    const badge = new Container();
    badge.addChild(new Graphics().circle(0, 0, badgeR).fill(cardColor));
    badge.addChild(
      new Graphics().circle(0, 0, badgeR).stroke({ color: textColor, width: Math.max(1, badgeR * 0.05), alpha: 0.1 }),
    );
    const glyph = makeIcon("plus", badgeR * 0.92, { color: accent });
    if (cross) glyph.rotation = Math.PI / 4;
    badge.addChild(glyph);
    badge.position.set(cx, pairCy);
    badge.alpha = 0;
    badge.scale.set(0.76);
    root.addChild(badge);
    timeline
      .to(badge, { prop: "alpha", from: 0, to: 1, start: JOIN_AT, duration: 0.5, ease: outQuad })
      .to(badge, { prop: "scale.x", from: 0.76, to: 1, start: JOIN_AT, duration: 0.9, ease: outQuint })
      .to(badge, { prop: "scale.y", from: 0.76, to: 1, start: JOIN_AT, duration: 0.9, ease: outQuint });
  }

  y += F_PAIR * S + F_GAP2 * S;

  // --- Joint handle line: "@one × @two" (three parts, staggered) ---
  const handleCy = y + F_HANDLE * S * 0.5;
  const handleSize0 = Math.round(F_HANDLE * S * 0.8);
  const handleSize = fitSize(fonts, `${handleA} ${joinChar} ${handleB}`, "display", 700, handleSize0, safe.width * 0.84);
  const gap = handleSize * 0.36;
  const partA = makeText(fonts, { text: handleA, role: "display", weight: 700, size: handleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  const partJ = makeText(fonts, { text: joinChar, role: "display", weight: 600, size: handleSize, color: accent, anchor: { x: 0, y: 0.5 } });
  const partB = makeText(fonts, { text: handleB, role: "display", weight: 700, size: handleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  const lineW = partA.width + partJ.width + partB.width + gap * 2;
  let px = cx - lineW / 2;
  [partA, partJ, partB].forEach((part, i) => {
    part.position.set(px, handleCy);
    part.alpha = 0;
    root.addChild(part);
    px += part.width + gap;
    const start = HANDLE_AT + i * HANDLE_STAGGER;
    timeline
      .to(part, { prop: "alpha", from: 0, to: 1, start, duration: 0.55, ease: outQuad })
      .to(part, { prop: "y", from: handleCy + handleSize * 0.28, to: handleCy, start, duration: 0.95, ease: outExpo });
  });
  y += F_HANDLE * S;

  // --- Hairline rule ---
  if (showRule) {
    y += F_GAP3 * S;
    const ruleW = Math.min(safe.width * 0.46, S * 0.42);
    const ruleH = Math.max(1.5, F_RULE * S);
    const rule = new Graphics().rect(-ruleW / 2, 0, ruleW, ruleH).fill({ color: textColor, alpha: 0.16 });
    rule.position.set(cx, y);
    rule.scale.x = 0;
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: RULE_AT, duration: 0.95, ease: inOutCubic });
    y += ruleH;
  }

  // --- Caption ---
  if (hasCaption) {
    y += F_GAP4 * S;
    const capSize = fitSize(fonts, caption, "body", 500, Math.round(F_CAPTION * S * 0.72), safe.width * 0.86);
    const capCy = y + F_CAPTION * S * 0.5;
    const capText = makeText(fonts, { text: caption, role: "body", weight: 500, size: capSize, color: textColor, anchor: 0.5, align: "center" });
    capText.position.set(cx, capCy);
    capText.alpha = 0;
    root.addChild(capText);
    timeline
      .to(capText, { prop: "alpha", from: 0, to: 0.74, start: CAPTION_AT, duration: 0.65, ease: outQuad })
      .to(capText, { prop: "y", from: capCy + capSize * 0.4, to: capCy, start: CAPTION_AT, duration: 0.95, ease: outExpo });
  }

  return { timeline, duration: DURATION };
}

export const collabPost: TemplateDefinition = {
  id: "collab-post",
  name: "Collab Post",
  tagline: "Two accounts glide together, a joint handle line settles beneath them.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { handleOne: "display", handleTwo: "display", caption: "body", eyebrow: "body" },
  palettes: PALETTES,
  fields: [
    { key: "eyebrow", type: "text", label: "Eyebrow", default: "Collab", maxLength: 18, shrinkToFit: true },
    { key: "handleOne", type: "text", label: "First handle", default: "@northlight", maxLength: 20, shrinkToFit: true },
    { key: "handleTwo", type: "text", label: "Second handle", default: "@studioverse", maxLength: 20, shrinkToFit: true },
    { key: "caption", type: "text", label: "Caption", default: "Something new, together.", maxLength: 44, shrinkToFit: true },
    {
      key: "joiner",
      type: "select",
      label: "Joiner",
      default: "cross",
      options: [
        { value: "cross", label: "Cross (×)" },
        { value: "plus", label: "Plus (+)" },
      ],
    },
    { key: "showEyebrow", type: "toggle", label: "Eyebrow chip", default: true },
    { key: "showBadge", type: "toggle", label: "Joiner badge", default: true },
    { key: "showRule", type: "toggle", label: "Hairline rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
