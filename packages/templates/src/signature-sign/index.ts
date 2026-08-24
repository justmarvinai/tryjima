import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  type BuiltTemplate,
  type Palette,
  type Rng,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "paper-ink", name: "Paper + ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", roleColor: "#5B5B68" } },
  { id: "ink-night", name: "Ink night", colors: { background: "#121016", textColor: "#FFFFFF", accent: "#FF8A5B", roleColor: "#B7B2C0" } },
  { id: "parchment", name: "Parchment", colors: { background: "#F7F0DE", textColor: "#3A2C12", accent: "#9C6B2E", roleColor: "#6E5B3C" } },
  { id: "slate-rose", name: "Slate + rose", colors: { background: "#EEF0F4", textColor: "#232B3A", accent: "#C4477A", roleColor: "#565F71" } },
];

/**
 * Draws a single continuous, left-to-right flowing "signature" stroke into `g`
 * (a stylized flourish — there is no handwriting font, so this does not spell
 * the printed name). `rng` perturbs the curve control points a little so each
 * seed reads as a subtly different signature while staying deterministic.
 */
function buildSignaturePath(g: Graphics, width: number, amp: number, rng: Rng): void {
  const j = (): number => rng.range(0.85, 1.15);
  g.moveTo(0, 0);
  // A tall opening loop, like a capital-letter flourish.
  g.bezierCurveTo(width * 0.02, -amp * 2.0 * j(), width * 0.1, -amp * 2.3 * j(), width * 0.18, amp * 0.1);
  // A cursive down-up hump.
  g.bezierCurveTo(width * 0.22, amp * 0.9 * j(), width * 0.3, amp * 0.9 * j(), width * 0.34, amp * 0.05);
  // An ascender.
  g.bezierCurveTo(width * 0.38, -amp * 1.3 * j(), width * 0.46, -amp * 1.3 * j(), width * 0.5, -amp * 0.1);
  // Another down-up hump.
  g.bezierCurveTo(width * 0.54, amp * 0.85 * j(), width * 0.62, amp * 0.85 * j(), width * 0.68, 0);
  // A gentler hump.
  g.bezierCurveTo(width * 0.72, amp * 0.7 * j(), width * 0.8, amp * 0.7 * j(), width * 0.84, amp * 0.05);
  // The tail: a small lifted flick, like a pen leaving the page.
  g.bezierCurveTo(width * 0.9, amp * 0.5 * j(), width * 0.96, -amp * 0.6 * j(), width, -amp * 0.35);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const roleColor = pc("roleColor", "#5B5B68");

  const name = str(values.name, "Sam Rivera");
  const title = str(values.title, "Founder & CEO");
  const showUnderline = on(values.showUnderline);

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const cx = W / 2;
  const sigY = H * 0.42;
  const DUR = 4.6;

  // --- Background (full-frame, first child so transparent export can blank it) ---
  const bgRect = new Graphics().rect(-W / 2, -H / 2, W, H).fill(bg);
  bgRect.position.set(W / 2, H / 2);
  bgRect.label = "bg";
  bgRect.scale.set(1.02);
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  timeline
    .to(bgRect, { prop: "scale.x", from: 1.02, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(bgRect, { prop: "scale.y", from: 1.02, to: 1, start: 0, duration: 0.4, ease: outQuad });

  const pathWidth = minDim * 0.62;
  const amp = minDim * 0.05;
  const strokeW = Math.max(3, minDim * 0.014);
  const sigX = cx - pathWidth / 2;

  // --- The signature: a pre-drawn stroke revealed left-to-right by a growing mask ---
  const sigHolder = new Container();
  sigHolder.position.set(sigX, sigY);
  root.addChild(sigHolder);

  const sigGraphic = new Graphics();
  buildSignaturePath(sigGraphic, pathWidth, amp, rng);
  sigGraphic.stroke({ color: accent, width: strokeW, cap: "round", join: "round" });
  sigHolder.addChild(sigGraphic);

  const sigMaskH = amp * 4.6;
  const sigMask = new Graphics().rect(0, 0, pathWidth + strokeW * 2, sigMaskH).fill(0xffffff);
  sigMask.position.set(-strokeW, -amp * 2.9);
  sigMask.scale.x = 0;
  sigHolder.addChild(sigMask);
  sigGraphic.mask = sigMask;

  const WRITE_START = 0.3;
  const WRITE_DUR = 1.3;
  const WRITE_END = WRITE_START + WRITE_DUR;
  timeline.to(sigMask, { prop: "scale.x", from: 0, to: 1, start: WRITE_START, duration: WRITE_DUR, ease: outQuad });

  // --- Underline flourish: a second small stroke, drawn on the same way (optional) ---
  let afterWrite = WRITE_END + 0.3;
  if (showUnderline) {
    const ulY = sigY + amp * 1.6;
    const ulWidth = pathWidth * 0.62;
    const ulHolder = new Container();
    ulHolder.position.set(cx - ulWidth / 2, ulY);
    root.addChild(ulHolder);

    const ulGraphic = new Graphics();
    ulGraphic
      .moveTo(0, 0)
      .quadraticCurveTo(ulWidth * 0.5, amp * 0.55, ulWidth * 0.82, -amp * 0.05)
      .quadraticCurveTo(ulWidth * 0.94, -amp * 0.4, ulWidth, -amp * 0.6);
    ulGraphic.stroke({ color: accent, width: strokeW * 0.72, cap: "round", join: "round" });
    ulHolder.addChild(ulGraphic);

    const ulMaskH = amp * 2.2;
    const ulMask = new Graphics().rect(0, 0, ulWidth + strokeW, ulMaskH).fill(0xffffff);
    ulMask.position.set(-strokeW * 0.5, -amp * 1.1);
    ulMask.scale.x = 0;
    ulHolder.addChild(ulMask);
    ulGraphic.mask = ulMask;

    const UL_START = WRITE_END + 0.15;
    const UL_DUR = 0.55;
    timeline.to(ulMask, { prop: "scale.x", from: 0, to: 1, start: UL_START, duration: UL_DUR, ease: outQuad });
    afterWrite = UL_START + UL_DUR + 0.3;
  }

  // --- Printed name + title beneath (shrink-to-fit so long names never overflow) ---
  const textMaxWidth = W * 0.86;
  const bodyFamily = fonts.family("body");
  let nameSize = Math.round(minDim * 0.052);
  const nameWidth0 = fonts.measure(name, { family: bodyFamily, weight: 700, size: nameSize });
  if (nameWidth0 > textMaxWidth) nameSize = Math.max(12, Math.floor(nameSize * (textMaxWidth / nameWidth0)));
  const nameY = sigY + amp * 1.6 + (showUnderline ? amp * 1.1 : 0) + nameSize * 0.7;
  const nameYFrom = nameY + 14;
  const nameText = makeText(fonts, { text: name, role: "body", weight: 700, size: nameSize, color: textColor, anchor: 0.5, align: "center" });
  nameText.position.set(cx, nameYFrom);
  nameText.alpha = 0;
  root.addChild(nameText);
  const NAME_START = afterWrite;
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: NAME_START, duration: 0.45, ease: outQuad })
    .to(nameText, { prop: "y", from: nameYFrom, to: nameY, start: NAME_START, duration: 0.5, ease: outQuint });

  if (title.length > 0) {
    let titleSize = Math.round(nameSize * 0.68);
    const titleWidth0 = fonts.measure(title, { family: bodyFamily, weight: 500, size: titleSize });
    if (titleWidth0 > textMaxWidth) titleSize = Math.max(10, Math.floor(titleSize * (textMaxWidth / titleWidth0)));
    const titleY = nameY + nameSize * 0.9;
    const titleYFrom = titleY + 12;
    const titleText = makeText(fonts, { text: title, role: "body", weight: 500, size: titleSize, color: roleColor, anchor: 0.5, align: "center" });
    titleText.position.set(cx, titleYFrom);
    titleText.alpha = 0;
    root.addChild(titleText);
    const TITLE_START = NAME_START + 0.2;
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 0.9, start: TITLE_START, duration: 0.4, ease: outQuad })
      .to(titleText, { prop: "y", from: titleYFrom, to: titleY, start: TITLE_START, duration: 0.45, ease: outQuint });
  }

  return { timeline, duration: DUR };
}

export const signatureSign: TemplateDefinition = {
  id: "signature-sign",
  name: "Signature Sign",
  tagline: "A flowing signature writes itself on, then a printed name settles in.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.3,
  fontRoles: { name: "body", title: "body" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Name", default: "Sam Rivera", maxLength: 32 },
    { key: "title", type: "text", label: "Title", default: "Founder & CEO", maxLength: 40, optional: true },
    { key: "showUnderline", type: "toggle", label: "Underline flourish", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};
