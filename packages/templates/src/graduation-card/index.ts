import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  spring,
  safeRect,
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
const smooth = (u: number): number => u * u * (3 - 2 * u);

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(12, Math.floor((size * maxWidth) / w)) : size;
}

// capColor is a palette-only role for the mortarboard (dark on light palettes,
// light on dark). Kicker/name/school render in textColor (>= 4.5:1 on bg).
const PALETTES: Palette[] = [
  { id: "navy-gold", name: "Navy + gold", colors: { background: "#EEF1F6", textColor: "#0E1B2E", accent: "#B8871A", capColor: "#14243A" } },
  { id: "maroon", name: "Maroon", colors: { background: "#F6ECEC", textColor: "#3A1414", accent: "#9C2E3A", capColor: "#3A1414" } },
  { id: "forest", name: "Forest", colors: { background: "#EAF3EC", textColor: "#123020", accent: "#1F7A4D", capColor: "#123020" } },
  { id: "night-gold", name: "Night gold", colors: { background: "#14161C", textColor: "#F5F1E6", accent: "#E0B23A", capColor: "#F5F1E6" } },
];

const T0 = 0.35;
const T1 = 1.2;
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F6"));
  const textColor = str(values.textColor, pc("textColor", "#0E1B2E"));
  const accent = str(values.accent, pc("accent", "#B8871A"));
  const capColor = pc("capColor", "#14243A");

  const name = str(values.name, "Jordan Lee");
  const year = str(values.year, "2026");
  const school = str(values.school, "Riverside University");
  const showCap = on(values.showCap);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const maxW = zone.width * 0.9;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Metrics for centered stack ---
  const S = minDim * 0.16;
  const capBlockH = showCap ? S * 1.35 : 0;
  const kickerText = `CLASS OF ${year}`;
  const kickerSize = fitSize(fonts, kickerText, "body", 700, Math.round(minDim * 0.036), maxW);
  const nameSize = fitSize(fonts, name, "display", 700, Math.round(minDim * 0.086), maxW);
  const schoolSize = fitSize(fonts, school, "body", 500, Math.round(minDim * 0.034), maxW);
  const gap = minDim * 0.035;

  const totalH = capBlockH + (showCap ? gap : 0) + kickerSize + gap * 0.9 + nameSize + gap * 0.8 + schoolSize;
  let cursorY = zone.y + zone.height / 2 - totalH / 2;

  // --- Cap (pure closed-form toss) + tassel (damped swing) ---
  let cap: Container | null = null;
  let tassel: Container | null = null;
  let capCenterY = 0;
  if (showCap) {
    capCenterY = cursorY + S * 0.5;
    cap = new Container();
    cap.position.set(cx, capCenterY);
    cap.alpha = 0;
    root.addChild(cap);

    const board = new Graphics();
    board.poly([-0.24 * S, 0.05 * S, 0.24 * S, 0.05 * S, 0.17 * S, 0.34 * S, -0.17 * S, 0.34 * S]).fill(capColor);
    board.poly([0, -0.26 * S, 0.62 * S, 0, 0, 0.26 * S, -0.62 * S, 0]).fill(capColor);
    board.circle(0, 0, 0.05 * S).fill(accent);
    cap.addChild(board);

    tassel = new Container();
    tassel.position.set(0.6 * S, 0); // pivot at the board's right corner
    cap.addChild(tassel);
    const cord = new Graphics().moveTo(0, 0).lineTo(0, 0.5 * S).stroke({ color: accent, width: Math.max(2, S * 0.03), cap: "round" });
    tassel.addChild(cord);
    tassel.addChild(new Graphics().circle(0, 0.54 * S, 0.08 * S).fill(accent));

    timeline.to(cap, { prop: "alpha", from: 0, to: 1, start: T0, duration: 0.25, ease: outQuad });
    cursorY += capBlockH + gap;
  }

  const startY = capCenterY + h * 0.55;
  const arcLift = minDim * 0.14;
  const rot0 = -0.5;
  const tossUpdate = (t: number): void => {
    if (!cap) return;
    if (t <= T0) {
      cap.position.set(cx, startY);
      cap.rotation = rot0;
      if (tassel) tassel.rotation = 0.6;
      return;
    }
    if (t >= T1) {
      cap.position.set(cx, capCenterY);
      cap.rotation = 0;
    } else {
      const u = (t - T0) / (T1 - T0);
      const e = smooth(u);
      cap.position.set(cx, startY + (capCenterY - startY) * e - arcLift * Math.sin(Math.PI * u));
      cap.rotation = rot0 * (1 - e);
    }
    if (tassel) {
      if (t < T1) {
        tassel.rotation = 0.6;
      } else {
        const tau = t - T1;
        tassel.rotation = 0.6 * Math.exp(-3.2 * tau) * Math.cos(9 * tau);
      }
    }
  };

  // --- Text block ---
  const textStart = showCap ? 1.15 : 0.2;
  const kickerY = cursorY + kickerSize / 2;
  const kicker = makeText(fonts, { text: kickerText, role: "body", weight: 700, size: kickerSize, color: textColor, anchor: 0.5, letterSpacing: 3 });
  kicker.position.set(cx, kickerY);
  kicker.alpha = 0;
  root.addChild(kicker);
  timeline
    .to(kicker, { prop: "alpha", from: 0, to: 1, start: textStart, duration: 0.4, ease: outQuad })
    .to(kicker, { prop: "y", from: kickerY - 10, to: kickerY, start: textStart, duration: 0.5, ease: outQuint });
  cursorY += kickerSize + gap * 0.9;

  const nameY = cursorY + nameSize / 2;
  const nameText = makeText(fonts, { text: name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: 0.5, align: "center" });
  nameText.position.set(cx, nameY);
  nameText.alpha = 0;
  nameText.scale.set(0.7);
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: textStart + 0.18, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "scale.x", from: 0.7, to: 1, start: textStart + 0.18, duration: 0.65, ease: spring(0.5) })
    .to(nameText, { prop: "scale.y", from: 0.7, to: 1, start: textStart + 0.18, duration: 0.65, ease: spring(0.5) });
  cursorY += nameSize + gap * 0.8;

  const schoolY = cursorY + schoolSize / 2;
  const schoolText = makeText(fonts, { text: school, role: "body", weight: 500, size: schoolSize, color: textColor, anchor: 0.5, letterSpacing: 0.5 });
  schoolText.position.set(cx, schoolY + 10);
  schoolText.alpha = 0;
  root.addChild(schoolText);
  timeline
    .to(schoolText, { prop: "alpha", from: 0, to: 0.82, start: textStart + 0.4, duration: 0.45, ease: outQuad })
    .to(schoolText, { prop: "y", from: schoolY + 10, to: schoolY, start: textStart + 0.4, duration: 0.5, ease: outQuint });

  const update = (t: number): void => {
    tossUpdate(t);
  };

  return { timeline, duration: DURATION, update };
}

export const graduationCard: TemplateDefinition = {
  id: "graduation-card",
  name: "Graduation Card",
  tagline: "A mortarboard tosses up and its tassel settles over the graduate's name.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { name: "display", school: "body" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Name", default: "Jordan Lee", maxLength: 26, shrinkToFit: true },
    { key: "year", type: "text", label: "Year", default: "2026", maxLength: 6, shrinkToFit: true },
    { key: "school", type: "text", label: "School", default: "Riverside University", maxLength: 34, shrinkToFit: true },
    { key: "showCap", type: "toggle", label: "Cap toss", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
